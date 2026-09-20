const Event = require("../models/Event");
const EventTimeConfig = require("../models/EventTimeConfig");
const EventFinancial = require("../models/EventFinancial");
const EventPolicy = require("../models/EventPolicy");
const EventCapacity = require("../models/EventCapacity");
const EventQuestionnaireConfig = require("../models/EventQuestionnaireConfig");
const EventRegistration = require("../models/EventRegistration");
const PrelaunchWaitlist = require("../models/PrelaunchWaitlist");
const EventMatchGroup = require("../models/EventMatchGroup");
const Questionnaire = require("../models/QuestionnaireDefinition");
const cacheAside = require("../cache/cacheAside");
const {
  eventDetailKey,
  homeEventsKey,
  eventsListKey,
} = require("../cache/cacheKeys");
const { resolveUserContext } = require("../utils/eventUserContextResolver");

const PUBLIC_VISIBLE_STATUSES = [
  "PUBLISHED",
  "REGISTRATION_OPEN",
  // "REGISTRATION_CLOSED",
  // "MATCHING_PENDING",
  // "MATCH_CONFIRMED",
  // "REVEALED",
];

async function getHomeEvents({ user, resolvedCity }) {
  const normalizedCity = resolvedCity.normalizedName || null;
  const baseKey = homeEventsKey(normalizedCity);

  const baseData = await cacheAside(baseKey, 120, async () => {
    const baseFilter = {
      is_deleted: false,
      visibility_scope: "PUBLIC",
      status: { $in: PUBLIC_VISIBLE_STATUSES },
      city: resolvedCity._id,
    };

    // -------------------------
    // Live Events
    // -------------------------
    const liveEvents = await Event.find({
      ...baseFilter,
      status: "REGISTRATION_OPEN",
    })
      .populate("city", "name normalizedName")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // -------------------------
    // Popular Events
    // -------------------------
    const popularEvents = await Event.find(baseFilter)
      .populate("city", "name normalizedName")
      .sort({ registration_count_cache: -1, createdAt: -1 })
      .limit(10)
      .lean();

    // -------------------------
    // By Event Type
    // -------------------------
    const eventTypesToShow = ["LAID_BACK", "ADRENALINE", "IMMERSIVE", "PUZZLE"];

    const byType = {};

    for (const type of eventTypesToShow) {
      byType[type] = await Event.find({
        ...baseFilter,
        event_type: type,
      })
        .populate("city", "name normalizedName")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
    }

    return {
      live: liveEvents,
      popular: popularEvents,
      byType,
    };
  });

  // -------------------------
  // Recommended
  // -------------------------
  let recommendedEvents = [];

  if (user?.currentCity) {
    const candidateEvents = await Event.find({
      is_deleted: false,
      visibility_scope: "PUBLIC",
      status: { $in: PUBLIC_VISIBLE_STATUSES },
      city: user.currentCity.toLowerCase(),
      interest_tags: { $in: user.interests || [] },
    })
      .limit(50)
      .lean();

    recommendedEvents = candidateEvents
      .map((event) => {
        let score = 0;

        if (event.area === user.area) score += 3;

        const overlap = event.interest_tags.filter((tag) =>
          (user.interests || []).includes(tag),
        ).length;

        score += overlap * 2;

        // if (event.event_type === user.preferred_event_type)
        //   score += 1;

        // if (
        //   event.difficulty_level &&
        //   event.difficulty_level === user.preferred_difficulty
        // )
        //   score += 1;

        return { event, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item) => item.event);
  }

  return {
    ...baseData,
    recommended: recommendedEvents,
  };
}

async function getEventsListing({
  query,
  city,
  area,
  event_type,
  difficulty_level,
  interest_tags,
  page = 1,
  limit = 10,
  sort = "recent",
}) {
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;

  if (page < 1) page = 1;
  if (limit < 1) limit = 10;
  if (limit > 50) limit = 50;

  const normalizedCity = city?.trim().toLowerCase();

  const key = eventsListKey({
    city: normalizedCity,
    area,
    event_type,
    difficulty_level,
    interest_tags:
      typeof interest_tags === "string"
        ? interest_tags
        : (interest_tags || []).join(","),
    page,
    limit,
    sort,
    query,
  });

  return cacheAside(key, 180, async () => {
    const skip = (page - 1) * limit;

    const baseFilter = {
      is_deleted: false,
      visibility_scope: "PUBLIC",
      status: { $in: PUBLIC_VISIBLE_STATUSES },
    };

    if (city) baseFilter.city = city.trim().toLowerCase();
    if (area) baseFilter.area = area.trim().toLowerCase();
    if (event_type) baseFilter.event_type = event_type;
    if (difficulty_level) baseFilter.difficulty_level = difficulty_level;

    if (interest_tags) {
      const tagsArray =
        typeof interest_tags === "string"
          ? interest_tags.split(",")
          : interest_tags;

      baseFilter.interest_tags = { $in: tagsArray };
    }

    // ------------------------
    // SEARCH MODE
    // ------------------------
    if (query) {
      const events = await Event.find(
        {
          ...baseFilter,
          $text: { $search: query },
        },
        {
          score: { $meta: "textScore" },
        },
      )
        .sort({
          score: { $meta: "textScore" },
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Event.countDocuments({
        ...baseFilter,
        $text: { $search: query },
      });

      return {
        events,
        total,
        page,
        limit,
      };
    }

    // ------------------------
    // NORMAL FILTER MODE
    // ------------------------
    let sortOption = { createdAt: -1 };

    if (sort === "popular") {
      sortOption = { registration_count_cache: -1 };
    }

    if (sort === "upcoming") {
      sortOption = { event_start_at: 1 };
    }

    const [events, total] = await Promise.all([
      Event.find(baseFilter).sort(sortOption).skip(skip).limit(limit).lean(),
      Event.countDocuments(baseFilter),
    ]);

    return {
      events,
      total,
      page,
      limit,
    };
  });
}

async function getPublicEventDetail({ city, slug, user = null }) {
  const key = eventDetailKey(city.normalizedName, slug);

  const baseData = await cacheAside(key, 300, async () => {
    const event = await Event.findOne({
      city: city._id,
      slug,
      is_deleted: false,
      visibility_scope: "PUBLIC",
      status: { $in: PUBLIC_VISIBLE_STATUSES },
    })
      .populate("city", "name")
      .lean();

    if (!event) {
      throw new Error("Event not found");
    }

    const [timeline, financial, policy, capacity] = await Promise.all([
      EventTimeConfig.findOne({ event: event._id }).lean(),
      EventFinancial.findOne({ event: event._id }).lean(),
      EventPolicy.findOne({ event: event._id }).lean(),
      EventCapacity.findOne({ event: event._id }).lean(),
    ]);

    // Capacity Computation
    const totalCapacity = capacity?.max_total_capacity || 0;
    const booked = capacity?.booked_count || 0;
    const reserved = capacity?.reserved_count || 0;

    const spotsLeft = Math.max(totalCapacity - booked - reserved, 0);

    // Pricing
    const price = financial?.discounted_price ?? financial?.base_price ?? 0;
    const hasDiscount =
      financial?.discounted_price &&
      financial.discounted_price < financial.base_price;

    // Timeline Status
    const now = new Date();

    const isRegistrationOpen =
      timeline?.registration_open_at &&
      timeline?.registration_close_at &&
      now >= timeline.registration_open_at &&
      now <= timeline.registration_close_at;

    const isSoldOut = spotsLeft <= 0;

    return {
      id: event._id,
      title: event.title,
      description: event.description,
      runtime: event.runtime,
      tagline: event.tagline,

      type: event.event_type,
      category: event.category_type,
      tags: event.interest_tags,

      media: {
        coverImage: event.cover_image?.url || null,
      },

      schedule: {
        startAt: timeline?.event_start_at,
        endAt: timeline?.event_end_at,
        revealAt: timeline?.reveal_at,
        registrationCloseAt: timeline?.registration_close_at,
        menSelectionOpenAt: timeline?.men_selection_open_at,
      },

      location: {
        area: event.area,
        city: event.city.name,
        coordinates: event.geo_coordinates,
      },

      pricing: {
        price,
        currency: financial?.currency || "INR",
        hasDiscount,
        originalPrice: financial?.base_price || null,
      },

      capacity: {
        total: totalCapacity,
        booked,
        spotsLeft,
        genderSplit: {
          male: capacity?.male_booked_count || 0,
          female: capacity?.female_booked_count || 0,
        },
        groupSize: {
          min: capacity?.group_size_min || 0,
          max: capacity?.group_size_max || 0,
        },
      },

      eligibility: policy
        ? {
            minAge: policy.min_age,
            maxAge: policy.max_age,
            genderRestrictions: policy.gender_restrictions,
            minQualityScore: policy.min_quality_score,
            womenPriority: policy.women_priority_enabled,
          }
        : null,

      timeline: {
        status: event.status,
        isRegistrationOpen,
        isSoldOut,
      },

      questionnaireRequired: policy.require_questionnaire_completion,
    };
  });

  let registration = null;
  let prelaunchWaitlist = null;

  if (user) {
    [registration, prelaunchWaitlist] = await Promise.all([
      EventRegistration.findOne({
        event: baseData.id,
        user: user._id,
      }).lean(),

      PrelaunchWaitlist.findOne({
        event: baseData.id,
        user: user._id,
      }).lean(),
    ]);
  }

  const group = registration?.match_group
    ? await EventMatchGroup.findById(registration.match_group).lean()
    : null;

  const userContext = resolveUserContext({
    baseData,
    registration,
    prelaunchWaitlist,
    user,
    group,
  });

  return {
    ...baseData,
    userContext,
  };
}

async function getPublicEventQuestionnaire({ city, slug }) {
  const normalizedCity = city.trim().toLowerCase();

  const event = await Event.findOne({
    city: normalizedCity,
    slug,
    is_deleted: false,
    visibility_scope: "PUBLIC",
    status: { $in: PUBLIC_VISIBLE_STATUSES },
  }).lean();

  if (!event) {
    throw new Error("Event not found");
  }

  const config = await EventQuestionnaireConfig.findOne({
    event: event._id,
  }).lean();

  if (!config) return null;

  const questionnaire = await Questionnaire.findById(config.questionnaire)
    .select("_id questionnaireKey questions")
    .lean();

  if (!questionnaire) {
    throw new Error("Questionnaire not found");
  }

  return questionnaire;
}

module.exports = {
  getHomeEvents,
  getEventsListing,
  getPublicEventDetail,
  getPublicEventQuestionnaire,
};
