---
name: restartproj
description: >-
  Resume work on a project after a break: brief the user on where things stand from git history,
  uncommitted changes, remote sync state and the handoff note saved by /handoff, then propose where to
  pick up. Read-only apart from an optional fast-forward pull. Use at the start of a session when the
  user says "/restartproj", "restart project", "where were we", "what was I doing", "pick up where we
  left off", "resume", "catch me up", "status briefing", "다시 시작", "이어서 하자", "어디까지 했지",
  "작업 재개", "현황 브리핑", or returns to a project after time away. Pairs with /handoff.
argument-hint: "[--no-pull] [--no-fetch] [path]"
allowed-tools:
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git show:*)
  - Bash(git stash list:*)
  - Bash(git stash show:*)
  - Bash(git branch:*)
  - Bash(git rev-parse:*)
  - Bash(git remote:*)
  - Bash(git fetch:*)
  - Bash(git worktree list:*)
  - Bash(git for-each-ref:*)
license: MIT
metadata:
  version: "1.0.0"
  pairs-with: handoff
---

# restartproj — resume briefing from git history and the handoff note

Brief the user on "where did we stop, and what state is the project in now", so they can continue
without re-reading everything. This is read-only: the only write is an optional fast-forward pull, and
only when nothing forbids it.

Respond in the user's language. Narrate; do not dump command output or list hashes. When reading
diffs, explain what was being done, not which files changed.

## 0. Orient

- Project root: the `path` argument if one was given, else `git rev-parse --show-toplevel` from the
  working directory. If the working directory is not inside a git repository, skip steps 1–3 and go to
  step 4: the handoff note may be the only evidence.
- Arguments: `--no-pull` means never pull. `--no-fetch` means do not touch the network at all, which
  also implies `--no-pull`. Arguments: $ARGUMENTS
- Pull guardrails: before any fetch or pull, check the project's instructions (CLAUDE.md, project
  memory, the handoff note) for rules such as "do not pull", "HEAD pinned to <sha>", or "no network".
  Obey them and say so in the briefing. A repository pinned to a commit for review must not move just
  because a briefing was requested.
- Worktrees and nested repositories (`git worktree list`): if the working directory is a linked worktree
  or a repository nested inside another, say which repository is being briefed.

Steps 1–3 are independent; run them in parallel.

## 1. History — what was done

```
git log -15 --date=short --format='%h %ad %s'
```

Read the last 15 commits as a story: which features or bugs, in what order, and how long ago
(`git log -1 --format=%cr` gives the age of the last commit). If messages are terse, add
`git log --stat -5` or `git show --stat <hash>`.

## 2. Working tree — what was in progress

```
git status
git diff HEAD --stat
git stash list
```

- If anything is modified or staged, read the actual diff (`git diff HEAD`, in chunks when large) and
  explain what was being done and whether it looks finished.
- Separate intentional edits from generated noise: lockfiles, formatter output, build artifacts,
  migrations run by tooling.
- If stashes exist, inspect them with `git stash show -p stash@{N}` and include what they hold.
- Mention untracked files, distinguishing new source from scratch output.

## 3. Remote — do we need to sync

```
git fetch --all --prune                 (skip with --no-fetch)
git status -sb
git log --oneline HEAD..@{u}            (incoming)
git log --oneline @{u}..HEAD            (unpushed)
git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads
```

- Behind, clean tree, no guardrail, no `--no-pull`: run `git pull --ff-only`.
- Behind with a dirty tree: do not pull. Report the incoming commits and let the user decide; a pull
  that touches the edited files would fail or tangle their work.
- Diverged: never pull. Report both sides and wait for the user.
- Ahead: list the unpushed commits. Never push.
- No upstream: say so.
- Other local branches with unpushed work: one line each.

## 4. Handoff note — why, and what next

Find `handoff.md`: first in the project memory directory announced in this session's system prompt
(`MEMORY.md` carries a pointer), else at `<repo-root>/.claude/handoff.md`. If there is none, say so and
continue.

Read "Latest session" first. Accept legacy notes with Korean headings (최신 세션 / 최근 세션 / 이전 이력).

- Project match: a memory directory may serve several sub-projects. If the latest entry's project tag
  is not this repository, say so and use the most recent entry that matches; the latest entry may still
  get one line.
- Staleness: if the note's frontmatter has `head`, run `git log --oneline <head>..HEAD`. Commits after
  the note mean work happened without a new handoff: say what those commits did, and trust git for
  facts and the note for intent. If `head` equals HEAD and the tree is clean, the note is current.
- The note is the only trace of discussion-only sessions (no commits, clean tree). When git is quiet,
  the note carries the briefing.

## 5. Project status documents (if any)

If the project keeps a backlog or status document named in CLAUDE.md or memory, compare it with the
recent commits and point out completed work not yet reflected there. Otherwise skip silently.

## 6. Memory backup in the repository (if any)

If the repository contains `memory/MEMORY.md` (a committed backup of the global memory used across
machines), compare it with the global memory directory and report which side is newer (last commit date
versus file modification times) and what differs. Do not sync on your own: propose the direction and
perform it only when the user asks. Overwriting memory silently is worse than a stale copy.

## Briefing format

One compact briefing:

1. **Last work** — 2–4 sentences from the commits, as a narrative with rough timing.
2. **Working tree** — what the uncommitted changes are doing and whether they look complete, or "clean".
3. **Remote** — fetched or pulled or not, and why; unpushed commits.
4. **Since the handoff note** — what the note says to resume, and whether git moved after it.
5. **Resume point** — at most two candidates, most likely first, each with a concrete first step: a
   file to open, a test to run, a decision to make.

Keep it under about 250 words unless the diff genuinely needs more. Put the resume point last, so it is
the last thing read.

## Never

- commit, push, rebase, merge, stash, stash pop, reset, or check out files: nothing that changes
  history or the working tree, the fast-forward pull excepted
- discard or stash uncommitted changes
- pull when the tree is dirty, when the branches diverged, or when a project rule forbids it
- edit the handoff note: that is `/handoff`'s job
