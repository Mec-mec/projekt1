'use strict';

const RADIUS_BASE_KM        = 30;
const RADIUS_EXPAND_KM      = 65;
const MIN_RESULTS_THRESHOLD = 5;
const SIMILARITY_DELTA      = 2;

function toRad(deg) { return (deg * Math.PI) / 180; }

function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

function validateReport(latitude, longitude, fejfajas, faradsag) {
  return (
    typeof latitude  === 'number' && latitude  >= -90  && latitude  <= 90  &&
    typeof longitude === 'number' && longitude >= -180 && longitude <= 180 &&
    typeof fejfajas  === 'number' && Number.isInteger(fejfajas) &&
    fejfajas >= 0 && fejfajas <= 10 &&
    typeof faradsag  === 'number' && Number.isInteger(faradsag) &&
    faradsag >= 0 && faradsag <= 10
  );
}

function validateStats(lat, lon, fejfajas, faradsag) {
  return (
    !isNaN(lat)      && lat      >= -90  && lat      <= 90  &&
    !isNaN(lon)      && lon      >= -180 && lon      <= 180 &&
    !isNaN(fejfajas) && fejfajas >= 0    && fejfajas <= 10  &&
    !isNaN(faradsag) && faradsag >= 0    && faradsag <= 10
  );
}

module.exports = {
  RADIUS_BASE_KM,
  RADIUS_EXPAND_KM,
  MIN_RESULTS_THRESHOLD,
  haversine,
  countSimilar,
  toCategory,
  validateReport,
  validateStats,
};
