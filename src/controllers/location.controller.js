const asyncHandler = require("../utils/asyncHandler");
const { resolveLocation } = require("../services/location/location.service");
const {
  resolveEffectiveCity,
  getHyderabadCity,
} = require("../services/location/resolver.service");
const City = require("../models/City");

// @desc    Initialize Location
// @route   POST /api/v1/location/initialize
// @access  Private
const initializeLocation = asyncHandler(async (req, res) => {
  const user = req.user || null;
  const { lat, lng, cityId } = req.body;
  const ip = req.ip;

  let detectedCity = null;
  let effectiveCity = null;
  let source = null;

  if (cityId) {
    // const city = await City.findById(cityId).lean();
    const city = req.resolvedCity;

    if (!city) {
      return res.status(404).json({ message: "City not found" });
    }

    detectedCity = city;
    effectiveCity = await resolveEffectiveCity(city);
    source = "MANUAL";
  } else {
    // Auto resolution (GPS/IP)
    const result = await resolveLocation({ lat, lng, ip });

    detectedCity = result.detectedCity;
    effectiveCity = result.effectiveCity;
    source = result.source;
  }

  if (!effectiveCity) {
    effectiveCity = await getHyderabadCity();
  }

  const locationPayload = {
    detectedCity: detectedCity
      ? {
          id: detectedCity._id,
          name: detectedCity.name,
          normalizedName: detectedCity.normalizedName,
          isOperational: detectedCity.isOperational,
        }
      : null,

    effectiveCity: {
      id: effectiveCity._id,
      name: effectiveCity.name,
      normalizedName: effectiveCity.normalizedName,
    },

    source,
  };

  if (user) {
    user.currentLocation = {
      cityId: detectedCity?._id || null,
      name: detectedCity?.name || effectiveCity.name,
      state: detectedCity?.state || effectiveCity.state,
      isOperational: detectedCity?.isOperational || false,
      effectiveCityId: effectiveCity._id,
      source,
      updatedAt: new Date(),
    };

    await user.save();
  }

  return res.json({
    location: locationPayload,
  });
});

module.exports = { initializeLocation };
