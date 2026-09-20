const mongoose = require('mongoose');
const { ALLOWED_TRANSITIONS } = require("./eventStateMachine");
const Event = require("../models/Event");
const EventPolicy = require("../models/EventPolicy");
const EventCapacity = require("../models/EventCapacity");
const EventFinancial = require("../models/EventFinancial");
const EventTimeConfig = require("../models/EventTimeConfig");
const validateEventBeforePublish = require("./eventPublishValidator");
const { invalidateEventCaches } = require('../cache/invalidation');

async function validatePreconditions(event, nextState) {
  switch (nextState) {
    case "PUBLISHED": {
      await validateEventBeforePublish(event._id);

      break;
    }

    case "REGISTRATION_OPEN": {
      const timeline = await EventTimeConfig.findOne({ event: event._id });

      if (!timeline) {
        throw new Error("Timeline configuration missing.");
      }

      const now = new Date();
      if (now < timeline.registration_open_at) {
        throw new Error("Registration open time not reached yet.");
      }

      break;
    }

    default:
      break;
  }
}

async function transitionEventState({
  eventId,
  nextState,
  performedBy,
  reason = null,
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(eventId).session(session);

    if (!event) throw new Error("Event not found");
    if (event.is_deleted) throw new Error("Cannot transition deleted event");

    const currentState = event.status;

    // Idempotency
    if (currentState === nextState) {
      await session.commitTransaction();
      session.endSession();
      return event;
    }

    const allowedNextStates =
      ALLOWED_TRANSITIONS[currentState] || [];

    if (!allowedNextStates.includes(nextState)) {
      throw new Error(
        `Invalid state transition: ${currentState} → ${nextState}`
      );
    }

    // Optional: restrict some states from manual override
    const restrictedStates = [
      "MATCH_CONFIRMED",
      "REVEALED",
      "COMPLETED"
    ];

    if (restrictedStates.includes(nextState)) {
      throw new Error(
        `${nextState} can only be triggered by system automation`
      );
    }

    // Validate special cases
    if (nextState === "PUBLISHED") {
      await validateEventBeforePublish(event._id, session);
    }

    if (nextState === "REGISTRATION_OPEN") {
      const timeline = await EventTimeConfig.findOne(
        { event: event._id },
        null,
        { session }
      );

      if (!timeline)
        throw new Error("Timeline configuration missing");

      const now = new Date();
      if (now < timeline.registration_open_at) {
        throw new Error(
          "Cannot manually open registration before open time"
        );
      }
    }

    event.status = nextState;

    await event.save({ session });

    await session.commitTransaction();
    session.endSession();

    if (currentState !== event.status) {
      await invalidateEventCaches(event);
    }

    return event;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = transitionEventState;