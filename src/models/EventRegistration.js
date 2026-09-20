const mongoose = require("mongoose");

const REGISTRATION_STATUS = [
  "INITIATED",
  "WAITLISTED",
  "SELECTED",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "MATCH_NOT_FOUND",
];

const ENTRY_TYPE = ["DIRECT", "WAITLIST"];

const FLOW_TYPE = ["NORMAL", "WOMEN_PRIORITY"];

const eventRegistrationSchema = new mongoose.Schema(
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

    flow_type: {
      type: String,
      enum: FLOW_TYPE,
      required: true,
    },

    entry_type: {
      type: String,
      enum: ENTRY_TYPE,
      required: true,
    },

    status: {
      type: String,
      enum: REGISTRATION_STATUS,
      required: true,
      index: true,
    },

    gender_snapshot: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },

    category_snapshot: {
      type: String,
      enum: ["SINGLE", "COUPLE", "GROUP"],
      required: true,
    },

    group_size: {
      type: Number,
      required: true,
      min: 1,
    },

    payment_required: {
      type: Boolean,
      default: true,
    },

    payment_status: {
      type: String,
      enum: ["NONE", "PENDING", "SUCCESS", "FAILED"],
      default: "NONE",
    },

    booking_confirmed_at: {
      type: Date,
    },

    expires_at: {
      type: Date,
      index: true,
    },

    match_group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventMatchGroup",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

// Prevent duplicate registration per user per event
eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

// For event queries (listing / admin / analytics)
eventRegistrationSchema.index({ event: 1, status: 1 });

eventRegistrationSchema.index({
  user: 1,
  status: 1,
  event: 1,
});

// For wait list queries
eventRegistrationSchema.index({ event: 1, entry_type: 1, status: 1 });

// Expiry handling (cron later)
eventRegistrationSchema.index({ expires_at: 1 });

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
