#!/usr/bin/env node
import fs from 'node:fs';
import { install, status, uninstall } from '../lib/install.js';

const metadata = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const help = `${metadata.name} ${metadata.version}

Install the /handoff and /restartproj skills for Claude Code or Codex.

Usage:
  session-skills install   [--agent claude|codex|all] [--scope user|project] [--project <dir>] [--force]
  session-skills status    [--agent claude|codex|all] [--scope user|project] [--project <dir>]
  session-skills uninstall [--agent claude|codex|all] [--scope user|project] [--project <dir>] [--force]
  session-skills --help | --version

Defaults: --agent claude, --scope user. Giving --project implies --scope project.
Destinations:
  claude  user: ~/.claude/skills/<skill>     project: <dir>/.claude/skills/<skill>
  codex   user: ~/.agents/skills/<skill>     project: <dir>/.agents/skills/<skill>
Identical installations are left untouched. Differing ones are never overwritten unless --force,
and --force moves the current files to <agent root>/skills-backups/session-skills/<timestamp>/ first.
Nothing else is read or changed: no settings, no model calls, no network.
`;

function parse(argv) {
  if (!argv.length || (argv.length === 1 && ['--help', '-h'].includes(argv[0]))) return { action: 'help' };
  if (argv.length === 1 && ['--version', '-v'].includes(argv[0])) return { action: 'version' };
  const [action, ...rest] = argv;
  if (!['install', 'status', 'uninstall'].includes(action)) throw new Error('Expected install, status, uninstall, --help, or --version.');
  const options = { action };
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (['--help', '-h'].includes(key)) return { action: 'help' };
    if (key === '--force') { options.force = true; continue; }
    const value = rest[index + 1];
    if (!['--agent', '--scope', '--project'].includes(key) || value === undefined || value.startsWith('--')) throw new Error(`Invalid option or missing value: ${key}`);
    const name = key.slice(2);
    if (Object.hasOwn(options, name)) throw new Error(`Duplicate option: ${key}`);
    options[name] = value;
    index += 1;
  }
  if (options.agent !== undefined && !['claude', 'codex', 'all'].includes(options.agent)) throw new Error('--agent must be claude, codex, or all.');
  if (options.scope !== undefined && !['user', 'project'].includes(options.scope)) throw new Error('--scope must be user or project.');
  if (options.scope === 'user' && options.project !== undefined) throw new Error('--project requires --scope project.');
  if (options.force && action === 'status') throw new Error('--force does not apply to status.');
  return options;
}

let options;
try { options = parse(process.argv.slice(2)); }
catch (error) { console.error(`ERROR: Invalid arguments. ${error.message}\n`); console.error(help); process.exitCode = 2; }

if (options?.action === 'help') console.log(help);
else if (options?.action === 'version') console.log(metadata.version);
else if (options) {
  const verb = { install: 'installation', uninstall: 'removal', status: 'status check' }[options.action];
  try {
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or later is required.');
    // SESSION_SKILLS_HOME redirects the user scope; used by the package tests, not documented for users.
    const home = process.env.SESSION_SKILLS_HOME || undefined;
    const run = { install, uninstall, status }[options.action];
    const results = run({ ...options, home });
    const changed = results.some(item => ['installed', 'replaced', 'removed', 'backed-up'].includes(item.status));
    if (options.action === 'status') console.log('STATUS: session-skills installations');
    else if (changed) console.log(`SUCCESS: Skill ${verb} completed.`);
    else if (options.action === 'install') console.log('SUCCESS: Skill files already match this version. No changes needed.');
    else console.log('SUCCESS: Nothing to remove.');
    console.log(`CLI version: ${metadata.version}`);
    for (const item of results) {
      console.log(`${item.status}: ${item.directory}`);
      if (item.backup) console.log(`  previous files moved to: ${item.backup}`);
      if (item.status === 'differs' || item.status === 'kept') {
        console.log(`  differs from ${metadata.version}: ${item.differing.join(', ')}`);
      }
    }
    if (options.action === 'install') {
      if (results.some(item => item.agent === 'claude')) console.log('Next: start a new Claude Code session, then run /restartproj to resume and /handoff to wrap up.');
      if (results.some(item => item.agent === 'codex')) console.log('Next: start a new Codex session, then run $restartproj to resume and $handoff to wrap up.');
    }
    if (options.action === 'uninstall' && results.some(item => item.status === 'kept')) {
      console.log('Modified installations were kept. Re-run with --force to move them to a backup.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`ERROR: Skill ${verb} failed. ${error.message}`);
    process.exitCode = 1;
  }
}
