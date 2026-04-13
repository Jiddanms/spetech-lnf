
// backend/models/userModel.js
// User model untuk Spetech LNF
// - Local dev: pakai db.json via lib/db.js
// - Production: gunakan env.DB (D1 binding)
// - Mengembalikan user tanpa password untuk response publik

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('../lib/db');

const SALT_ROUNDS = 10;

async function createUser({ username, password, role = 'user' }, env = null) {
  if (!username || !password) throw new Error('Username dan password wajib');
  const id = uuidv4();
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date().toISOString();

  if (env && env.DB) {
    const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (exists) throw new Error('Username sudah ada');
    await env.DB.prepare(
      "INSERT INTO users (id, username, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, username, hashed, role, now, now).run();
    return { id, username, role, createdAt: now };
  } else {
    const db = await readDb();
    db.users = db.users || [];
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) throw new Error('Username sudah ada');
    const user = { id, username, passwordHash: hashed, role, createdAt: now, updatedAt: now };
    db.users.push(user);
    await writeDb(db);
    return { id, username, role, createdAt: now };
  }
}

async function findUserByUsername(username, env = null) {
  if (!username) return null;
  if (env && env.DB) {
    return await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  } else {
    const db = await readDb();
    return (db.users || []).find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }
}

async function getUserSafe(id, env = null) {
  if (env && env.DB) {
    const u = await env.DB.prepare("SELECT id, username, role, createdAt FROM users WHERE id = ?").bind(id).first();
    return u || null;
  } else {
    const db = await readDb();
    const u = (db.users || []).find(x => x.id === id);
    return u ? { id: u.id, username: u.username, role: u.role, createdAt: u.createdAt } : null;
  }
}

async function authenticateUser(username, password, env = null) {
  const user = await findUserByUsername(username, env);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash || user.password);
  if (!match) return null;
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

async function listUsers({ includePasswords = false } = {}, env = null) {
  if (env && env.DB) {
    const res = await env.DB.prepare("SELECT * FROM users").all();
    const users = res.results || [];
    return includePasswords ? users : users.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }));
  } else {
    const db = await readDb();
    const users = db.users || [];
    return includePasswords ? users : users.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }));
  }
}

async function updateUserRole(id, newRole, env = null) {
  if (!id || !newRole) throw new Error('id dan newRole wajib');
  const now = new Date().toISOString();
  if (env && env.DB) {
    await env.DB.prepare("UPDATE users SET role = ?, updatedAt = ? WHERE id = ?").bind(newRole, now, id).run();
    return await getUserSafe(id, env);
  } else {
    const db = await readDb();
    const idx = (db.users || []).findIndex(u => u.id === id);
    if (idx === -1) return null;
    db.users[idx].role = newRole;
    db.users[idx].updatedAt = now;
    await writeDb(db);
    return { id: db.users[idx].id, username: db.users[idx].username, role: db.users[idx].role };
  }
}

async function deleteUser(id, env = null) {
  if (!id) throw new Error('id wajib');
  if (env && env.DB) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE userId = ?").bind(id).run();
    return true;
  } else {
    const db = await readDb();
    const idx = (db.users || []).findIndex(u => u.id === id);
    if (idx === -1) return false;
    db.users.splice(idx, 1);
    await writeDb(db);
    return true;
  }
}

async function seedDefaultUsers({ adminPassword = 'admin123', userPassword = 'user123' } = {}, env = null) {
  const created = [];
  const hasAdmin = await findUserByUsername('admin', env);
  const hasUser = await findUserByUsername('user', env);
  if (!hasAdmin) {
    const admin = await createUser({ username: 'admin', password: adminPassword, role: 'admin' }, env);
    created.push(admin);
  }
  if (!hasUser) {
    const user = await createUser({ username: 'user', password: userPassword, role: 'user' }, env);
    created.push(user);
  }
  return created;
}

module.exports = {
  createUser,
  findUserByUsername,
  getUserSafe,
  authenticateUser,
  listUsers,
  updateUserRole,
  deleteUser,
  seedDefaultUsers
};
