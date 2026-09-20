const mongoose = require("mongoose");

const prelaunchWaitlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Prevent duplicate registration per user per event
prelaunchWaitlistSchema.index({ event: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("PrelaunchWaitlist", prelaunchWaitlistSchema);
