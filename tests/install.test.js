import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { destinations, install, packageRoot, payload, readTree, skillNames, status, uninstall } from '../lib/install.js';

const cli = path.join(packageRoot, 'bin/session-skills.js');
const tempBase = fs.realpathSync(os.tmpdir());

function fixture(t) {
  const root = fs.mkdtempSync(path.join(tempBase, 'session-skills-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  assert.ifError(result.error);
  return result;
}

function assertPayload(directory, name) {
  const expected = payload(name);
  const actual = readTree(directory);
  assert.deepEqual([...actual.keys()], [...expected.keys()]);
  for (const [file, bytes] of expected) assert.ok(actual.get(file).equals(bytes), `${name}/${file} differs`);
}

test('payload contains exactly one SKILL.md per skill', () => {
  for (const name of skillNames) {
    const tree = payload(name);
    assert.ok(tree.has('SKILL.md'), `${name} is missing SKILL.md`);
    assert.ok(tree.get('SKILL.md').length > 500, `${name}/SKILL.md looks empty`);
  }
});

test('destinations follow the documented layout', t => {
  const home = fixture(t);
  const user = destinations({ agent: 'all', home });
  assert.deepEqual(user.map(item => path.relative(home, item.directory).split(path.sep).join('/')), [
    '.claude/skills/handoff', '.claude/skills/restartproj', '.agents/skills/handoff', '.agents/skills/restartproj',
  ]);
  const project = destinations({ agent: 'codex', project: home });
  assert.deepEqual(project.map(item => item.scope), ['project', 'project']);
  assert.equal(path.relative(home, project[0].directory).split(path.sep).join('/'), '.agents/skills/handoff');
});

for (const agent of ['claude', 'codex', 'all']) {
  test(`installs the exact payload for ${agent} in user scope`, t => {
    const home = fixture(t);
    const results = install({ agent, home });
    const agents = agent === 'all' ? ['claude', 'codex'] : [agent];
    assert.deepEqual(results.map(item => item.status), agents.flatMap(() => ['installed', 'installed']));
    for (const item of results) assertPayload(item.directory, item.name);
    if (agent === 'claude') assert.equal(fs.existsSync(path.join(home, '.agents')), false);
    if (agent === 'codex') assert.equal(fs.existsSync(path.join(home, '.claude')), false);
  });
}

test('repeat installation is a no-op that preserves bytes and mtimes', t => {
  const home = fixture(t);
  install({ agent: 'all', home });
  const before = destinations({ agent: 'all', home }).map(item => fs.statSync(path.join(item.directory, 'SKILL.md')).mtimeMs);
  const results = install({ agent: 'all', home });
  assert.deepEqual(results.map(item => item.status), ['unchanged', 'unchanged', 'unchanged', 'unchanged']);
  const after = destinations({ agent: 'all', home }).map(item => fs.statSync(path.join(item.directory, 'SKILL.md')).mtimeMs);
  assert.deepEqual(after, before);
});

test('a differing installation blocks install without --force and nothing is written', t => {
  const home = fixture(t);
  const [handoff] = destinations({ home });
  fs.mkdirSync(handoff.directory, { recursive: true });
  fs.writeFileSync(path.join(handoff.directory, 'SKILL.md'), '---\nname: handoff\n---\nuser version\n');
  assert.throws(() => install({ home }), /Nothing was installed[\s\S]*SKILL\.md/);
  assert.equal(fs.readFileSync(path.join(handoff.directory, 'SKILL.md'), 'utf8'), '---\nname: handoff\n---\nuser version\n');
  assert.equal(fs.existsSync(path.join(home, '.claude/skills/restartproj')), false, 'the other skill must not be installed when any conflict exists');
  const report = status({ home });
  assert.deepEqual(report.map(item => item.status), ['differs', 'missing']);
  assert.deepEqual(report[0].differing, ['SKILL.md']);
});

test('--force replaces a differing installation after moving it to a backup outside skill discovery', t => {
  const home = fixture(t);
  const [handoff] = destinations({ home });
  fs.mkdirSync(path.join(handoff.directory, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(handoff.directory, 'SKILL.md'), 'old');
  fs.writeFileSync(path.join(handoff.directory, 'notes/keep.md'), 'personal');
  const results = install({ home, force: true });
  assert.deepEqual(results.map(item => item.status), ['replaced', 'installed']);
  assertPayload(handoff.directory, 'handoff');
  const backup = results[0].backup;
  assert.ok(backup.startsWith(path.join(home, '.claude', 'skills-backups', 'session-skills')), backup);
  assert.equal(fs.readFileSync(path.join(backup, 'SKILL.md'), 'utf8'), 'old');
  assert.equal(fs.readFileSync(path.join(backup, 'notes/keep.md'), 'utf8'), 'personal');
  assert.deepEqual(fs.readdirSync(path.join(home, '.claude', 'skills')).sort(), ['handoff', 'restartproj'], 'no backup left inside the skills directory');
});

test('project scope installs under the project and never touches the home directory', t => {
  const home = fixture(t);
  const project = fixture(t);
  const results = install({ agent: 'all', project, home });
  assert.deepEqual(results.map(item => item.scope), ['project', 'project', 'project', 'project']);
  for (const item of results) assert.ok(item.directory.startsWith(project));
  assert.deepEqual(fs.readdirSync(home), []);
});

test('uninstall removes exact installations, keeps modified ones, and backs them up with --force', t => {
  const home = fixture(t);
  install({ agent: 'all', home });
  const [, restart] = destinations({ home });
  fs.appendFileSync(path.join(restart.directory, 'SKILL.md'), '\nlocal tweak\n');
  const first = uninstall({ agent: 'all', home });
  assert.deepEqual(first.map(item => item.status), ['removed', 'kept', 'removed', 'removed']);
  assert.equal(fs.existsSync(path.join(home, '.claude/skills/handoff')), false);
  assert.equal(fs.existsSync(path.join(home, '.agents/skills')), true, 'parent directories are not removed');
  const second = uninstall({ home, force: true });
  assert.deepEqual(second.map(item => item.status), ['absent', 'backed-up']);
  assert.ok(fs.existsSync(path.join(second[1].backup, 'SKILL.md')));
  assert.equal(fs.existsSync(restart.directory), false);
});

test('links at the destination are refused', t => {
  const home = fixture(t);
  const real = path.join(home, 'elsewhere');
  fs.mkdirSync(real);
  fs.mkdirSync(path.join(home, '.claude/skills'), { recursive: true });
  try { fs.symlinkSync(real, path.join(home, '.claude/skills/handoff'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip(`links unavailable: ${error.code}`); return; } throw error; }
  assert.throws(() => install({ home }), /link/);
  assert.deepEqual(fs.readdirSync(real), []);
});

test('missing project directory is an error before anything is written', t => {
  const home = fixture(t);
  assert.throws(() => install({ project: path.join(home, 'nope'), home }), /does not exist/);
  assert.deepEqual(fs.readdirSync(home), []);
});

test('CLI: help, version, and argument errors', () => {
  assert.match(run([]).stdout, /Usage:/);
  assert.match(run(['--help']).stdout, /--force/);
  const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
  assert.equal(run(['--version']).stdout.trim(), version);
  const invalid = [
    ['frobnicate'],
    ['install', '--agent'],
    ['install', '--agent', 'gemini'],
    ['install', '--scope', 'user', '--project', '.'],
    ['status', '--force'],
    ['install', '--agent', 'claude', '--agent', 'codex'],
  ];
  for (const args of invalid) {
    const result = run(args);
    assert.equal(result.status, 2, args.join(' '));
    assert.match(result.stderr, /^ERROR: Invalid arguments\./);
  }
});

test('CLI: install, status, conflict, force, uninstall round trip', t => {
  const home = fixture(t);
  const env = { SESSION_SKILLS_HOME: home };
  const installed = run(['install', '--agent', 'all'], env);
  assert.equal(installed.status, 0, installed.stderr);
  assert.match(installed.stdout, /^SUCCESS: Skill installation completed\./);
  assert.equal((installed.stdout.match(/^installed:/gm) || []).length, 4);
  assert.match(installed.stdout, /run \/restartproj/);
  assert.match(installed.stdout, /run \$restartproj/);

  const again = run(['install', '--agent', 'all'], env);
  assert.match(again.stdout, /^SUCCESS: Skill files already match this version\. No changes needed\./);

  fs.writeFileSync(path.join(home, '.claude/skills/handoff/SKILL.md'), 'edited');
  const report = run(['status', '--agent', 'all'], env);
  assert.equal(report.status, 0);
  assert.match(report.stdout, /^differs: .*handoff/m);
  assert.match(report.stdout, /^current: .*restartproj/m);

  const blocked = run(['install'], env);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /^ERROR: Skill installation failed\. Nothing was installed/);

  const forced = run(['install', '--force'], env);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /^replaced: .*handoff/m);
  assert.match(forced.stdout, /previous files moved to: .*skills-backups/);

  const removed = run(['uninstall', '--agent', 'all'], env);
  assert.equal(removed.status, 0, removed.stderr);
  assert.equal((removed.stdout.match(/^removed:/gm) || []).length, 4);
  assert.equal(fs.existsSync(path.join(home, '.claude/skills/handoff')), false);
});
