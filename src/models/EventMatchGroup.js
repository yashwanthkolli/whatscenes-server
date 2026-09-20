const mongoose = require("mongoose");

const eventMatchGroupSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    group_number: {
      type: Number,
      required: true,
    },

    members: [
      {
        registration: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "EventRegistration",
          required: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],

    max_group_size: {
      type: Number,
      required: true,
    },

    confirmed_count: {
      type: Number,
      default: 0,
    },

    created_by_admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    batch_id: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// One group number per event per batch
eventMatchGroupSchema.index(
  { event: 1, group_number: 1, batch_id: 1 },
  { unique: true },
);

// Fast lookup by event
eventMatchGroupSchema.index({ event: 1 });

// Optional: cleanup/debugging
eventMatchGroupSchema.index({ batch_id: 1 });

module.exports = mongoose.model("EventMatchGroup", eventMatchGroupSchema);
