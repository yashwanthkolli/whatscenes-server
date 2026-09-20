const City = require("../../models/City");

let cachedHyderabad = null;

async function getHyderabadCity() {
  if (cachedHyderabad) return cachedHyderabad;

  const city = await City.findOne({
    normalizedName: "hyderabad",
    isOperational: true,
  }).lean();

  cachedHyderabad = city;

  return city;
}

async function resolveEffectiveCity(detectedCity) {
  if (!detectedCity) {
    return getHyderabadCity();
  }

  if (detectedCity.isOperational) {
    return detectedCity;
  }

  return getHyderabadCity();
}

module.exports = {
  resolveEffectiveCity,
  getHyderabadCity,
};
