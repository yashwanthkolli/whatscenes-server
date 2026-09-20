const mongoose = require('mongoose');

const questionnaireDefinitionSchema = new mongoose.Schema(
  {
    questionnaireKey: {
      type: String,
      required: true,
      index: true,
    },

    version: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: ['profile', 'event'],
      required: true,
    },

    // Optional metadata (event type, age groups, etc.)
    contextMetadata: {
      eventType: String,
      description: String,
    },

    // Ordered list of questions
    questions: [
      {
        questionKey: {
          type: String,
          required: true,
        },
        questionVersion: {
          type: Number,
          required: true,
        },
        required: {
          type: Boolean,
          default: true,
        },
      },
    ],

    status: {
      type: String,
      enum: ['active', 'deprecated'],
      default: 'active',
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
    },

    effectiveTill: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Ensure version uniqueness
questionnaireDefinitionSchema.index(
  { questionnaireKey: 1, version: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'QuestionnaireDefinition',
  questionnaireDefinitionSchema
);
