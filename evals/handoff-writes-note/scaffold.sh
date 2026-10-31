#!/usr/bin/env bash
# A minimal repository so the note can record project, branch and head anchors.
set -eu
git init -q -b main .
git config user.email eval@example.com
git config user.name Eval
printf '# chatbot-backend\n' > README.md
mkdir -p services
printf 'def stream(request):\n    pass\n' > chat.py
git add -A
git commit -qm "chore: scaffold backend"
