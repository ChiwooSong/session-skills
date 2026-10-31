# session-skills

Two skills that give Claude Code (and Codex) memory across sessions.

- **`/handoff`** — run it before you end a conversation. It writes a compact, recency-weighted
  handoff note: what was decided and why, what was tried and dropped, and the single next action.
- **`/restartproj`** — run it when you come back. It briefs you from git history, uncommitted
  changes, remote state and the handoff note, then proposes where to pick up.

Git already knows *what* was committed. The note keeps what only the conversation knew: *why*, and
*what next*.

[![npm](https://img.shields.io/npm/v/@woody_s/session-skills)](https://www.npmjs.com/package/@woody_s/session-skills)
[![Verify](https://github.com/ChiwooSong/session-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/ChiwooSong/session-skills/actions/workflows/ci.yml)

한국어 안내: [README.ko.md](README.ko.md)

## Install

Pick one channel. Every channel puts the same two `SKILL.md` files in place; nothing else is
installed or changed.

### npm (recommended)

```sh
npx --yes @woody_s/session-skills@latest install
```

This installs for Claude Code into `~/.claude/skills/`, so the skills are available in every
project. Requires Node.js 22 or newer.

| Option | Effect |
|---|---|
| `--agent claude\|codex\|all` | Which host to install for (default `claude`). Codex uses `~/.agents/skills/`. |
| `--scope project` or `--project <dir>` | Install into `<dir>/.claude/skills/` (and `.agents/skills/`) instead of the home directory. |
| `--force` | Replace a differing installation. The current files are moved to `<agent root>/skills-backups/session-skills/<timestamp>/` first. |

`status` shows where the skills are installed and whether they match this version. `uninstall`
removes exact installations and keeps modified ones unless `--force`. Updating is
`install --force` after reading what `status` reports.

### Claude Code plugin

```sh
claude plugin marketplace add ChiwooSong/session-skills
claude plugin install session-skills@session-skills
```

Or, inside a session, `/plugin marketplace add ChiwooSong/session-skills` and then
`/plugin install session-skills@session-skills`. Plugin skills are namespaced, so they are invoked as
`/session-skills:handoff` and `/session-skills:restartproj`. `claude plugin update session-skills`
pulls new versions.

### skills CLI

```sh
npx skills add ChiwooSong/session-skills
```

installs into the current project; add `-g` for a global install.

### By hand

Copy `skills/handoff` and `skills/restartproj` into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex), then start a new session.

## Use

**End of a session** — `/handoff`, optionally with points to emphasize:

```
/handoff the API spec is still pending; do not touch main.py until it arrives
```

Claude writes or updates `handoff.md` and replies with the "Resume here" line and the path.

**Start of a session** — `/restartproj`. Claude reads the last 15 commits, the working tree, the
remote and the note, and answers with a five-part briefing: last work, working tree, remote, since
the handoff note, resume point. Flags: `--no-pull` (never pull), `--no-fetch` (no network), or a path
to brief another repository. The skill also triggers on phrases such as "where were we" or
"이어서 하자".

### Where the note lives

1. The project memory directory Claude Code announces for the session (the one holding
   `MEMORY.md`), as `handoff.md`. This is per machine and keyed by the git root, so sub-projects in
   one workspace share a note; every entry is tagged with its project.
2. Otherwise `<repo>/.claude/handoff.md`. Commit it if you want the note to travel between machines
   and teammates, or add it to `.gitignore`.

A path named in the project's `CLAUDE.md` overrides both.

### The note's shape

```markdown
---
name: handoff
description: Session handoff notes for this project. Read first when resuming earlier work.
metadata:
  type: project
  updated: 2026-10-31
  project: mosigi
  branch: main
  head: 3f2a9c1
  dirty: clean
---

## Latest session (2026-10-31 · mosigi · main@3f2a9c1)

**Resume here:** run `npm run test:emu` (expect 217 passing), then commit executeAccountDeletion.
...

## Recent sessions

- (2026-10-20 · mosigi) ...        (at most 4 bullets)

## Earlier history

One paragraph, re-compressed every time something falls out of "Recent sessions".
```

Newest weighs most: each run demotes the previous "Latest session" into a 2–3 sentence bullet,
folds the oldest bullet into the paragraph, and keeps the whole file under about 900 words. The
recorded `head` lets `/restartproj` list the commits made after the note and say when the note has
gone stale.

## What the skills will not do

- `/restartproj` never commits, pushes, rebases, merges, stashes, resets or discards anything. Its
  only write is `git pull --ff-only`, and only when the tree is clean, the branch is strictly behind,
  no flag or project rule forbids it, and the host's permission prompt allows it. Read-only git
  commands are pre-approved through `allowed-tools`; the pull is not.
- `/handoff` leaves out diffs, file contents, facts already fixed by commits, and secrets. It writes
  one file and, when the memory index exists, one pointer line in `MEMORY.md`.
- The installer makes no network requests, runs no scripts, and never deletes a modified
  installation.

## Development

```sh
npm test               # installer and skill-contract tests
npm run test:package   # pack the tarball, install it offline, run the CLI from it
npm run validate:plugin
claude plugin eval . --allow-tools Read,Glob,Grep,Bash,Write,Edit --scaffold   # real model runs, billed
```

The eval cases under `evals/` need a platform with a shell sandbox backend (Linux or macOS; on
Windows the runner refuses to grant Bash) and an API key for the LLM judge. Without those, the same
prompts can be run by hand against a repository built with each case's `scaffold.sh`.

Releases: bump the version in `package.json`, `.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json`, add a `CHANGELOG.md` entry, tag `vX.Y.Z` and push the tag. The
release workflow publishes to npm with trusted publishing (provenance attached) and creates the
GitHub release with the registry tarball and `SHA256SUMS`.

Security: [SECURITY.md](SECURITY.md). License: MIT.
