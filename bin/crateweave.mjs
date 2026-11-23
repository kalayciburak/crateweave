#!/usr/bin/env node
import { link, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const command = process.argv.slice(2);
const help = `Crateweave skill installer

Usage:
  crateweave install codex|claude|both

Installs the bundled Crateweave SKILL.md only into your personal Codex or Claude Code skill directory.
Claude uses an absolute CLAUDE_CONFIG_DIR when configured; it must already exist. Relative CLAUDE_CONFIG_DIR values are rejected.`;

const isMissing = (error) => error?.code === 'ENOENT';

async function requireDirectory(path) {
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`Refusing unsafe directory: ${path}`);
  }
}

async function ensureDescendants(root, segments) {
  await requireDirectory(root);
  let current = root;

  for (const segment of segments) {
    current = join(current, segment);
    try {
      await requireDirectory(current);
    } catch (error) {
      if (!isMissing(error)) throw error;
      try {
        await mkdir(current);
      } catch (mkdirError) {
        if (mkdirError?.code !== 'EEXIST') throw mkdirError;
      }
      await requireDirectory(current);
    }
  }

  return current;
}

async function readRegularFile(path) {
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error(`Refusing unsafe file: ${path}`);
  }
  return readFile(path);
}

async function inspectTarget(target, source) {
  try {
    const content = await readRegularFile(target);
    if (content.equals(source)) return 'already installed';
    throw new Error(`Existing skill differs: ${target}`);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function install(root, segments, source) {
  const directory = await ensureDescendants(root, segments);
  const target = join(directory, 'SKILL.md');
  const existing = await inspectTarget(target, source);
  if (existing) return existing;

  const temporaryDirectory = await mkdtemp(join(directory, '.crateweave-'));
  const temporary = join(temporaryDirectory, 'SKILL.md');
  try {
    await writeFile(temporary, source, { flag: 'wx', mode: 0o644 });
    await link(temporary, target);
    return 'installed';
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const concurrent = await inspectTarget(target, source);
    if (concurrent) return concurrent;
    throw new Error(`Target changed during installation: ${target}`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function claudeLocation(home) {
  const configured = process.env.CLAUDE_CONFIG_DIR;
  if (!configured) return { root: home, segments: ['.claude', 'skills', 'crateweave'] };
  if (!isAbsolute(configured)) {
    throw new Error('CLAUDE_CONFIG_DIR must be an absolute path');
  }
  const root = await realpath(configured);
  await requireDirectory(root);
  return { root, segments: ['skills', 'crateweave'] };
}

async function main() {
  if (command.length === 0 || (command.length === 1 && ['--help', '-h'].includes(command[0]))) {
    console.log(help);
    return;
  }

  if (command.length !== 2 || command[0] !== 'install' || !['codex', 'claude', 'both'].includes(command[1])) {
    console.error(help);
    process.exitCode = 1;
    return;
  }

  const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../skills/crateweave/SKILL.md');
  const source = await readRegularFile(sourcePath);
  const home = await realpath(homedir());
  await requireDirectory(home);
  const choices = command[1] === 'both' ? ['codex', 'claude'] : [command[1]];
  let failed = false;

  for (const choice of choices) {
    try {
      const location = choice === 'codex'
        ? { root: home, segments: ['.agents', 'skills', 'crateweave'] }
        : await claudeLocation(home);
      console.log(`${choice}: ${await install(location.root, location.segments, source)}`);
    } catch (error) {
      failed = true;
      console.error(`${choice}: failed (${error.message})`);
    }
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`crateweave: failed (${error.message})`);
  process.exitCode = 1;
});
