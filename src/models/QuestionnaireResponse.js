const mongoose = require('mongoose');

const questionnaireResponseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    questionnaireKey: {
      type: String,
      required: true,
      index: true,
    },

    questionnaireVersion: {
      type: Number,
      required: true,
    },

    // For event questionnaires
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },

    // Map of questionKey@version → answer
    answers: [
      {
        questionKey: {
          type: String,
          required: true,
        },
        questionVersion: {
          type: Number,
          required: true,
        },
        value: mongoose.Schema.Types.Mixed,
      },
    ],

    isDraft: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Metadata
    context: {
      type: String,
      enum: ['profile', 'event'],
      required: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    clientType: {
      type: String,
      enum: ['web', 'mobile'],
      default: 'web',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One active profile questionnaire per user per version
questionnaireResponseSchema.index(
  {
    user: 1,
    questionnaireKey: 1,
    questionnaireVersion: 1,
    context: 1,
    isDraft: 1,
  },
  {
    unique: true,
    partialFilterExpression: { isDraft: true },
  }
);

module.exports = mongoose.model(
  'QuestionnaireResponse',
  questionnaireResponseSchema
);
