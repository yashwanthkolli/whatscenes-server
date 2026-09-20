const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    // Phone Identifier
    phone: {
      countryCode: {
        type: String,
        required: true,
        trim: true,
      },
      number: {
        type: String,
        required: true,
        trim: true,
      },
    },

    // Hashed OTP
    otpHash: {
      type: String,
      required: true,
    },

    // Why this OTP exists
    purpose: {
      type: String,
      enum: ['login', 'signup', 'change_phone', 'reactivation'],
      default: 'login',
      index: true,
    },

    // Attempt tracking
    attempts: {
      type: Number,
      default: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
    },

    // Usage state
    isUsed: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Expiry
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* =========================
  INDEXES
========================== */

// One active OTP per phone + purpose
otpSchema.index(
  {
    'phone.countryCode': 1,
    'phone.number': 1,
    purpose: 1,
    isUsed: 1,
  },
  {
    unique: true,
    partialFilterExpression: { isUsed: false }
  }
);

// Automatically delete expired OTPs
otpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model('Otp', otpSchema);
