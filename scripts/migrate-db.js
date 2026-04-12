
// #!/usr/bin/env node
/**
 * scripts/migrate-db.js
 *
 * One-time migration helper to detect duplicate db.json files across the project,
 * merge their contents (users, items, sessions) into the canonical database/db.json,
 * and create backups of any source files before writing.
 *
 * Usage:
 *   node scripts/migrate-db.js
 *
 * Safety:
 * - Creates timestamped backups under database/backups/
 * - Does not delete original files
 * - Merges by unique keys: users by id (fallback username), items by id, sessions by token
 */

const fs = require('fs-extra');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const canonicalDir = path.join(projectRoot, 'database');
const canonicalFile = path.join(canonicalDir, 'db.json');
const backupDir = path.join(canonicalDir, 'backups');

async function loadJsonIfExists(p) {
  try {
    if (!(await fs.pathExists(p))) return null;
    const raw = await fs.readFile(p, 'utf8');
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Warning: failed to read/parse ${p}: ${e.message}`);
    return null;
  }
}

function uniqueByKey(arr, keyFn) {
  const map = new Map();
  for (const it of (arr || [])) {
    try {
      const k = keyFn(it);
      if (k == null) continue;
      if (!map.has(k)) map.set(k, it);
    } catch (e) {
      // ignore problematic item
    }
  }
  return Array.from(map.values());
}

async function findAllDbJsons(root) {
  const results = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        await walk(p);
      } else if (e.isFile() && e.name === 'db.json') {
        results.push(p);
      }
    }
  }
  await walk(root);
  return results;
}

async function ensureDirs() {
  await fs.ensureDir(canonicalDir);
  await fs.ensureDir(backupDir);
}

async function backupFile(srcPath) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.basename(srcPath);
    const dest = path.join(backupDir, `${base}.${stamp}.bak.json`);
    await fs.copy(srcPath, dest);
    return dest;
  } catch (e) {
    console.warn(`backupFile failed for ${srcPath}: ${e.message}`);
    return null;
  }
}

async function mergeAndWrite(sources) {
  // Load canonical first (may be null)
  const canonical = (await loadJsonIfExists(canonicalFile)) || { users: [], items: [], sessions: [] };

  // Accumulate arrays
  let allUsers = Array.isArray(canonical.users) ? canonical.users.slice() : [];
  let allItems = Array.isArray(canonical.items) ? canonical.items.slice() : [];
  let allSessions = Array.isArray(canonical.sessions) ? canonical.sessions.slice() : [];

  for (const s of sources) {
    if (!s.path || !s.data) continue;
    const d = s.data;
    if (Array.isArray(d.users)) allUsers = allUsers.concat(d.users);
    if (Array.isArray(d.items)) allItems = allItems.concat(d.items);
    if (Array.isArray(d.sessions)) allSessions = allSessions.concat(d.sessions);
  }

  // Deduplicate users by id, fallback username (lowercased)
  const usersById = new Map();
  for (const u of allUsers) {
    const id = u && (u.id || u._id || null);
    const uname = u && u.username ? String(u.username).toLowerCase() : null;
    const key = id || `__uname:${uname}`;
    if (!usersById.has(key)) usersById.set(key, u);
  }
  const mergedUsers = Array.from(usersById.values());

  // Deduplicate items by id
  const itemsById = new Map();
  for (const it of allItems) {
    const id = it && (it.id || it._id || null);
    if (!id) continue;
    if (!itemsById.has(id)) itemsById.set(id, it);
  }
  const mergedItems = Array.from(itemsById.values());

  // Deduplicate sessions by token
  const sessionsByToken = new Map();
  for (const s of allSessions) {
    const token = s && s.token;
    if (!token) continue;
    if (!sessionsByToken.has(token)) sessionsByToken.set(token, s);
  }
  const mergedSessions = Array.from(sessionsByToken.values());

  // Normalize shape
  const final = {
    users: mergedUsers,
    items: mergedItems,
    sessions: mergedSessions
  };

  // Backup canonical before overwrite
  if (await fs.pathExists(canonicalFile)) {
    const b = await backupFile(canonicalFile);
    console.log(`Backed up existing canonical DB to: ${b}`);
  }

  // Write final DB atomically
  const tmp = path.join(canonicalDir, `.db.tmp.${Date.now()}`);
  await fs.writeFile(tmp, JSON.stringify(final, null, 2), 'utf8');
  await fs.move(tmp, canonicalFile, { overwrite: true });
  console.log(`Merged DB written to canonical file: ${canonicalFile}`);
  return final;
}

(async function main() {
  try {
    console.log('Starting DB migration scan...');

    await ensureDirs();

    const all = await findAllDbJsons(projectRoot);
    // Exclude canonical path itself if present
    const canonicalAbs = path.resolve(canonicalFile);
    const sources = [];

    for (const p of all) {
      const abs = path.resolve(p);
      if (abs === canonicalAbs) {
        console.log(`Found canonical DB at ${abs}`);
        continue;
      }
      console.log(`Found candidate DB file: ${abs}`);
      const data = await loadJsonIfExists(abs);
      if (!data) {
        console.log(`  -> file empty or invalid JSON, skipping: ${abs}`);
        continue;
      }
      // Backup each source before merging
      const b = await backupFile(abs);
      if (b) console.log(`  -> backed up source ${abs} to ${b}`);
      sources.push({ path: abs, data });
    }

    if (sources.length === 0) {
      console.log('No duplicate DB files found (only canonical or none). Nothing to merge.');
      // Ensure canonical exists (create empty if missing)
      if (!(await fs.pathExists(canonicalFile))) {
        const empty = { users: [], items: [], sessions: [] };
        await fs.writeJson(canonicalFile, empty, { spaces: 2 });
        console.log(`Created empty canonical DB at ${canonicalFile}`);
      }
      return process.exit(0);
    }

    // Also include canonical as source to preserve its content
    const canonicalData = await loadJsonIfExists(canonicalFile);
    if (canonicalData) sources.unshift({ path: canonicalFile, data: canonicalData });

    // Merge and write
    const merged = await mergeAndWrite(sources);

    // Report summary
    console.log('Migration summary:');
    console.log(`  users: ${Array.isArray(merged.users) ? merged.users.length : 0}`);
    console.log(`  items: ${Array.isArray(merged.items) ? merged.items.length : 0}`);
    console.log(`  sessions: ${Array.isArray(merged.sessions) ? merged.sessions.length : 0}`);
    console.log('Migration complete. Originals backed up under database/backups/. Please inspect and restart the server.');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(2);
  }
})();
