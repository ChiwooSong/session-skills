// Offline tarball smoke test: pack, install the tarball into a scratch consumer, run the CLI from it.
// Run through npm (npm run test:package) so npm_execpath is set.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { packageRoot, payload, skillNames } from '../lib/install.js';

const npmCli = process.env.npm_execpath;
assert.ok(npmCli && fs.existsSync(npmCli), 'Run this check with npm run test:package.');
const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'session-skills-package-'));

function execute(command, args, cwd = packageRoot, env = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120000, env: { ...process.env, ...env } });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  const packed = JSON.parse(execute(process.execPath, [npmCli, 'pack', '--json', '--ignore-scripts', '--pack-destination', temp]));
  assert.equal(packed.length, 1);
  const files = packed[0].files.map(entry => entry.path).sort();
  const expected = [
    'package.json', 'README.md', 'README.ko.md', 'CHANGELOG.md', 'LICENSE',
    'bin/session-skills.js', 'lib/install.js',
    '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.claude-plugin/icon.png',
    ...skillNames.map(name => `skills/${name}/SKILL.md`),
  ].sort();
  assert.deepEqual(files, expected, 'Tarball must contain exactly the distributable files.');
  const tarball = path.join(temp, packed[0].filename);

  const consumer = path.join(temp, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), '{"name":"session-skills-consumer","version":"0.0.0","private":true}\n');
  execute(process.execPath, [npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball], consumer);
  const script = path.join(consumer, 'node_modules', ...packed[0].name.split('/'), 'bin', 'session-skills.js');

  const project = path.join(temp, '한글 project');
  fs.mkdirSync(project);
  const output = execute(process.execPath, [script, 'install', '--agent', 'all', '--project', project]);
  assert.match(output, /^SUCCESS: Skill installation completed\./);
  assert.equal((output.match(/^installed:/gm) || []).length, 4);
  for (const host of ['.claude', '.agents']) {
    for (const name of skillNames) {
      for (const [relative, bytes] of payload(name)) {
        assert.ok(fs.readFileSync(path.join(project, host, 'skills', name, relative)).equals(bytes), `${host}/${name}/${relative} differs from the source tree`);
      }
    }
  }
  const home = path.join(temp, 'home');
  fs.mkdirSync(home);
  const user = execute(process.execPath, [script, 'install'], consumer, { SESSION_SKILLS_HOME: home });
  assert.equal((user.match(/^installed:/gm) || []).length, 2);
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/restartproj/SKILL.md')));
  assert.equal(fs.existsSync(path.join(home, '.agents')), false);
  console.log(`package smoke test passed: ${packed[0].filename} (${files.length} files)`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
