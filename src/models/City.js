const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    normalizedName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    isOperational: {
      type: Boolean,
      default: false,
      index: true,
    },

    areas: [
      {
        name: String,
        normalizedName: {
          type: String,
          lowercase: true,
          trim: true,
        },
        coordinates: {
          type: {
            type: String,
            enum: ["Point"],
          },
          coordinates: [Number],
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
citySchema.index({ coordinates: "2dsphere" });

citySchema.index({ normalizedName: 1, state: 1 }, { unique: true });

module.exports = mongoose.model("City", citySchema);
