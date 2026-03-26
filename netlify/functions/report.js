'use strict';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

// Preflight headers must NOT include Content-Type (empty 204 body).
const CORS_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const db = require('../../db');
const {
  validateReport,
  countSimilar,
  toCategory,
  RADIUS_BASE_KM,
  RADIUS_EXPAND_KM,
  MIN_RESULTS_THRESHOLD,
} = require('../../lib/statsEngine');

// ── Helper: guaranteed JSON response ─────────────────────────────────────────
function jsonResponse(statusCode, payload, headers = CORS_HEADERS) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event, context) => { // eslint-disable-line no-unused-vars
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS_PREFLIGHT_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method Not Allowed' });
    }

    // Netlify may base64-encode the body for binary-safe transport.
    let rawBody = event.body || '{}';
    if (event.isBase64Encoded) {
      rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    }

    // Parse JSON body
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error('[report] JSON parse error:', parseErr.message);
      return jsonResponse(400, { error: 'Érvénytelen JSON formátum.' });
    }

    // Guard against non-object body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse(400, { error: 'Érvénytelen kérés törzs.' });
    }

    const { latitude, longitude, fejfajas, faradsag } = body;

    // Validate all required fields
    if (!validateReport(latitude, longitude, fejfajas, faradsag)) {
      console.error('[report] Validation failed:', { latitude, longitude, fejfajas, faradsag });
      return jsonResponse(400, { error: 'Érvénytelen adatok. Ellenőrizd a koordinátákat és az értékeket (0–10).' });
    }

    // Persist and read back
    let recent;
    try {
      await db.insert({ timestamp: Date.now(), latitude, longitude, fejfajas, faradsag });
      recent = await db.getRecent();
    } catch (dbErr) {
      console.error('[report] DB error:', dbErr);
      return jsonResponse(500, { error: 'Adatbázis hiba. Próbáld újra.' });
    }

    // Compute result — guarded so a logic error here doesn't produce a silent 500
    let count  = countSimilar(recent, latitude, longitude, fejfajas, faradsag, RADIUS_BASE_KM);
    let radius = RADIUS_BASE_KM;

    // The entry just inserted counts itself — subtract it
    count = Math.max(0, count - 1);

    if (count < MIN_RESULTS_THRESHOLD) {
      const expandedCount = countSimilar(recent, latitude, longitude, fejfajas, faradsag, RADIUS_EXPAND_KM);
      const adjusted      = Math.max(0, expandedCount - 1);
      if (adjusted > count) {
        count  = adjusted;
        radius = RADIUS_EXPAND_KM;
      }
    }

    return jsonResponse(200, toCategory(count, radius));

  } catch (unexpectedErr) {
    // Catch-all: ensures the function never returns undefined or crashes silently.
    console.error('[report] Unexpected error:', unexpectedErr);
    return jsonResponse(500, { error: 'Belső szerverhiba.' });
  }
};

