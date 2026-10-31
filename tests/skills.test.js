import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { packageRoot, skillNames } from '../lib/install.js';

const read = relative => fs.readFileSync(path.join(packageRoot, relative), 'utf8');
const json = relative => JSON.parse(read(relative));

/** Minimal frontmatter reader: top-level `key: value` pairs, folded `>-` scalars, `- item` lists, and `metadata:` children. */
function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  assert.ok(match, 'SKILL.md must start with a frontmatter block');
  const fields = {};
  let current = null;
  for (const line of match[1].split(/\r?\n/)) {
    const top = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    const item = line.match(/^\s+-\s+(.+)$/);
    if (top) {
      current = top[1];
      fields[current] = top[2] === '>-' ? '' : top[2].replace(/^"(.*)"$/, '$1');
    } else if (current && item) {
      fields[current] = [...(Array.isArray(fields[current]) ? fields[current] : []), item[1].trim()];
    } else if (current && /^\s+\S/.test(line)) {
      fields[current] = `${fields[current]}${fields[current] ? ' ' : ''}${line.trim()}`;
    }
  }
  return { fields, body: match[2] };
}

const skills = Object.fromEntries(skillNames.map(name => [name, frontmatter(read(`skills/${name}/SKILL.md`))]));

for (const name of skillNames) {
  const { fields, body } = skills[name];
  test(`${name}: frontmatter follows the Agent Skills spec and Claude Code limits`, () => {
    assert.equal(fields.name, name, 'name must match the directory');
    assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(fields.name.length <= 64);
    assert.ok(fields.description.length >= 50 && fields.description.length <= 1024, `description length ${fields.description.length}`);
    assert.equal(fields.license, 'MIT');
    assert.ok(fields['argument-hint'], 'argument-hint helps the slash-command menu');
    assert.ok(body.split('\n').length < 500, 'keep SKILL.md under 500 lines');
    assert.ok(body.includes('$ARGUMENTS'), 'the body should consume $ARGUMENTS so arguments are not merely appended');
    assert.doesNotMatch(body, /\bMUST\b|\bNEVER\b|\bALWAYS\b/, 'explain the why instead of shouting');
  });

  test(`${name}: description carries English and Korean triggers and names its pair`, () => {
    assert.match(fields.description, /[가-힣]/, 'Korean trigger phrases');
    assert.match(fields.description, /\/(handoff|restartproj)/);
    assert.ok(fields.description.includes(name === 'handoff' ? '/restartproj' : '/handoff'));
  });
}

test('the two skills agree on the handoff note contract', () => {
  const handoff = skills.handoff.body;
  const restart = skills.restartproj.body;
  for (const heading of ['## Latest session', '## Recent sessions', '## Earlier history']) {
    assert.ok(handoff.includes(heading), `handoff writes "${heading}"`);
  }
  assert.ok(restart.includes('"Latest session"'), 'restartproj reads the Latest session block');
  for (const legacy of ['최신 세션', '최근 세션', '이전 이력']) {
    assert.ok(handoff.includes(legacy) && restart.includes(legacy), `both accept legacy heading ${legacy}`);
  }
  for (const anchor of ['head:', 'project:', 'branch:']) assert.ok(handoff.includes(anchor), `handoff records ${anchor}`);
  assert.ok(restart.includes('<head>..HEAD'), 'restartproj uses the recorded head for staleness');
  assert.ok(handoff.includes('.claude/handoff.md') && restart.includes('.claude/handoff.md'), 'both know the fallback location');
  assert.ok(handoff.includes('Resume here'), 'the first line of the note is the resume action');
});

test('restartproj pre-approves only read-only git commands', () => {
  const tools = skills.restartproj.fields['allowed-tools'];
  assert.ok(Array.isArray(tools) && tools.length >= 8, 'allowed-tools is a YAML list, which needs no paren-aware splitting');
  for (const tool of tools) assert.match(tool, /^Bash\(git (status|log|diff|show|stash list|stash show|branch|rev-parse|remote|fetch|worktree list|for-each-ref):\*\)$/, tool);
  assert.ok(!tools.some(tool => /pull|push|commit|reset|checkout|rebase|merge/.test(tool)), 'no mutating git command is pre-approved');
  assert.equal(skills.handoff.fields['allowed-tools'], undefined, 'handoff needs no pre-approval');
});

test('plugin, marketplace and package manifests agree', () => {
  const pkg = json('package.json');
  const plugin = json('.claude-plugin/plugin.json');
  const marketplace = json('.claude-plugin/marketplace.json');
  assert.equal(plugin.version, pkg.version);
  assert.equal(marketplace.metadata.version, pkg.version);
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, plugin.name);
  assert.equal(marketplace.plugins[0].version, pkg.version);
  assert.equal(marketplace.plugins[0].source, './');
  assert.equal(marketplace.name, plugin.name);
  assert.equal(pkg.name, `@woody_s/${plugin.name}`);
  assert.equal(plugin.license, pkg.license);
  for (const name of skillNames) assert.ok(fs.existsSync(path.join(packageRoot, 'skills', name, 'SKILL.md')));
  const changelog = read('CHANGELOG.md');
  assert.ok(changelog.includes(`## [${pkg.version}]`), 'CHANGELOG has an entry for the current version');
  for (const readme of ['README.md', 'README.ko.md']) {
    const text = read(readme);
    assert.ok(text.includes(pkg.name), `${readme} names the npm package`);
    assert.ok(text.includes('claude plugin marketplace add ChiwooSong/session-skills'), `${readme} documents the plugin channel`);
  }
});
