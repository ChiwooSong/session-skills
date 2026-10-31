# Security Policy

Report vulnerabilities privately through GitHub:
<https://github.com/ChiwooSong/session-skills/security/advisories/new>. Do not post reproduction
steps in public issues. Only the latest 1.x release receives fixes.

## Scope

- The skills are Markdown instructions. They run no code of their own; the host AI runs git
  commands and reads or writes the handoff note on the user's machine under the host's permission
  system. `/restartproj` pre-approves only read-only git commands; the fast-forward pull still goes
  through the host's permission prompt.
- The installer copies files into the user's or project's skill directories. It makes no network
  requests, runs no scripts, and never deletes a modified installation (modified files are moved to
  a backup directory on `--force`).
- The handoff note is plain text written where the host keeps project memory, or in
  `.claude/handoff.md`. The skill instructs the model to leave secrets out, but the note is only as
  private as that location. Review it before committing it to a shared repository.

Anything the user does with their own files on their own machine, and the AI service's handling of
conversation data, is outside this policy.
