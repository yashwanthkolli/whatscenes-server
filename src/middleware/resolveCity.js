const City = require("../models/City");
const asyncHandler = require("../utils/asyncHandler");
const { getHyderabadCity } = require("../services/location/resolver.service");

// Utility to format response
function formatCity(city) {
  return {
    _id: city._id,
    name: city.name,
    normalizedName: city.normalizedName,
    isOperational: city.isOperational,
  };
}

const resolveCity = asyncHandler(async (req, res, next) => {
  let city = null;

  // Query param (highest priority for GET APIs)
  if (req.query.city) {
    city = await City.findOne({
      normalizedName: req.query.city.toLowerCase(),
      isOperational: true,
    }).lean();

    if (!city) {
      return res.status(400).json({
        message: "Invalid city provided",
      });
    }
  }

  // Body param (manual override)
  else if (req.body.cityId) {
    city = await City.findById(req.body.cityId).lean();

    if (!city) {
      return res.status(400).json({
        message: "Invalid cityId provided",
      });
    }
  }

  // User location
  else if (req.user?.currentLocation?.effectiveCityId) {
    city = await City.findById(req.user.currentLocation.effectiveCityId).lean();
  }

  // Final fallback → Hyderabad
  if (!city) {
    city = await getHyderabadCity();
  }

  req.resolvedCity = formatCity(city);

  return next();
});

module.exports = {
  resolveCity,
};
