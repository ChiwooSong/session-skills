---
name: handoff
description: >-
  Save a session handoff note before a conversation ends, so the next session can resume without
  re-explaining. Compresses what was discussed, decided, tried-and-abandoned, and what to do next into
  the project memory (handoff.md), weighting the newest session highest. Use whenever the user wants to
  wrap up or save context for next time: "/handoff", "handoff", "wrap up", "save where we are",
  "summarize for next session", "save context for next time", "세션 정리", "여기까지 저장",
  "다음에 이어서 하게 정리", "핸드오프", "인수인계". Pairs with /restartproj, which reads the note.
argument-hint: "[notes to emphasize in the summary]"
license: MIT
metadata:
  version: "1.0.0"
  pairs-with: restartproj
---

# handoff — save a session handoff note

Run this right before a conversation ends, or before its context is about to be compacted. It writes a
compact, recency-weighted note that a future session reads first, through `/restartproj` or directly.
Git already records *what* was committed; this note preserves what only the conversation knows: *why*,
what was tried and dropped, and what comes next.

Respond in the user's language and write the note body in the language the conversation used. Keep the
section headings exactly as given below: `/restartproj` looks for them.

## What belongs in the note

Keep: decisions and the reasons behind them; approaches tried and abandoned, so the next session does
not repeat them; constraints, preferences and deadlines the user stated; open questions; the concrete
next action.

Leave out: code diffs, whole file contents, facts already fixed by commits (git is the source of truth),
and secrets (tokens, keys, passwords, personal data). If the host's memory guidance says not to store
transient conversation state, this skill is the deliberate exception: continuity is its entire purpose.

## Procedure

### 1. Locate the note

Use the first that applies:

1. The project memory directory announced in this session's system prompt (the directory that holds
   `MEMORY.md`). Target `<memory-dir>/handoff.md`.
2. Otherwise `<repo-root>/.claude/handoff.md` (create `.claude/` if needed). This file is committable;
   say so in the report so the user can decide whether to commit or gitignore it.

Never hardcode the path: the memory directory changes per project and per machine. If the project's
instructions (CLAUDE.md) name a handoff path, that path wins.

Note that hosts usually key the memory directory by git root, so several sub-projects inside one
repository or workspace share a single `handoff.md`. That is fine: every entry is tagged with its project.

### 2. Capture anchors

Collect quickly, skipping anything unavailable:

- today's date (from the system prompt)
- project: basename of `git rev-parse --show-toplevel`, else basename of the working directory
- branch and HEAD: `git rev-parse --abbrev-ref HEAD` and `git rev-parse --short HEAD`
- working tree: `clean`, or the number of entries in `git status --porcelain`

With `head` recorded, `/restartproj` can list the commits made after this note and tell whether the
note has gone stale.

### 3. Write the session summary (150–400 words)

Order matters, because the first line is the one that gets read:

1. **Resume here:** the single most concrete next action (a file, a command, a decision awaiting the
   user), in one or two sentences. Supporting detail goes in the points below, not in this line.
2. Decisions made, and why.
3. Tried and abandoned, and why.
4. Constraints, preferences and deadlines the user stated.
5. Open questions or items waiting on the user.

If the user passed arguments, treat them as emphasis: make sure those points are captured, in the
user's own words where wording matters. Arguments: $ARGUMENTS

Prefer specifics (paths, names, numbers) over adjectives. "Refactor remaining" is useless; "extract
`chat.py` lines 301–770 into `services/chat_pipeline.py`, golden test first" is not.

### 4. Merge with recency weighting

Rewrite `handoff.md` in exactly this shape:

```markdown
---
name: handoff
description: Session handoff notes for this project. Read first when resuming earlier work.
metadata:
  type: project
  updated: YYYY-MM-DD
  project: <project>
  branch: <branch>
  head: <short sha>
  dirty: <clean | N files>
---

## Latest session (YYYY-MM-DD · <project> · <branch>@<sha>)

<the step 3 summary, full detail>

## Recent sessions

- (YYYY-MM-DD · <project>) <the previous "Latest session", compressed to 2–3 sentences>
- (YYYY-MM-DD · <project>) <the one before, likewise>
(at most 4 bullets)

## Earlier history

<one paragraph, at most 10 sentences, merging everything that fell out of "Recent sessions">
```

Merge rules:

1. Compress the existing "Latest session" into a 2–3 sentence bullet and put it at the top of
   "Recent sessions", keeping its date and project tag.
2. If "Recent sessions" then has more than 4 bullets, fold the oldest into "Earlier history". Rewrite
   that paragraph so it stays one paragraph; do not append to it.
3. Put the new summary into "Latest session" and refresh the frontmatter anchors.
4. Keep the whole file under about 900 words. If it is longer, compress "Earlier history" first, then
   the older bullets. Never trim "Latest session" to meet the budget.
5. Same-day re-run: if "Latest session" already carries today's date and the same project, merge the
   new material into it instead of demoting it.
6. Legacy notes, with Korean headings (최신 세션 / 최근 세션 / 이전 이력) or without frontmatter anchors:
   read them as the corresponding sections and write the file back in the shape above.
7. First note for a project: keep all three headings and put `(none yet)` under the two lower ones,
   so the file has the same shape from day one.

This is how "the newest weighs the most" is implemented: information loses resolution gradually as it
ages, instead of piling up unread or being dropped.

### 5. Index pointer

If the note lives in a memory directory that keeps a `MEMORY.md` index, make sure the index contains
this line once (add it if missing, otherwise leave the index alone):

`- [Session Handoff](handoff.md) — cross-session handoff note; read first when resuming earlier work.`

### 6. Report

One or two sentences: the "Resume here" line and the file path. Do not echo the whole note into the chat.

## Next session

Nothing runs automatically. `/restartproj` reads this note, and a new session whose request looks like
a continuation should read "Latest session" first; unrelated work can ignore it. If the user wants the
note injected on every start, a SessionStart hook can read the file. Set that up only on request, since
it changes the user's global settings.

## Do not

- paste diffs or file contents into the note
- let "Latest session" entries accumulate without the step 4 merge
- include secrets or personal data
- re-record what the commits already say
