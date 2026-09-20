const mongoose = require("mongoose");

const eventTimeConfigSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
      index: true,
    },

    registration_open_at: {
      type: Date,
      required: true,
    },

    registration_close_at: {
      type: Date,
      required: true,
    },

    matching_start_at: {
      type: Date,
    },

    reveal_at: {
      type: Date,
      required: true,
    },

    event_start_at: {
      type: Date,
      required: true,
      index: true,
    },

    event_end_at: {
      type: Date,
      required: true,
    },

    women_registration_close_at: {
      type: Date,
    },

    men_selection_open_at: {
      type: Date,
    },

    last_timeline_update_at: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EventTimeConfig", eventTimeConfigSchema);