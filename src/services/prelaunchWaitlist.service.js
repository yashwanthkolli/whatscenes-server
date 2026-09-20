const PrelaunchWaitlist = require("../models/PrelaunchWaitlist");
const Event = require("../models/Event");
const ErrorResponse = require("../utils/errorResponse");

async function joinPrelaunchWaitlist({ userId, eventId }) {
  // Verify event exists
  const event = await Event.findById(eventId).select("_id");

  if (!event) {
    throw new ErrorResponse("Event not found", 404);
  }

  // Check for existing waitlist entry
  const existing = await PrelaunchWaitlist.findOne({
    user: userId,
    event: eventId,
  });

  if (existing) {
    throw new ErrorResponse(
      "Already joined the prelaunch waitlist for this event",
      400,
    );
  }

  try {
    const waitlistEntry = await PrelaunchWaitlist.create({
      user: userId,
      event: eventId,
    });

    return waitlistEntry;
  } catch (err) {
    // Protect against race condition where two requests
    // pass the existence check simultaneously.
    if (err.code === 11000) {
      throw new ErrorResponse(
        "Already joined the prelaunch waitlist for this event",
        400,
      );
    }

    throw err;
  }
}

module.exports = {
  joinPrelaunchWaitlist,
};
