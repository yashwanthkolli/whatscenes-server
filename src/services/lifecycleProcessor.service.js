const mongoose = require("mongoose");
const Event = require("../models/Event");
const { invalidateEventCaches } = require("../cache/invalidation");
const logger = require("../utils/logger");

const BATCH_LIMIT = 50;

/**
 * Generic transition processor
 */
async function processTransitions({
  fromStatus,
  toStatus,
  timeField,
  now,
  stageName,
}) {
  let processedCount = 0;

  const eligibleEvents = await Event.find({
    status: fromStatus,
    [timeField]: { $lte: now },
    is_deleted: false,
  })
    .select("_id")
    .limit(BATCH_LIMIT)
    .lean();

  for (const e of eligibleEvents) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const event = await Event.findById(e._id).session(session);

      if (!event) {
        await session.abortTransaction();
        session.endSession();
        continue;
      }

      // Idempotency check
      if (event.status !== fromStatus) {
        await session.abortTransaction();
        session.endSession();
        continue;
      }

      if (!event[timeField] || event[timeField] > now) {
        await session.abortTransaction();
        session.endSession();
        continue;
      }

      event.status = toStatus;
      await event.save({ session });

      await session.commitTransaction();
      session.endSession();

      await invalidateEventCaches(event);

      processedCount++;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();

      logger.error({
        type: "LIFECYCLE_ERROR",
        stage: stageName,
        eventId: e._id,
        error: err.message,
      });
    }
  }

  return processedCount;
}

async function processOpenTransitions(now) {
  return processTransitions({
    fromStatus: "PUBLISHED",
    toStatus: "REGISTRATION_OPEN",
    timeField: "registration_open_at",
    now,
    stageName: "OPEN",
  });
}

async function processCloseTransitions(now) {
  return processTransitions({
    fromStatus: "REGISTRATION_OPEN",
    toStatus: "REGISTRATION_CLOSED",
    timeField: "registration_close_at",
    now,
    stageName: "CLOSE",
  });
}

async function processCompletionTransitions(now) {
  return processTransitions({
    fromStatus: "REVEALED",
    toStatus: "COMPLETED",
    timeField: "event_end_at",
    now,
    stageName: "COMPLETE",
  });
}

module.exports = {
  processOpenTransitions,
  processCloseTransitions,
  processCompletionTransitions,
};