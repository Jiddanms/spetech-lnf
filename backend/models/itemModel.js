
// backend/models/itemModel.js
// Item model (lost/found) untuk Spetech LNF
// - Local dev: pakai db.json via lib/db.js
// - Production: gunakan env.DB (D1)

const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('../lib/db');

const DEFAULT_STATUS = 'pending';
const ALLOWED_STATUSES = ['pending', 'verified', 'completed', 'archived', 'deleted'];

async function createItem(data = {}, env = null) {
  const { name, description, location, contact = '', photo = null, type = 'lost' } = data;
  if (!name || !description || !location) throw new Error('Field wajib: name, description, location');

  const id = uuidv4();
  const now = new Date().toISOString();
  const item = { id, name, description, location, contact, photo, type, status: DEFAULT_STATUS, createdAt: now, updatedAt: now };

  if (env && env.DB) {
    await env.DB.prepare(
      "INSERT INTO items (id, name, description, location, contact, photo, type, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, name, description, location, contact, photo, type, DEFAULT_STATUS, now, now).run();
    return item;
  } else {
    const db = await readDb();
    db.items = db.items || [];
    db.items.unshift(item);
    await writeDb(db);
    return item;
  }
}

async function listItems(filter = {}, env = null) {
  const { type, status, includeDeleted = false } = filter;
  if (env && env.DB) {
    let sql = "SELECT * FROM items WHERE 1=1";
    const binds = [];
    if (!includeDeleted) { sql += " AND status != ?"; binds.push('deleted'); }
    if (type) { sql += " AND type = ?"; binds.push(type); }
    if (status && status !== 'all') { sql += " AND status = ?"; binds.push(status); }
    sql += " ORDER BY createdAt DESC";
    const res = await env.DB.prepare(sql).bind(...binds).all();
    return res.results;
  } else {
    const db = await readDb();
    let items = db.items || [];
    if (!includeDeleted) items = items.filter(i => i.status !== 'deleted');
    if (type) items = items.filter(i => i.type === type);
    if (status && status !== 'all') items = items.filter(i => i.status === status);
    return items;
  }
}

async function getItemById(id, env = null) {
  if (env && env.DB) {
    return await env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(id).first();
  } else {
    const db = await readDb();
    return (db.items || []).find(i => i.id === id) || null;
  }
}

async function updateItem(id, updates = {}, env = null) {
  if (env && env.DB) {
    const fields = [];
    const binds = [];
    for (const [k, v] of Object.entries(updates)) {
      if (['name','description','location','contact','photo','status','type'].includes(k)) {
        fields.push(`${k} = ?`);
        binds.push(v);
      }
    }
    if (!fields.length) return null;
    const updatedAt = new Date().toISOString();
    fields.push("updatedAt = ?");
    binds.push(updatedAt);
    binds.push(id);
    await env.DB.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
    return await getItemById(id, env);
  } else {
    const db = await readDb();
    const idx = db.items.findIndex(i => i.id === id);
    if (idx === -1) return null;
    Object.assign(db.items[idx], updates, { updatedAt: new Date().toISOString() });
    await writeDb(db);
    return db.items[idx];
  }
}

async function softDeleteItem(id, env = null) {
  return updateItem(id, { status: 'deleted' }, env);
}

async function recentItems({ type, limit = 8 } = {}, env = null) {
  const items = await listItems({ type, includeDeleted: false }, env);
  return items.slice(0, limit);
}

module.exports = { createItem, listItems, getItemById, updateItem, softDeleteItem, recentItems, ALLOWED_STATUSES, DEFAULT_STATUS };
