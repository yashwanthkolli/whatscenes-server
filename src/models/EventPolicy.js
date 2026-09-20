const mongoose = require("mongoose");

const eventPolicySchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
      index: true,
    },

    min_age: Number,
    max_age: Number,

    gender_restrictions: {
      type: [String], // ["male", "female", "other"]
      default: [],
    },

    profession_whitelist: {
      type: [String],
      default: [],
    },

    education_whitelist: {
      type: [String],
      default: [],
    },

    min_quality_score: {
      type: Number,
      default: 0,
    },

    women_priority_enabled: {
      type: Boolean,
      default: false,
    },

    show_registration_count: {
      type: Boolean,
      default: false,
    },

    require_questionnaire_completion: {
      type: Boolean,
    },

    updated_by_admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EventPolicy", eventPolicySchema);