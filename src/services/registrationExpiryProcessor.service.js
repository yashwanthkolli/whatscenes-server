const mongoose = require("mongoose");

const EventRegistration = require("../models/EventRegistration");
const bookingService = require("./booking.service");
const logger = require("../utils/logger");

const BATCH_LIMIT = 50;

/**
 * Process expired PAYMENT_PENDING registrations
 */
async function processExpiredRegistrations(now) {
  let processedCount = 0;

  const expiredRegistrations = await EventRegistration.find({
    status: "PAYMENT_PENDING",
    expires_at: { $lte: now },
  })
    .select("_id")
    .limit(BATCH_LIMIT)
    .lean();

  for (const r of expiredRegistrations) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const registration = await EventRegistration.findById(r._id).session(
        session,
      );

      if (!registration) {
        await session.abortTransaction();
        session.endSession();
        continue;
      }

      // Idempotency check
      if (registration.status !== "PAYMENT_PENDING") {
        await session.abortTransaction();
        session.endSession();
        continue;
      }

      if (!registration.expires_at || registration.expires_at > now) {
        await session.abortTransaction();
        session.endSession();
        continue;
      }

      // Release reserved capacity
      await bookingService.releaseCapacity({
        registration,
        session,
      });

      // Mark expired
      registration.status = "EXPIRED";
      await registration.save({ session });

      await session.commitTransaction();
      session.endSession();

      processedCount++;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();

      logger.error({
        type: "REGISTRATION_EXPIRY_ERROR",
        registrationId: r._id,
        error: err.message,
      });
    }
  }

  return processedCount;
}

module.exports = {
  processExpiredRegistrations,
};
