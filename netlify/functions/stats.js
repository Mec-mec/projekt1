'use strict';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const db = require('../../db');
const {
  validateStats,
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
      headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const q        = event.queryStringParameters || {};
  const lat      = parseFloat(q.lat);
  const lon      = parseFloat(q.lon);
  const fejfajas = parseInt(q.fejfajas, 10);
  const faradsag = parseInt(q.faradsag, 10);

  if (!validateStats(lat, lon, fejfajas, faradsag)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Érvénytelen paraméterek.' }),
    };
  }

  let recent;
  try {
    recent = await db.getRecent();
  } catch (err) {
    console.error('DB error in stats:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Adatbázis hiba.' }),
    };
  }
  let count  = countSimilar(recent, lat, lon, fejfajas, faradsag, RADIUS_BASE_KM);
  let radius = RADIUS_BASE_KM;

  if (count < MIN_RESULTS_THRESHOLD) {
    const expanded = countSimilar(recent, lat, lon, fejfajas, faradsag, RADIUS_EXPAND_KM);
    if (expanded > count) { count = expanded; radius = RADIUS_EXPAND_KM; }
  }

  return {
    statusCode: 200,
    headers:    CORS_HEADERS,
    body:       JSON.stringify(toCategory(count, radius)),
  };
};
