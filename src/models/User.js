const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { type } = require("os");
const { calculateAge } = require("../utils/age");

const hideRetiredProfileFields = (_document, serializedUser) => {
  delete serializedUser.hometown;
  delete serializedUser.hobbies;
  return serializedUser;
};

const userSchema = new mongoose.Schema(
  {
    // Core Identity
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
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      sparse: true, // allows multiple nulls
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },

    // Basic Information
    name: {
      type: String,
      trim: true,
      default: null,
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator(value) {
          if (value == null) {
            return true;
          }

          const age = calculateAge(value);
          return age !== null && age >= 21 && age <= 100;
        },
        message: "You must be between 21 and 100 years old",
      },
    },
    gender: {
      type: String,
      enum: ["male", "female", "non-binary", "trans"],
    },
    orientation: {
      type: String,
      enum: [
        "straight",
        "gay",
        "lesbian",
        "bisexual",
        "pansexual",
        "asexual",
        "queer",
        "other",
      ],
    },
    profilePictures: [
      {
        type: String, // URL to image
      },
    ],

    // Professional Information
    occupation: {
      type: String,
      enum: [
        "employed",
        "founder/own business",
        "doctor/medical",
        "military/civil services",
        "influencer/creator",
        "lawyer/legal",
        "freelancer",
        "artist",
        "na",
        "student",
      ],
    },
    // designation: String,
    // company: String,
    education: {
      type: String,
      enum: [
        "below_graduate",
        "undergraduate",
        "postgraduate",
        "doctorate",
        "professional",
      ],
    },
    // college: String,

    // Free Time and Interests
    freeTime: {
      type: [String],
      default: [],
    },

    interests: {
      type: [String],
      default: [],
    },

    // Location
    currentLocation: {
      cityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
      },

      name: {
        type: String,
      },

      state: String,

      isOperational: Boolean,

      effectiveCityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
      },

      source: {
        type: String,
        enum: ["GPS", "IP", "MANUAL"],
      },

      updatedAt: Date,

      area: {
        name: String,
      },
    },

    // Account Status and Control
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    lastLoginAt: Date,
    lastLoginMethod: {
      type: String,
      enum: ["otp", "email", "oauth", "reactivation"],
    },

    //Verification and Profile Completion Status
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    idVerification: {
      documentType: {
        type: String,
        enum: ["aadhaar", "pan", "passport", "driving license", null],
        default: null,
      },
      documentNumber: String,
      verificationStatus: {
        type: String,
        enum: ["not_submitted", "pending", "verified", "rejected"],
        default: "pending",
      },
      frontImageUrl: String,
      backImageUrl: String,
      rejectionReason: String,
      submittedAt: Date,
      verifiedAt: Date,
      // verifiedBy: AdminId
    },
    profileCompletion: {
      basicInfo: { type: Boolean, default: false },
      questionnaire: { type: Boolean, default: false },
      photos: { type: Boolean, default: false },
      verification: { type: Boolean, default: false },
    },

    // Rating
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { transform: hideRetiredProfileFields },
    toObject: { transform: hideRetiredProfileFields },
  },
);

// Index for better query performance
userSchema.index(
  { "phone.countryCode": 1, "phone.number": 1 },
  { unique: true },
);
userSchema.index({ "currentLocation.effectiveCityId": 1 });

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Method to create email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Method to create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Method to check if profile is complete
userSchema.methods.isProfileComplete = function () {
  return (
    this.profileCompletion.basicInfo &&
    this.profileCompletion.questionnaire &&
    this.profileCompletion.photos &&
    this.profileCompletion.verification
  );
};

// Method to add points to user's account
userSchema.methods.addPoints = function (
  amount,
  description,
  eventId = null,
  expiresInDays = 90,
) {
  this.points.balance += amount;

  this.points.history.push({
    type: "earned",
    amount: amount,
    description: description,
    event: eventId,
    expiresAt: expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null,
  });

  return this.save();
};

// Method to redeem points
userSchema.methods.redeemPoints = function (amount, description) {
  if (this.points.balance < amount) {
    throw new Error("Insufficient points balance");
  }

  this.points.balance -= amount;

  this.points.history.push({
    type: "redeemed",
    amount: amount,
    description: description,
  });

  return this.save();
};

// Method to expire points (run as a scheduled job)
userSchema.statics.expirePoints = async function () {
  const now = new Date();
  const users = await this.find({
    "points.history.expiresAt": { $lte: now },
    "points.history.type": "earned",
  });

  for (const user of users) {
    let pointsToExpire = 0;

    // Find points that have expired but haven't been marked as expired
    user.points.history.forEach((record) => {
      if (
        record.type === "earned" &&
        record.expiresAt &&
        record.expiresAt <= now &&
        !record.markedAsExpired
      ) {
        pointsToExpire += record.amount;
        record.markedAsExpired = true;
      }
    });

    if (pointsToExpire > 0) {
      user.points.balance = Math.max(0, user.points.balance - pointsToExpire);

      user.points.history.push({
        type: "expired",
        amount: pointsToExpire,
        description: "Points expired",
      });

      await user.save();
    }
  }
};

// Method to update average rating
userSchema.methods.updateAverageRating = function () {
  if (this.ratingsReceived.length === 0) {
    this.averageRating = 0;
    return;
  }

  const sum = this.ratingsReceived.reduce(
    (acc, rating) => acc + rating.rating,
    0,
  );
  this.averageRating = sum / this.ratingsReceived.length;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
