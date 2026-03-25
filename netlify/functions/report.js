'use strict';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
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

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Érvénytelen JSON.' }),
    };
  }

  const { latitude, longitude, fejfajas, faradsag } = body;

  if (!validateReport(latitude, longitude, fejfajas, faradsag)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Érvénytelen adatok.' }),
    };
  }

  let recent;
  try {
    await db.insert({ timestamp: Date.now(), latitude, longitude, fejfajas, faradsag });
    recent = await db.getRecent();
  } catch (err) {
    console.error('DB error in report:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Adatbázis hiba.' }),
    };
  }

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

  return {
    statusCode: 200,
    headers:    CORS_HEADERS,
    body:       JSON.stringify(toCategory(count, radius)),
  };
};
