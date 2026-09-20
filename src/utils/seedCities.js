const mongoose = require("mongoose");
const City = require("../models/City");

const cities = [
  {
    name: "Hyderabad",
    normalizedName: "hyderabad",
    state: "Telangana",
    coordinates: {
      type: "Point",
      coordinates: [78.4867, 17.385],
    },
    isOperational: true,
  },
  {
    name: "Bengaluru",
    normalizedName: "bengaluru",
    state: "Karnataka",
    coordinates: {
      type: "Point",
      coordinates: [77.5946, 12.9716],
    },
    isOperational: false,
  },
  {
    name: "Mumbai",
    normalizedName: "mumbai",
    state: "Maharashtra",
    coordinates: {
      type: "Point",
      coordinates: [72.8777, 19.076],
    },
    isOperational: false,
  },
  {
    name: "Delhi",
    normalizedName: "delhi",
    state: "Delhi",
    coordinates: {
      type: "Point",
      coordinates: [77.1025, 28.7041],
    },
    isOperational: false,
  },
  {
    name: "Pune",
    normalizedName: "pune",
    state: "Maharashtra",
    coordinates: {
      type: "Point",
      coordinates: [73.8567, 18.5204],
    },
    isOperational: false,
  },
];

async function seedCities() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    await City.deleteMany(); // safe for now (dev only)

    await City.insertMany(cities);

    console.log("Cities seeded successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

seedCities();
