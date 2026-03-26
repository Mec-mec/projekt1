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

// Top-level require so Netlify's static bundler (nft/zisi) always
// includes the package in the function bundle.
let _netlifyBlobsGetStore = null;
try {
  _netlifyBlobsGetStore = require('@netlify/blobs').getStore;
} catch {
  // Package not available – will fall back to file store.
}

const TIME_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
const BLOB_KEY       = 'data';
const DATA_FILE      = path.join(__dirname, 'data.json');

// NETLIFY is set in both build and function-invocation environments.
// NETLIFY_LOCAL is set by `netlify dev`.
const IS_NETLIFY = !!(process.env.NETLIFY || process.env.NETLIFY_LOCAL)
                   && _netlifyBlobsGetStore !== null;

// ── Blob helpers (Netlify only) ───────────────────────────────────────────────

function blobStore() {
  return _netlifyBlobsGetStore('entries');
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
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fileSave(entries) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch (err) {
    console.error('File save error:', err);
    throw err;
  }
}

// ── Unified helpers ───────────────────────────────────────────────────────────

async function load() {
  if (IS_NETLIFY) {
    try { return await blobLoad(); } catch (err) {
      console.error('Blob load error:', err);
      return [];
    }
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
  return entries.filter((e) => typeof e.timestamp === 'number' && e.timestamp >= cutoff);
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
