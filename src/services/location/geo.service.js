const City = require("../../models/City");

async function findNearestCity({ lat, lng, maxDistance = 100000 }) {
  if (!lat || !lng) return null;

  const city = await City.findOne({
    coordinates: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        // $maxDistance: maxDistance,
      },
    },
    isOperational: true,
  }).lean();

  return city;
}

module.exports = {
  findNearestCity,
};
