const Event = require("../models/Event");
const EventPolicy = require("../models/EventPolicy");
const EventCapacity = require("../models/EventCapacity");
const EventFinancial = require("../models/EventFinancial");
const EventTimeConfig = require("../models/EventTimeConfig");
const EventQuestionnaireConfig = require("../models/EventQuestionnaireConfig");

async function validateEventBeforePublish(eventId, session = null) {
  const queryOptions = session ? { session } : {};

  const event = await Event.findById(eventId, null, queryOptions);
  if (!event) throw new Error("Event not found");
  if (event.is_deleted) throw new Error("Cannot publish deleted event");

  // -------------------------
  // Core Validation
  // -------------------------
  if (!event.title || !event.slug || !event.city || !event.area) {
    throw new Error("Core event fields missing");
  }

  if (!event.venue_name || !event.venue_address) {
    throw new Error("Venue details missing");
  }

  if (!event.event_type) {
    throw new Error("Event type missing");
  }

  if (!event.interest_tags || event.interest_tags.length === 0) {
    throw new Error("Event must have at least one interest tag");
  }

  // -------------------------
  // Policy
  // -------------------------
  const policy = await EventPolicy.findOne(
    { event: event._id },
    null,
    queryOptions,
  );

  if (!policy) throw new Error("Event policy not configured");

  if (policy.min_age && policy.max_age && policy.min_age >= policy.max_age) {
    throw new Error("Invalid age range in policy");
  }

  if (policy.min_quality_score < 0) {
    throw new Error("Invalid minimum quality score");
  }

  if (policy.require_questionnaire_completion) {
    const questionnaireConfig = await EventQuestionnaireConfig.findOne(
      { event: event._id },
      null,
      queryOptions,
    );

    if (!questionnaireConfig) {
      throw new Error("Event requires questionnaire but none attached");
    }
  }

  // -------------------------
  // Capacity
  // -------------------------
  const capacity = await EventCapacity.findOne(
    { event: event._id },
    null,
    queryOptions,
  );

  if (!capacity) throw new Error("Event capacity not configured");

  if (capacity.max_total_capacity <= 0) {
    throw new Error("Max capacity must be greater than 0");
  }

  if (capacity.group_size_min > capacity.group_size_max) {
    throw new Error("Invalid group size configuration");
  }

  if (capacity.group_size_max > capacity.max_total_capacity) {
    throw new Error("Group size exceeds total capacity");
  }

  // -------------------------
  // Financial
  // -------------------------
  const financial = await EventFinancial.findOne(
    { event: event._id },
    null,
    queryOptions,
  );

  if (!financial) throw new Error("Financial configuration missing");

  if (financial.base_price < 0) {
    throw new Error("Base price invalid");
  }

  if (
    financial.discounted_price &&
    financial.discounted_price > financial.base_price
  ) {
    throw new Error("Discounted price cannot exceed base price");
  }

  if (
    !financial.allow_partial_refund &&
    financial.partial_refund_percentage > 0
  ) {
    throw new Error("Partial refund percentage invalid");
  }

  // -------------------------
  // Timeline
  // -------------------------
  const timeline = await EventTimeConfig.findOne(
    { event: event._id },
    null,
    queryOptions,
  );

  if (!timeline) {
    throw new Error("Timeline configuration missing");
  }

  const {
    registration_open_at,
    registration_close_at,
    reveal_at,
    event_start_at,
    event_end_at,
  } = timeline;

  if (
    !registration_open_at ||
    !registration_close_at ||
    !reveal_at ||
    !event_start_at ||
    !event_end_at
  ) {
    throw new Error("Incomplete timeline configuration");
  }

  if (registration_open_at >= registration_close_at)
    throw new Error("Registration open must be before close");

  if (registration_close_at >= reveal_at)
    throw new Error("Registration close must be before reveal");

  if (reveal_at > event_start_at)
    throw new Error("Reveal must be before or equal to event start");

  if (event_start_at >= event_end_at)
    throw new Error("Event start must be before event end");

  // -------------------------
  // Women Priority
  // -------------------------
  const womenClose = timeline.women_registration_close_at;
  const menOpen = timeline.men_selection_open_at;

  if (policy.women_priority_enabled) {
    if (!womenClose || !menOpen) {
      throw new Error(
        "Women priority requires women_registration_close_at and men_selection_open_at",
        400,
      );
    }
    if (
      policy.gender_restrictions &&
      policy.gender_restrictions.length > 0 &&
      !policy.gender_restrictions.includes("female")
    ) {
      throw new Error(
        "Women priority requires female participation in gender restrictions",
        400,
      );
    }
  }

  // Women priority DISABLED
  if (!policy?.women_priority_enabled) {
    if (womenClose || menOpen) {
      throw new Error(
        "Women priority timeline fields cannot be set when women_priority_enabled is false",
        400,
      );
    }
  }

  // -------------------------
  // Group Events
  // -------------------------
  if (event.category_type === "GROUP" && policy.women_priority_enabled) {
    throw Error("Women priority not supported for group events");
  }

  if (
    event.category_type === "GROUP" &&
    (capacity.male_limit || capacity.female_limit)
  ) {
    throw Error("Group events cannot have gender capacity.");
  }

  if (
    event.category_type === "GROUP" &&
    !(capacity.group_size_max || capacity.group_size_min)
  ) {
    throw Error("Group events should have minimum and maximum group size.");
  }

  return true;
}

module.exports = validateEventBeforePublish;
