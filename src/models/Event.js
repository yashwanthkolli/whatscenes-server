const mongoose = require("mongoose");

const EVENT_STATUS = [
  "DRAFT",
  "PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "MATCHING_PENDING",
  "MATCH_CONFIRMED",
  "REVEALED",
  "COMPLETED",
  "CANCELLED",
];

const CATEGORY_TYPES = ["SINGLE", "COUPLE", "GROUP"];

const EVENT_TYPES = [
  "DINNER",
  "HACKATHON",
  "TREKKING",
  "MARATHON",
  "CLUBBING",
  "GAME_NIGHT",
  "YOGA",
  "WORKSHOP",
  "TRAVEL",
  "ART",
  "MIXER",
  "CAFE_HOPPING",
  "ADVENTURE",
  "SPORTS",
  "LIVE_MUSIC",
  "GAMES_AND_PUZZLES",
  "LAID_BACK",
  "ADRENALINE",
  "IMMERSIVE",
  "PUZZLE",
];

const INTEREST_TAGS = [
  "fitness",
  "technology",
  "nightlife",
  "networking",
  "outdoor",
  "music",
  "boardgames",
  "entrepreneurship",
  "art",
  "food",
  "dinner",
  "cafe_hopping",
  "adventure",
  "sports",
  "live_music",
  "games_and_puzzles",
  "walks",
  "late_nights",
];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: true,
      index: true,
    },

    area: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      normalizedName: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
      },
    },

    description: {
      type: String,
      required: true,
    },

    runtime: {
      type: String,
    },

    tagline: {
      type: String,
    },

    venue_name: {
      type: String,
      required: true,
      trim: true,
    },

    venue_address: {
      type: String,
      required: true,
    },

    geo_coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },

    category_type: {
      type: String,
      enum: CATEGORY_TYPES,
      required: true,
    },

    event_type: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
      index: true,
    },

    interest_tags: {
      type: [String],
      enum: INTEREST_TAGS,
      default: [],
      index: true,
    },

    difficulty_level: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", null],
      default: null,
    },

    visibility_scope: {
      type: String,
      enum: ["PUBLIC", "PREMIUM_ONLY", "INVITE_ONLY"],
      default: "PUBLIC",
      index: true,
    },

    search_keywords: {
      type: [String],
      default: [],
    },

    is_premium: {
      type: Boolean,
      default: false,
    },

    cover_image: {
      url: { type: String },
      public_id: { type: String },
    },

    status: {
      type: String,
      enum: EVENT_STATUS,
      default: "DRAFT",
      index: true,
    },

    registration_count_cache: {
      type: Number,
      default: 0,
    },

    last_count_sync_at: {
      type: Date,
    },

    registration_open_at: {
      type: Date,
      index: true,
    },

    registration_close_at: {
      type: Date,
      index: true,
    },

    event_start_at: {
      type: Date,
      index: true,
    },

    event_end_at: {
      type: Date,
      index: true,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deleted_at: {
      type: Date,
    },
  },
  { timestamps: true },
);

eventSchema.index({
  city: 1,
  "area.normalizedName": 1,
  event_type: 1,
  status: 1,
});

// Unique slug per city + area (excluding soft deleted)
eventSchema.index(
  { city: 1, "area.normalizedName": 1, slug: 1, is_deleted: 1 },
  { unique: true },
);

// Full text search index
eventSchema.index(
  {
    title: "text",
    description: "text",
    search_keywords: "text",
  },
  {
    weights: {
      title: 10,
      search_keywords: 7,
      description: 3,
    },
    name: "EventTextSearchIndex",
  },
);

// Index for CRON automated status transitions
eventSchema.index({
  status: 1,
  registration_open_at: 1,
  is_deleted: 1,
});

eventSchema.index({
  status: 1,
  registration_close_at: 1,
  is_deleted: 1,
});

eventSchema.index({
  status: 1,
  event_end_at: 1,
  is_deleted: 1,
});

module.exports = mongoose.model("Event", eventSchema);
