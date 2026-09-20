const mongoose = require("mongoose");

const eventQuestionnaireConfigSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
      index: true,
    },

    questionnaire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionnaireDefinition",
      required: true,
    },

    is_mandatory: {
      type: Boolean,
      default: true,
    },

    allow_edit_until: {
      type: Date,
    },

    affects_matching: {
      type: Boolean,
      default: false,
    },

    affects_quality_score: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "EventQuestionnaireConfig",
  eventQuestionnaireConfigSchema
);