# Crateweave

A Spotify playlist curator for Codex and Claude. Give it a listening occasion, and it uses the music you return to, the recordings you saved, and the way one track leads into the next to put a playlist together.

In a new personal mix, Crateweave aims for about one track in three to come from outside the library it could check. You can choose your own balance, ask for a mix of discoveries, or keep the selection within your saved music.

> Make me a late-night drive playlist. Start with the live recordings I keep coming back to, then ease into a few artists outside my library. Give it a short name in Turkish.

## Install for Codex or Claude Code

Run this command with Node.js 20 or later to install or update the skill for both apps.

```sh
npx crateweave@latest install both
```

Use `install codex` or `install claude` to choose one. When the installer updates an unmodified 1.0.0 skill, it keeps the previous file in a `.crateweave-backup-*` folder beside the new skill file. If it finds local edits, it tells you which file to review. Start a new session and use **`$crateweave`** in Codex or **`/crateweave`** in Claude Code.

For Claude on the web or desktop, download the [skill ZIP](https://github.com/kalayciburak/crateweave/releases/download/v1.1.0/crateweave-skill-1.1.0.zip). In **Customize → Skills**, choose the option to upload a skill, select the ZIP, and enable it. You can also copy the [standalone English prompt](https://github.com/kalayciburak/crateweave/blob/v1.1.0/prompts/playlist-arranger.en.md) into a chat.

## What to ask for

| When you want… | Try asking… |
| --- | --- |
| A library you can browse by mood | “Look through my saved music and suggest playlists I can recognize at a glance. Show me the plan here.” |
| A mix that holds your attention | “Create a private instrumental playlist for reading. Keep the volume steady and check that you picked the instrumental versions.” |
| Discovery that goes beyond reissues | “Find 25 playable tracks outside my likes and playlists. Mix the genres in one sequence and tell me why three choices fit.” |
| Help with an existing sequence | “Review this playlist. The fourth track breaks the mood. Look for similar transitions and suggest a better order.” |

## Connect your music

For live library work, use a Spotify connection available to your assistant and authorize it through Spotify. The installer only installs the skill. Your connection determines which playlists, history, artwork, folders, and editing tools the assistant can access.

You can also provide an export or playlist links. With read-only access, Crateweave can prepare a CSV with playlist name, position, artist, track, and Spotify URL or URI for use with a compatible importer. For completed edits, it checks Spotify’s saved state and reports what it could verify.

The same [skill file](https://github.com/kalayciburak/crateweave/blob/v1.1.0/skills/crateweave/SKILL.md) powers both assistants. For platform-specific installation details, see the [Codex skills documentation](https://developers.openai.com/codex/skills/), [Claude Code skills documentation](https://code.claude.com/docs/en/skills), and [Claude skill upload guide](https://support.claude.com/en/articles/12512180-use-skills-in-claude).
