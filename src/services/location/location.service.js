const { findNearestCity } = require("./geo.service");
const { getLocationFromIP } = require("./ip.service");
const { resolveEffectiveCity } = require("./resolver.service");

async function resolveFromCoords({ lat, lng }) {
  if (!lat || !lng) return null;

  const city = await findNearestCity({ lat, lng });
  return city;
}

async function resolveFromIP(ip) {
  if (!ip) return null;

  const coords = await getLocationFromIP(ip);
  if (!coords) return null;

  const city = await findNearestCity(coords);
  return city;
}

async function resolveLocation({ lat, lng, ip }) {
  let detectedCity = null;
  let source = null;

  // Try GPS
  if (lat && lng) {
    detectedCity = await resolveFromCoords({ lat, lng });
    source = "GPS";
  }

  // Fallback to IP
  if (!detectedCity && ip) {
    detectedCity = await resolveFromIP(ip);
    source = "IP";
  }

  // Resolve effective city
  const effectiveCity = await resolveEffectiveCity(detectedCity);

  return {
    detectedCity,
    effectiveCity,
    source,
  };
}

module.exports = {
  resolveLocation,
  resolveFromCoords,
  resolveFromIP,
};
