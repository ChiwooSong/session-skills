import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const skillNames = ['handoff', 'restartproj'];
export const agentNames = ['claude', 'codex'];
const agentRoots = { claude: '.claude', codex: '.agents' };

/** Read a directory into a Map of posix-relative path -> Buffer. Links are refused, never followed. */
export function readTree(directory) {
  const tree = new Map();
  (function visit(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Refusing to handle a link: ${full}`);
      if (entry.isDirectory()) visit(full, `${prefix}${entry.name}/`);
      else if (entry.isFile()) tree.set(`${prefix}${entry.name}`, fs.readFileSync(full));
      else throw new Error(`Unsupported entry: ${full}`);
    }
  })(directory, '');
  return tree;
}

export function payload(name) {
  if (!skillNames.includes(name)) throw new Error(`Unknown skill: ${name}`);
  return readTree(path.join(packageRoot, 'skills', name));
}

function differing(a, b) {
  return [...new Set([...a.keys(), ...b.keys()])]
    .filter(key => !a.has(key) || !b.has(key) || !a.get(key).equals(b.get(key)))
    .sort();
}

function lstatOrNull(target) {
  try { return fs.lstatSync(target); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function normalize({ agent = 'claude', scope, project, home = os.homedir(), skills = skillNames } = {}) {
  const resolvedScope = scope ?? (project ? 'project' : 'user');
  if (!['claude', 'codex', 'all'].includes(agent)) throw new Error('agent must be claude, codex, or all');
  if (!['user', 'project'].includes(resolvedScope)) throw new Error('scope must be user or project');
  for (const name of skills) if (!skillNames.includes(name)) throw new Error(`Unknown skill: ${name}`);
  const base = resolvedScope === 'project' ? path.resolve(project ?? process.cwd()) : path.resolve(home);
  const baseStat = lstatOrNull(base);
  if (!baseStat || !baseStat.isDirectory()) throw new Error(`${resolvedScope === 'project' ? 'Project' : 'Home'} directory does not exist: ${base}`);
  return { agents: agent === 'all' ? agentNames : [agent], scope: resolvedScope, base, skills };
}

/** Where each skill goes for the selected agents and scope. */
export function destinations(options) {
  const { agents, scope, base, skills } = normalize(options);
  return agents.flatMap(agent => skills.map(name => ({
    agent, name, scope,
    directory: path.join(base, agentRoots[agent], 'skills', name),
  })));
}

/** Compare every destination with this package's payload: missing | current | differs. */
export function status(options) {
  return destinations(options).map(item => {
    const info = lstatOrNull(item.directory);
    if (!info) return { ...item, status: 'missing' };
    if (info.isSymbolicLink()) throw new Error(`Destination is a link; refusing: ${item.directory}`);
    if (!info.isDirectory()) throw new Error(`Destination exists and is not a directory: ${item.directory}`);
    const diff = differing(readTree(item.directory), payload(item.name));
    return diff.length ? { ...item, status: 'differs', differing: diff } : { ...item, status: 'current' };
  });
}

function backupPath(directory, stamp) {
  // <agent root>/skills-backups/session-skills/<stamp>/<skill>: outside every skill discovery path.
  const agentRoot = path.dirname(path.dirname(directory));
  return path.join(agentRoot, 'skills-backups', 'session-skills', stamp, path.basename(directory));
}

function moveToBackup(directory, stamp) {
  const backup = backupPath(directory, stamp);
  if (lstatOrNull(backup)) throw new Error(`Backup destination already exists: ${backup}`);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.renameSync(directory, backup);
  return backup;
}

function writeTree(directory, tree) {
  fs.mkdirSync(directory, { recursive: true });
  for (const [relative, bytes] of tree) {
    const file = path.join(directory, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes, { flag: 'wx' });
  }
}

const stampNow = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Install the bundled skills. Differing installations are kept unless force, and then moved to a backup first. */
export function install(options = {}) {
  const plan = status(options);
  const conflicts = plan.filter(item => item.status === 'differs');
  if (conflicts.length && !options.force) {
    const detail = conflicts.map(item => `  ${item.directory}\n${item.differing.map(file => `    ${file}`).join('\n')}`).join('\n');
    throw new Error(`Nothing was installed. Existing skills differ from this release:\n${detail}\nRe-run with --force to replace them (the current files are moved to a backup first), or merge by hand.`);
  }
  const stamp = stampNow();
  return plan.map(item => {
    if (item.status === 'current') return { ...item, status: 'unchanged' };
    const backup = item.status === 'differs' ? moveToBackup(item.directory, stamp) : undefined;
    writeTree(item.directory, payload(item.name));
    return { agent: item.agent, name: item.name, scope: item.scope, directory: item.directory, status: backup ? 'replaced' : 'installed', backup };
  });
}

function removeEmptyDirectories(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) removeEmptyDirectories(path.join(directory, entry.name));
  }
  fs.rmdirSync(directory); // Not recursive: fails loudly if anything unexpected remains.
}

/** Remove installations that match this release exactly. Modified ones are kept unless force, and then backed up. */
export function uninstall(options = {}) {
  const stamp = stampNow();
  return status(options).map(item => {
    if (item.status === 'missing') return { ...item, status: 'absent' };
    if (item.status === 'differs') {
      if (!options.force) return { ...item, status: 'kept' };
      return { ...item, status: 'backed-up', backup: moveToBackup(item.directory, stamp) };
    }
    for (const relative of payload(item.name).keys()) fs.unlinkSync(path.join(item.directory, ...relative.split('/')));
    removeEmptyDirectories(item.directory);
    return { ...item, status: 'removed' };
  });
}
