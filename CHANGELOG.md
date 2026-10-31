# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-31

First public release. Both skills existed privately since July 2026; this release reworks them for
publication and adds the install channels.

### handoff

- Frontmatter anchors in the note (`updated`, `project`, `branch`, `head`, `dirty`) so `/restartproj`
  can list the commits made after the note and detect staleness.
- The summary opens with a single **Resume here** line: the most concrete next action.
- Word budgets: 150–400 words per session summary, about 900 words for the whole file, with the
  "Earlier history" paragraph compressed first and "Latest session" never trimmed.
- Same-day re-runs merge into the current "Latest session" instead of demoting it.
- Fallback location `<repo>/.claude/handoff.md` when the host announces no memory directory.
- Legacy notes with Korean headings are read and rewritten in the new shape.
- Skill arguments (`/handoff <notes>`) become emphasis points in the summary.
- Section headings are fixed in English (the contract between the two skills); the body follows the
  conversation's language.

### restartproj

- Frontmatter added (`name`, `description`, `argument-hint`, `allowed-tools`). The previous version
  had none, so it could only be invoked by hand; it now triggers on "where were we", "이어서 하자" and
  similar phrases.
- Pull guardrails: `--no-pull`, `--no-fetch`, project rules that forbid pulling (CLAUDE.md, memory,
  the handoff note), and no pull when the working tree is dirty or the branches diverged.
- New "Since the handoff note" section using the recorded `head`.
- Project tag matching for memory directories shared by several sub-projects.
- Worktree and nested-repository awareness; other local branches with unpushed work are listed.
- Read-only git commands are pre-approved through `allowed-tools`; the fast-forward pull is not, so
  the host still asks before the one write the skill can make.
- Memory backup comparison (`memory/` in the repository) now reports and proposes; it no longer syncs
  on its own.

### Packaging

- npm package `@woody_s/session-skills` with an installer CLI (`install`, `status`, `uninstall`;
  `--agent claude|codex|all`, `--scope user|project`, `--force` with backups).
- Claude Code plugin and single-repository marketplace (`claude plugin marketplace add
  ChiwooSong/session-skills`).
- Compatible with the Agent Skills layout used by `npx skills add`.
- Tests for the installer, the skill contract, and the packed tarball; CI on Windows, Ubuntu and
  macOS; tag-triggered trusted publishing to npm with a GitHub release.

[1.0.0]: https://github.com/ChiwooSong/session-skills/releases/tag/v1.0.0
