#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { link, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const command = process.argv.slice(2);
const version100SkillSha256 = '38bb3c6fec5da700c59636d9f3d09056dca5c3e137d4b7608b2be0ebdf68e9d7';
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
    if (createHash('sha256').update(content).digest('hex') === version100SkillSha256) return 'upgrade';
    throw new Error(`Existing skill contains local changes: ${target}`);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function linkIfMissing(file, target) {
  try {
    await link(file, target);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
}

async function upgrade(target, staged, source) {
  const backupDirectory = await mkdtemp(join(dirname(target), '.crateweave-backup-'));
  const backup = join(backupDirectory, 'previous.md');
  try {
    await rename(target, backup);
  } catch (error) {
    await rm(backupDirectory, { recursive: true });
    if (!isMissing(error)) throw error;
    if (await inspectTarget(target, source) === 'already installed') return 'already installed';
    throw new Error(`Installation changed while updating: ${target}`);
  }

  try {
    const captured = await inspectTarget(backup, source);
    if (!captured) throw new Error(`Previous skill disappeared: ${backup}`);
    if (await linkIfMissing(staged, target)) {
      return captured === 'upgrade' ? 'updated' : 'already installed';
    }
    if (await inspectTarget(target, source) === 'already installed') return 'already installed';
    throw new Error(`Installation changed while updating: ${target}`);
  } catch (error) {
    try {
      await linkIfMissing(backup, target);
    } catch (restoreError) {
      throw new Error(`${error.message}. Restore failed: ${restoreError.message}. Previous file: ${backup}`);
    }
    throw new Error(`${error.message}. Previous file: ${backup}`);
  }
}

async function install(root, segments, source) {
  const directory = await ensureDescendants(root, segments);
  const target = join(directory, 'SKILL.md');
  const existing = await inspectTarget(target, source);
  if (existing === 'already installed') return existing;

  const temporaryDirectory = await mkdtemp(join(directory, '.crateweave-'));
  const temporary = join(temporaryDirectory, 'SKILL.md');
  try {
    await writeFile(temporary, source, { flag: 'wx', mode: 0o644 });
    if (await linkIfMissing(temporary, target)) return 'installed';
    const latest = await inspectTarget(target, source);
    if (latest === 'already installed') return latest;
    if (latest !== 'upgrade') throw new Error(`Target changed during installation: ${target}`);
    return await upgrade(target, temporary, source);
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
