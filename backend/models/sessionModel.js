
// backend/models/sessionModel.js
// Session model untuk Spetech LNF
// - Local dev: db.json
// - Production: D1 (sessions table)

const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('../lib/db');

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 1 hari

async function createSession(userId, opts = {}, env = null) {
  const ttl = typeof opts.ttl === 'number' ? opts.ttl : DEFAULT_TTL;
  const now = Date.now();
  const token = uuidv4();
  const session = { token, userId, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + ttl).toISOString() };

  if (env && env.DB) {
    await env.DB.prepare("INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)")
      .bind(session.token, session.userId, session.createdAt, session.expiresAt).run();
    return session;
  } else {
    const db = await readDb();
    db.sessions = db.sessions || [];
    db.sessions.push(session);
    await writeDb(db);
    return session;
  }
}

async function getSession(token, env = null) {
  if (!token) return null;
  if (env && env.DB) {
    const s = await env.DB.prepare("SELECT * FROM sessions WHERE token = ?").bind(token).first();
    if (!s) return null;
    if (new Date(s.expiresAt) <= new Date()) {
      await deleteSession(token, env);
      return null;
    }
    return s;
  } else {
    const db = await readDb();
    const s = (db.sessions || []).find(x => x.token === token);
    if (!s) return null;
    if (new Date(s.expiresAt) <= new Date()) {
      await deleteSession(token);
      return null;
    }
    return s;
  }
}

async function deleteSession(token, env = null) {
  if (env && env.DB) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return true;
  } else {
    const db = await readDb();
    db.sessions = (db.sessions || []).filter(s => s.token !== token);
    await writeDb(db);
    return true;
  }
}

module.exports = { createSession, getSession, deleteSession, DEFAULT_TTL };
