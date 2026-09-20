const mongoose = require("mongoose");

const eventFinancialSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
      index: true,
    },

    base_price: {
      type: Number,
      required: true,
      min: 0,
    },

    discounted_price: {
      type: Number,
      default: null,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    allow_partial_refund: {
      type: Boolean,
      default: false,
    },

    partial_refund_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    wallet_credit_allowed: {
      type: Boolean,
      default: false,
    },

    last_price_update_at: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EventFinancial", eventFinancialSchema);