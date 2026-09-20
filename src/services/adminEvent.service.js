const mongoose = require("mongoose");
const City = require("../models/City");
const Event = require("../models/Event");
const eventMutabilityGuard = require("../middleware/eventMutabilityGuard");
const EventPolicy = require("../models/EventPolicy");
const EventCapacity = require("../models/EventCapacity");
const EventFinancial = require("../models/EventFinancial");
const EventTimeConfig = require("../models/EventTimeConfig");
const EventQuestionnaireConfig = require("../models/EventQuestionnaireConfig");
const Questionnaire = require("../models/QuestionnaireDefinition");
const cloudinary = require("../utils/cloudinary");
const transitionEventState = require("../utils/transitionEventState");
const validateEventBeforePublish = require("../utils/eventPublishValidator");
const {
  validateTimeline,
  validateCapacity,
  validateFinancialConfig,
  normalizeSlug,
} = require("../utils/eventValidators");
const { invalidateEventCaches } = require("../cache/invalidation");

async function createEventCore(payload, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const allowedFields = [
      "title",
      "slug",
      "cityId",
      "area",
      "description",
      "tagline",
      "runtime",
      "venue_name",
      "venue_address",
      "geo_coordinates",
      "category_type",
      "event_type",
      "interest_tags",
      "difficulty_level",
      "visibility_scope",
      "search_keywords",
      "is_premium",
    ];

    const sanitizedPayload = {};

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        sanitizedPayload[field] = payload[field];
      }
    }

    if (!sanitizedPayload.slug) {
      throw new Error("Slug is required");
    }

    sanitizedPayload.slug = normalizeSlug(sanitizedPayload.slug);

    if (!sanitizedPayload.cityId || !sanitizedPayload.area) {
      throw new Error("City and area are required");
    }

    const cityDoc = await City.findById(sanitizedPayload.cityId).lean();
    if (!cityDoc) {
      throw new Error("Invalid cityId", 400);
    }

    const normalizedArea = sanitizedPayload.area.toLowerCase().trim();

    const areaDoc = cityDoc.areas.find(
      (a) => a.normalizedName === normalizedArea,
    );

    if (!areaDoc) {
      throw new Error("Invalid area for the selected city", 400);
    }

    const event = await Event.create(
      [
        {
          ...sanitizedPayload,
          city: sanitizedPayload.cityId,
          area: {
            name: areaDoc.name,
            normalizedName: areaDoc.normalizedName,
          },
          created_by: adminId,
          status: "DRAFT",
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return event[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // Handle duplicate slug cleanly
    if (err.code === 11000) {
      throw new Error(
        "An event with the same slug already exists in this city and area",
      );
    }

    throw err;
  }
}

async function updateEventCore(eventId, payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot modify deleted event");

    await eventMutabilityGuard({
      eventId,
      updatePayload: payload,
      moduleType: "CORE",
    });

    const allowedFields = [
      "title",
      "city",
      "area",
      "description",
      "tagline",
      "runtime",
      "venue_name",
      "venue_address",
      "geo_coordinates",
      "category_type",
      "event_type",
      "interest_tags",
      "difficulty_level",
      "visibility_scope",
      "search_keywords",
      "is_premium",
    ];

    const sanitizedPayload = {};

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        sanitizedPayload[field] = payload[field];
      }
    }

    // Normalize slug if changed
    if (sanitizedPayload.slug) {
      sanitizedPayload.slug = normalizeSlug(sanitizedPayload.slug);
    }

    // Normalize city + area
    if (sanitizedPayload.city) {
      sanitizedPayload.city = sanitizedPayload.city.trim().toLowerCase();
    }

    if (sanitizedPayload.area) {
      sanitizedPayload.area = sanitizedPayload.area.trim().toLowerCase();
    }

    Object.assign(event, sanitizedPayload);

    await event.save({ session });

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return event;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000) {
      throw new Error(
        "An event with the same slug already exists in this city and area",
      );
    }

    throw err;
  }
}

async function configurePolicy(eventId, payload, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot modify deleted event");

    await eventMutabilityGuard({
      eventId,
      updatePayload: payload,
      moduleType: "POLICY",
    });

    const allowedFields = [
      "min_age",
      "max_age",
      "gender_restrictions",
      "min_quality_score",
      "require_questionnaire_completion",
      "profession_whitelist",
      "education_whitelist",
      "women_priority_enabled",
    ];

    const sanitizedPayload = {};

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        sanitizedPayload[field] = payload[field];
      }
    }

    if (
      sanitizedPayload.min_age !== undefined &&
      sanitizedPayload.max_age !== undefined &&
      sanitizedPayload.min_age >= sanitizedPayload.max_age
    ) {
      throw new Error("min_age must be less than max_age");
    }

    if (
      sanitizedPayload.min_quality_score !== undefined &&
      sanitizedPayload.min_quality_score < 0
    ) {
      throw new Error("min_quality_score cannot be negative");
    }

    const policy = await EventPolicy.findOneAndUpdate(
      { event: eventId },
      {
        ...sanitizedPayload,
        updated_by_admin_id: adminId,
      },
      {
        upsert: true,
        new: true,
        session,
      },
    );

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return policy;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function configureCapacity(eventId, payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot modify deleted event");

    await eventMutabilityGuard({
      eventId,
      updatePayload: payload,
      moduleType: "CAPACITY",
    });

    const allowedFields = [
      "max_total_capacity",
      "group_size_min",
      "group_size_max",
      "male_limit",
      "female_limit",
      "other_limit",
      "allow_capacity_increase_after_open",
    ];

    const sanitizedPayload = {};

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        sanitizedPayload[field] = payload[field];
      }
    }

    const existingCapacity = await EventCapacity.findOne(
      { event: eventId },
      null,
      { session },
    );

    const mergedPayload = {
      ...(existingCapacity ? existingCapacity.toObject() : {}),
      ...sanitizedPayload,
    };

    // Remove Mongo internal fields if present
    delete mergedPayload._id;
    delete mergedPayload.createdAt;
    delete mergedPayload.updatedAt;

    validateCapacity(mergedPayload);

    const capacity = await EventCapacity.findOneAndUpdate(
      { event: eventId },
      sanitizedPayload,
      {
        upsert: true,
        new: true,
        session,
      },
    );

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return capacity;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function configureFinancial(eventId, payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot modify deleted event");

    await eventMutabilityGuard({
      eventId,
      updatePayload: payload,
      moduleType: "FINANCIAL",
    });

    const allowedFields = [
      "base_price",
      "discounted_price",
      "currency",
      "allow_partial_refund",
      "partial_refund_percentage",
      "refund_deadline_hours",
    ];

    const sanitizedPayload = {};

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        sanitizedPayload[field] = payload[field];
      }
    }

    const existingFinancial = await EventFinancial.findOne(
      { event: eventId },
      null,
      { session },
    );

    const merged = {
      ...(existingFinancial ? existingFinancial.toObject() : {}),
      ...sanitizedPayload,
    };

    delete merged._id;
    delete merged.createdAt;
    delete merged.updatedAt;

    validateFinancialConfig(merged);

    if (
      existingFinancial &&
      (sanitizedPayload.base_price !== undefined ||
        sanitizedPayload.discounted_price !== undefined)
    ) {
      sanitizedPayload.last_price_update_at = new Date();
    }

    const financial = await EventFinancial.findOneAndUpdate(
      { event: eventId },
      sanitizedPayload,
      {
        upsert: true,
        new: true,
        session,
      },
    );

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return financial;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function configureTimeline(eventId, payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot modify deleted event");

    await eventMutabilityGuard({
      eventId,
      updatePayload: payload,
      moduleType: "TIMELINE",
    });

    const allowedFields = [
      "registration_open_at",
      "registration_close_at",
      "matching_start_at",
      "reveal_at",
      "event_start_at",
      "event_end_at",
      "women_registration_close_at",
      "men_selection_open_at",
    ];

    const sanitizedPayload = {};

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        sanitizedPayload[field] = payload[field];
      }
    }

    const existingTimeline = await EventTimeConfig.findOne(
      { event: eventId },
      null,
      { session },
    );

    const merged = {
      ...(existingTimeline ? existingTimeline.toObject() : {}),
      ...sanitizedPayload,
    };

    delete merged._id;
    delete merged.createdAt;
    delete merged.updatedAt;

    // Centralized timeline validation
    validateTimeline(merged);

    sanitizedPayload.last_timeline_update_at = new Date();

    const timeline = await EventTimeConfig.findOneAndUpdate(
      { event: eventId },
      sanitizedPayload,
      {
        upsert: true,
        new: true,
        session,
      },
    );

    event.registration_open_at = timeline.registration_open_at;
    event.registration_close_at = timeline.registration_close_at;
    event.event_start_at = timeline.event_start_at;
    event.event_end_at = timeline.event_end_at;

    await event.save({ session });

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return timeline;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function uploadEventCoverImage(eventId, file, adminId) {
  if (!file || !file.buffer) {
    throw new Error("No file uploaded");
  }
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) {
      throw new Error("Event not found");
    }

    if (event.is_deleted) {
      throw new Error("Cannot modify deleted event");
    }

    console.log(event.id);

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "events/covers",
          resource_type: "image",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      stream.end(file.buffer);
    });

    if (event.cover_image?.public_id) {
      await cloudinary.uploader.destroy(event.cover_image.public_id);
    }

    event.cover_image.url = uploadResult.secure_url;
    event.cover_image.public_id = uploadResult.public_id;

    await event.save({ session });

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return event;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function publishEvent(eventId, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot publish deleted event");

    const originalStatus = event.status;

    const now = new Date();

    const allowedOrigins = ["DRAFT", "PUBLISHED"];

    // If already beyond publish, idempotent return
    if (!allowedOrigins.includes(event.status)) {
      await session.commitTransaction();
      session.endSession();
      return event;
    }

    await validateEventBeforePublish(event._id, session);

    const openAt = event.registration_open_at;
    const closeAt = event.registration_close_at;

    let nextState = "PUBLISHED";

    if (now < openAt) {
      nextState = "PUBLISHED";
    } else if (now >= openAt && now < closeAt) {
      nextState = "REGISTRATION_OPEN";
    } else {
      nextState = "REGISTRATION_CLOSED";
    }

    if (event.status !== nextState) {
      event.status = nextState;
      await event.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Invalidate cache if state changed or moved from draft
    if (originalStatus !== event.status || originalStatus === "DRAFT") {
      await invalidateEventCaches(event);
    }

    return event;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function transitionLifecycle(eventId, nextState, adminId, reason) {
  const updatedEvent = await transitionEventState({
    eventId,
    nextState,
    performedBy: adminId,
    reason,
  });

  return updatedEvent;
}

async function duplicateEvent(eventId, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const original = await Event.findById(eventId).session(session);

    if (!original) throw new Error("Original event not found");
    if (original.is_deleted) throw new Error("Cannot duplicate deleted event");

    const newSlug = normalizeSlug(`${original.slug}-copy-${Date.now()}`);

    const newEvent = await Event.create(
      [
        {
          title: original.title + " (Copy)",
          slug: newSlug,
          city: original.city,
          area: original.area,
          description: original.description,
          tagline: original.tagline,
          runtime: original.runtime,
          venue_name: original.venue_name,
          venue_address: original.venue_address,
          geo_coordinates: original.geo_coordinates,
          category_type: original.category_type,
          event_type: original.event_type,
          interest_tags: original.interest_tags,
          difficulty_level: original.difficulty_level,
          visibility_scope: original.visibility_scope,
          search_keywords: original.search_keywords,
          is_premium: original.is_premium,
          cover_image: original.cover_image,
          created_by: adminId,
          status: "DRAFT",
        },
      ],
      { session },
    );

    const newEventId = newEvent[0]._id;

    const [policy, capacity, financial, questionnaireConfig] =
      await Promise.all([
        EventPolicy.findOne({ event: eventId }).session(session),
        EventCapacity.findOne({ event: eventId }).session(session),
        EventFinancial.findOne({ event: eventId }).session(session),
        EventQuestionnaireConfig.findOne({ event: eventId }).session(session),
      ]);

    if (policy) {
      const { _id, event, createdAt, updatedAt, ...rest } = policy.toObject();

      await EventPolicy.create([{ ...rest, event: newEventId }], { session });
    }

    if (capacity) {
      const { _id, event, createdAt, updatedAt, ...rest } = capacity.toObject();

      await EventCapacity.create([{ ...rest, event: newEventId }], { session });
    }

    if (financial) {
      const { _id, event, createdAt, updatedAt, ...rest } =
        financial.toObject();

      await EventFinancial.create([{ ...rest, event: newEventId }], {
        session,
      });
    }

    if (questionnaireConfig) {
      const { _id, event, createdAt, updatedAt, ...rest } =
        questionnaireConfig.toObject();

      await EventQuestionnaireConfig.create([{ ...rest, event: newEventId }], {
        session,
      });
    }

    await session.commitTransaction();
    session.endSession();

    return newEvent[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000) {
      throw new Error("Slug conflict occurred during duplication");
    }

    throw err;
  }
}

async function getAdminEvents({
  page = 1,
  limit = 10,
  status,
  city,
  event_type,
  is_deleted,
  sort = "recent",
}) {
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;

  if (page < 1) page = 1;
  if (limit < 1) limit = 10;
  if (limit > 100) limit = 100; // hard cap

  const skip = (page - 1) * limit;

  const filter = {};

  // Default: exclude deleted
  if (typeof is_deleted === "undefined") {
    filter.is_deleted = false;
  } else {
    filter.is_deleted = is_deleted === "true";
  }

  if (status && VALID_STATUSES.includes(status)) {
    filter.status = status;
  }

  if (city) {
    filter.city = city.trim().toLowerCase();
  }

  if (event_type) {
    filter.event_type = event_type;
  }

  let sortOption = { createdAt: -1 };

  if (sort === "oldest") {
    sortOption = { createdAt: 1 };
  }

  if (sort === "status") {
    sortOption = { status: 1 };
  }

  const [events, total] = await Promise.all([
    Event.find(filter).sort(sortOption).skip(skip).limit(limit),
    Event.countDocuments(filter),
  ]);

  return {
    events,
    total,
    page,
    limit,
  };
}

async function getAdminEventById(eventId) {
  const event = await Event.findById(eventId);

  if (!event) throw new Error("Event not found");

  const [policy, capacity, financial, timeline, questionnaire] =
    await Promise.all([
      EventPolicy.findOne({ event: eventId }).lean(),
      EventCapacity.findOne({ event: eventId }).lean(),
      EventFinancial.findOne({ event: eventId }).lean(),
      EventTimeConfig.findOne({ event: eventId }).lean(),
      EventQuestionnaireConfig.findOne({ event: eventId }).lean(),
    ]);

  return {
    event,
    policy: policy || null,
    capacity: capacity || null,
    financial: financial || null,
    timeline: timeline || null,
    questionnaire: questionnaire || null,
  };
}

async function softDeleteEvent(eventId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) {
      throw new Error("Event not found");
    }

    // Idempotent
    if (event.is_deleted) {
      await session.commitTransaction();
      session.endSession();
      return event;
    }

    const allowedDeleteStates = ["DRAFT", "CANCELLED"];

    if (!allowedDeleteStates.includes(event.status)) {
      throw new Error("Event must be CANCELLED before deletion");
    }

    event.is_deleted = true;
    event.deleted_at = new Date();

    await event.save({ session });

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return event;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function attachQuestionnaireToEvent(eventId, payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot modify deleted event");

    await eventMutabilityGuard({
      eventId,
      updatePayload: payload,
      moduleType: "QUESTIONNAIRE",
    });

    const {
      questionnaireId,
      is_mandatory = true,
      affects_matching = true,
      affects_quality_score = true,
    } = payload;

    if (!questionnaireId) {
      throw new Error("questionnaireId is required");
    }

    const questionnaire =
      await Questionnaire.findById(questionnaireId).session(session);

    if (!questionnaire) {
      throw new Error("Questionnaire not found");
    }

    // Business rule enforcement
    let finalIsMandatory = is_mandatory;

    if (affects_matching) {
      finalIsMandatory = true;
    }

    const config = await EventQuestionnaireConfig.findOneAndUpdate(
      { event: eventId },
      {
        questionnaire: questionnaireId,
        is_mandatory: finalIsMandatory,
        affects_matching,
        affects_quality_score,
      },
      {
        upsert: true,
        new: true,
        session,
      },
    );

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return config;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function removeQuestionnaireFromEvent(eventId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot modify deleted event");

    const allowedStates = ["DRAFT", "PUBLISHED"];

    if (!allowedStates.includes(event.status)) {
      throw new Error(
        "Cannot remove questionnaire after registration has opened",
      );
    }

    const config = await EventQuestionnaireConfig.findOneAndDelete(
      { event: eventId },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    await invalidateEventCaches(event);

    return config;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function getEventQuestionnaire(eventId, includeDeleted = false) {
  const event = await Event.findById(eventId).lean();

  if (!event) {
    throw new Error("Event not found");
  }

  const config = await EventQuestionnaireConfig.findOne({
    event: eventId,
  })
    .populate("questionnaire")
    .lean();

  return config || null;
}

module.exports = {
  createEventCore,
  updateEventCore,
  configurePolicy,
  configureCapacity,
  configureFinancial,
  configureTimeline,
  uploadEventCoverImage,
  publishEvent,
  transitionLifecycle,
  duplicateEvent,
  getAdminEvents,
  getAdminEventById,
  softDeleteEvent,
  attachQuestionnaireToEvent,
  removeQuestionnaireFromEvent,
  getEventQuestionnaire,
};
