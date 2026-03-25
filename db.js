'use strict';

/**
 * Ultra-simple JSON-file store – no native modules required.
 *
 * Schema: an array of entry objects persisted to data.json.
 * Each entry: { timestamp, latitude, longitude, fejfajas, faradsag }
 *
 * Old entries (> TIME_WINDOW_MS) are pruned on every write so the file
 * stays small indefinitely.
 */

const fs   = require('fs');
const path = require('path');

const DATA_PATH      = path.join(__dirname, 'data.json');
const TIME_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours – keep in sync with server.js

// ── Internal helpers ──────────────────────────────────────────────────────────

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function save(entries) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(entries), 'utf8');
}

/** Remove entries older than TIME_WINDOW_MS */
function prune(entries) {
  const cutoff = Date.now() - TIME_WINDOW_MS;
  return entries.filter((e) => e.timestamp >= cutoff);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Insert a new entry. Prunes stale entries on every write.
 */
function insert(entry) {
  const entries = prune(load());
  entries.push(entry);
  save(entries);
}

/**
 * Return all entries within the active time window.
 */
function getRecent() {
  return prune(load());
}

module.exports = { insert, getRecent };
