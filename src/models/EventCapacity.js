const mongoose = require("mongoose");

const eventCapacitySchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
      index: true,
    },

    max_total_capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    group_size_min: {
      type: Number,
      required: true,
      min: 1,
    },

    group_size_max: {
      type: Number,
      required: true,
      min: 1,
    },

    male_limit: {
      type: Number,
      default: null,
    },

    female_limit: {
      type: Number,
      default: null,
    },

    other_limit: {
      type: Number,
      default: null,
    },

    allow_capacity_increase_after_open: {
      type: Boolean,
      default: true,
    },

    booked_count: { type: Number, default: 0 },
    reserved_count: { type: Number, default: 0 },

    male_booked_count: { type: Number, default: 0 },
    female_booked_count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("EventCapacity", eventCapacitySchema);
