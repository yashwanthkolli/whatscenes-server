const Event = require("../models/Event");
const EventTimeConfig = require("../models/EventTimeConfig");
const EventCapacity = require("../models/EventCapacity");

async function eventMutabilityGuard({ eventId, updatePayload, moduleType }) {
  const event = await Event.findById(eventId);

  if (!event) throw new Error("Event not found");
  if (event.is_deleted) throw new Error("Cannot edit deleted event");

  const status = event.status;

  // -------------------------
  // DRAFT & PUBLISHED → fully editable
  // -------------------------
  if (["DRAFT", "PUBLISHED"].includes(status)) {
    return true;
  }

  // -------------------------
  // REGISTRATION_OPEN Rules
  // -------------------------
  if (status === "REGISTRATION_OPEN") {
    if (moduleType === "CORE") {
      const forbiddenFields = [
        "city",
        "area",
        "category_type",
        "slug",
        "venue_name",
        "venue_address",
        "event_type",
        "category_type",
        "visibility_scope",
      ];

      for (const field of forbiddenFields) {
        if (field in updatePayload) {
          throw new Error(`Cannot modify ${field} after registration opens`);
        }
      }
    }

    if (moduleType === "CAPACITY") {
      const capacity = await EventCapacity.findOne({ event: eventId });

      if (!capacity) {
        throw new Error("Capacity configuration missing");
      }

      if (
        "group_size_min" in updatePayload ||
        "group_size_max" in updatePayload
      ) {
        throw new Error("Cannot modify group size after registration opens");
      }

      if ("max_total_capacity" in updatePayload) {
        const newCapacity = updatePayload.max_total_capacity;

        if (newCapacity < capacity.max_total_capacity) {
          throw new Error(
            "Cannot reduce max capacity after registration opens",
          );
        }
      }
    }

    if (moduleType === "TIMELINE") {
      const timeline = await EventTimeConfig.findOne({ event: eventId });

      if (!timeline) {
        throw new Error("Timeline configuration missing");
      }

      if ("registration_close_at" in updatePayload) {
        const newClose = new Date(updatePayload.registration_close_at);
        const oldClose = timeline.registration_close_at;

        if (newClose < oldClose) {
          throw new Error("Cannot shorten registration window after it opens");
        }
      }

      if ("event_start_at" in updatePayload) {
        const newStart = new Date(updatePayload.event_start_at);
        const oldStart = timeline.event_start_at;

        if (newStart < oldStart) {
          throw new Error("Cannot move event earlier after registration opens");
        }
      }
    }

    if (moduleType === "QUESTIONNAIRE") {
      throw new Error("Cannot modify questionnaire after registration opened");
    }
  }

  // -------------------------
  // REGISTRATION_CLOSED Rules
  // -------------------------
  if (status === "REGISTRATION_CLOSED") {
    if (["CORE", "CAPACITY"].includes(moduleType)) {
      throw new Error(
        "Cannot modify core or capacity after registration closes",
      );
    }

    if (moduleType === "TIMELINE") {
      const forbiddenTimelineFields = [
        "registration_open_at",
        "registration_close_at",
      ];

      for (const field of forbiddenTimelineFields) {
        if (field in updatePayload) {
          throw new Error(`Cannot modify ${field} after registration closes`);
        }
      }
    }

    if (moduleType === "FINANCIAL") {
      const forbiddenFields = [
        "base_price_men",
        "base_price_women",
        "discounted_price_men",
        "discounted_price_women",
      ];

      for (const field of forbiddenFields) {
        if (field in updatePayload) {
          throw new Error(`Cannot change ${field} after registration closes`);
        }
      }
    }

    if (moduleType === "QUESTIONNAIRE") {
      throw new Error("Cannot modify questionnaire after registration closes");
    }
  }

  // -------------------------
  // MATCHING_PENDING and beyond
  // -------------------------
  if (
    ["MATCHING_PENDING", "MATCH_CONFIRMED", "REVEALED", "COMPLETED"].includes(
      status,
    )
  ) {
    throw new Error(`Event cannot be edited in ${status} state`);
  }

  return true;
}

module.exports = eventMutabilityGuard;
