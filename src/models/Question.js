const mongoose = require("mongoose");

const allowedUiTypes = [
  "search_select",
  "scale",
  "single_select_cards",
  "multi_select_cards",
  "single_select_badges",
  "multi_select_badges",
  "single_line_text",
  "boolean",
  "number_input",
  "currency_input",
  "multi_text_input",
];

const questionSchema = new mongoose.Schema(
  {
    questionKey: {
      type: String,
      required: true,
      index: true,
    },

    version: {
      type: Number,
      required: true,
    },

    section: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    uiType: {
      type: String,
      enum: allowedUiTypes,
      required: true,
    },

    // Defines valid answers
    answerSchema: {
      min: Number,
      max: Number,
      step: Number,
      options: [String],
      minSelections: Number,
      maxSelections: Number,
      maxLength: Number,
      note: String,
      allowPreferNotToSay: Boolean,
      preferNotToSayValue: Number,
      currency: String,
      fields: [{ placeholder: String }],
    },

    // Applicability rules
    appliesTo: {
      context: {
        type: [String],
        enum: ["profile", "event"],
        default: ["profile"],
      },
      ageRange: {
        min: Number,
        max: Number,
      },
      gender: [String],
      category: [String],
      occupation: [String],
      education: [String],
    },

    // Manual scoring reference
    scoreTag: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Ensure version uniqueness per question
questionSchema.index({ questionKey: 1, version: 1 }, { unique: true });

module.exports = mongoose.model("Question", questionSchema);
