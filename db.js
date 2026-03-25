'use strict';

/**
 * Netlify Blobs store – replaces the local data.json file store.
 *
 * Schema: a JSON array persisted under the key 'data' in the 'entries' store.
 * Each entry: { timestamp, latitude, longitude, fejfajas, faradsag }
 *
 * Old entries (> TIME_WINDOW_MS) are pruned on every write.
 * Requires: @netlify/blobs  (auto-configured in Netlify Functions & netlify dev)
 */

const { getStore }   = require('@netlify/blobs');

const TIME_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
const BLOB_KEY       = 'data';

// ── Internal helpers ──────────────────────────────────────────────────────────

function store() {
  return getStore('entries');
}

async function load() {
  try {
    const raw = await store().get(BLOB_KEY);
    if (raw === null) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function save(entries) {
  await store().set(BLOB_KEY, JSON.stringify(entries));
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
