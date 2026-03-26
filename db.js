'use strict';

/**
 * Storage adapter:
 *   - Netlify environment (NETLIFY=true or NETLIFY_LOCAL=true):
 *       uses @netlify/blobs  (auto-configured in Netlify Functions & netlify dev)
 *   - Local / any other environment:
 *       falls back to data.json on disk
 *
 * Schema: a JSON array persisted under the key 'data'.
 * Each entry: { timestamp, latitude, longitude, fejfajas, faradsag }
 * Old entries (> TIME_WINDOW_MS) are pruned on every write.
 */

const path = require('path');
const fs   = require('fs');

const TIME_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
const BLOB_KEY       = 'data';
const DATA_FILE      = path.join(__dirname, 'data.json');

const IS_NETLIFY = !!(process.env.NETLIFY || process.env.NETLIFY_LOCAL);

// ── Blob helpers (Netlify only) ───────────────────────────────────────────────

function blobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore('entries');
}

async function blobLoad() {
  const raw = await blobStore().get(BLOB_KEY);
  if (raw === null) return [];
  return JSON.parse(raw);
}

async function blobSave(entries) {
  await blobStore().set(BLOB_KEY, JSON.stringify(entries));
}

// ── File helpers (local fallback) ─────────────────────────────────────────────

function fileLoad() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function fileSave(entries) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

// ── Unified helpers ───────────────────────────────────────────────────────────

async function load() {
  if (IS_NETLIFY) {
    try { return await blobLoad(); } catch { return []; }
  }
  return fileLoad();
}

async function save(entries) {
  if (IS_NETLIFY) {
    try {
      await blobSave(entries);
    } catch (err) {
      console.error('Blob save error:', err);
      throw err;
    }
  } else {
    fileSave(entries);
  }
}

function prune(entries) {
  const cutoff = Date.now() - TIME_WINDOW_MS;
  return entries.filter((e) => e.timestamp >= cutoff);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function insert(entry) {
  const entries = prune(await load());
  entries.push(entry);
  await save(entries);
}

async function getRecent() {
  return prune(await load());
}

module.exports = { insert, getRecent };
