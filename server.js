'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Constants ────────────────────────────────────────────────────────────────
const TIME_WINDOW_MS   = 3 * 60 * 60 * 1000; // 3 hours
const RADIUS_BASE_KM   = 30;
const RADIUS_EXPAND_KM = 65;
const MIN_RESULTS_THRESHOLD = 5; // expand radius if fewer than this many found
const SIMILARITY_DELTA = 2;      // +/- tolerance on each scale

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Haversine distance between two lat/lon points (result in km).
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

/**
 * Count entries similar in state within a given radius during the active
 * time window (data already filtered to recent by db.getRecent()).
 */
function countSimilar(allEntries, lat, lon, fejfajas, faradsag, radiusKm) {
  const minFej = fejfajas - SIMILARITY_DELTA;
  const maxFej = fejfajas + SIMILARITY_DELTA;
  const minFar = faradsag - SIMILARITY_DELTA;
  const maxFar = faradsag + SIMILARITY_DELTA;

  return allEntries.filter((e) =>
    e.fejfajas >= minFej && e.fejfajas <= maxFej &&
    e.faradsag >= minFar && e.faradsag <= maxFar &&
    haversine(lat, lon, e.latitude, e.longitude) <= radiusKm
  ).length;
}

/**
 * Map a raw count + radius to a human-readable category object.
 */
function toCategory(count, radiusKm) {
  let label, level;
  if (count === 0) {
    label = 'Egyedül érzed így';
    level = 'none';
  } else if (count < 5) {
    label = 'Kevesen érzik így';
    level = 'few';
  } else if (count < 20) {
    label = 'Sokan érzik így';
    level = 'many';
  } else {
    label = 'Nagyon sokan érzik így';
    level = 'very-many';
  }
  return { count, label, level, radiusKm };
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/report
 * Body: { latitude, longitude, fejfajas, faradsag }
 * Returns: stats about similar nearby users.
 */
app.post('/api/report', (req, res) => {
  const { latitude, longitude, fejfajas, faradsag } = req.body;

  // Validate
  if (
    typeof latitude  !== 'number' || latitude  < -90  || latitude  > 90  ||
    typeof longitude !== 'number' || longitude < -180 || longitude > 180 ||
    typeof fejfajas  !== 'number' || !Number.isInteger(fejfajas)  ||
    fejfajas  < 0 || fejfajas  > 10 ||
    typeof faradsag  !== 'number' || !Number.isInteger(faradsag)  ||
    faradsag  < 0 || faradsag  > 10
  ) {
    return res.status(400).json({ error: 'Érvénytelen adatok.' });
  }

  // Persist entry
  db.insert({ timestamp: Date.now(), latitude, longitude, fejfajas, faradsag });

  // Load recent entries (includes the one just inserted)
  const recent = db.getRecent();

  // Query with base radius; expand if too few results
  let count  = countSimilar(recent, latitude, longitude, fejfajas, faradsag, RADIUS_BASE_KM);
  let radius = RADIUS_BASE_KM;

  // Exclude the just-inserted entry from the count (it counts itself)
  count = Math.max(0, count - 1);

  if (count < MIN_RESULTS_THRESHOLD) {
    const expandedCount = countSimilar(recent, latitude, longitude, fejfajas, faradsag, RADIUS_EXPAND_KM);
    const adjusted      = Math.max(0, expandedCount - 1);
    if (adjusted > count) {
      count  = adjusted;
      radius = RADIUS_EXPAND_KM;
    }
  }

  return res.json(toCategory(count, radius));
});

/**
 * GET /api/stats
 * Query: lat, lon, fejfajas, faradsag
 * Non-persistent lookup (read-only, for future use).
 */
app.get('/api/stats', (req, res) => {
  const lat      = parseFloat(req.query.lat);
  const lon      = parseFloat(req.query.lon);
  const fejfajas = parseInt(req.query.fejfajas, 10);
  const faradsag = parseInt(req.query.faradsag, 10);

  if (
    isNaN(lat) || lat < -90  || lat > 90  ||
    isNaN(lon) || lon < -180 || lon > 180 ||
    isNaN(fejfajas) || fejfajas < 0 || fejfajas > 10 ||
    isNaN(faradsag) || faradsag < 0 || faradsag > 10
  ) {
    return res.status(400).json({ error: 'Érvénytelen paraméterek.' });
  }

  const recent  = db.getRecent();
  let count  = countSimilar(recent, lat, lon, fejfajas, faradsag, RADIUS_BASE_KM);
  let radius = RADIUS_BASE_KM;

  if (count < MIN_RESULTS_THRESHOLD) {
    const expanded = countSimilar(recent, lat, lon, fejfajas, faradsag, RADIUS_EXPAND_KM);
    if (expanded > count) { count = expanded; radius = RADIUS_EXPAND_KM; }
  }

  return res.json(toCategory(count, radius));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Fejfajas.hu szerver fut: http://localhost:${PORT}`);
});
