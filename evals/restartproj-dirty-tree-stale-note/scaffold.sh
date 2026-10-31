#!/usr/bin/env bash
# Builds a small repository with one commit after the handoff note and unfinished work in the tree.
set -eu
git init -q -b main .
git config user.email eval@example.com
git config user.name Eval
printf '# demo\n\nA tiny math module used to exercise /restartproj.\n' > README.md
mkdir -p src
printf 'export function add(a, b) { return a + b; }\n' > src/math.js
git add -A
git commit -qm "feat: add math module with add()"
head1=$(git rev-parse --short HEAD)
printf 'export function add(a, b) { return a + b; }\nexport function sub(a, b) { return a - b; }\n' > src/math.js
git commit -qam "feat: add sub()"
mkdir -p .claude
cat > .claude/handoff.md <<NOTE
---
name: handoff
description: Session handoff notes for this project. Read first when resuming earlier work.
metadata:
  type: project
  updated: 2026-10-20
  project: demo
  branch: main
  head: ${head1}
  dirty: clean
---

## Latest session (2026-10-20 · demo · main@${head1})

**Resume here:** implement \`sub\` in src/math.js, then add \`mul\` with tests in tests/math.test.js.

Decided to keep the module dependency-free: callers only need plain functions. Tried a class-based
API (MathKit) and dropped it because every caller only needed one function at a time.

## Recent sessions

- (2026-10-18 · demo) Set up the repository and chose plain ES modules over TypeScript for now.

## Earlier history

Nothing earlier.
NOTE
printf 'export function add(a, b) { return a + b; }\nexport function sub(a, b) { return a - b; }\nexport function mul(a, b) {\n  // TODO: handle non-number inputs\n}\n' > src/math.js
