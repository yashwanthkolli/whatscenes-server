const EventCapacity = require("../models/EventCapacity");
const EventMatchGroup = require("../models/EventMatchGroup");

async function reserveCapacity({ event, groupSize, gender, session }) {
  // Base condition: total capacity check
  let query = {
    event: event._id,
    $expr: {
      $lte: [
        { $add: ["$booked_count", "$reserved_count", groupSize] },
        "$max_total_capacity",
      ],
    },
  };

  // Apply gender constraints ONLY for SINGLE events
  if (event.category_type === "SINGLE") {
    const genderConditions = [];

    if (gender === "male") {
      genderConditions.push({
        $lte: [
          { $add: ["$male_booked_count", groupSize] },
          { $ifNull: ["$male_limit", Number.MAX_SAFE_INTEGER] },
        ],
      });
    }

    if (gender === "female") {
      genderConditions.push({
        $lte: [
          { $add: ["$female_booked_count", groupSize] },
          { $ifNull: ["$female_limit", Number.MAX_SAFE_INTEGER] },
        ],
      });
    }

    if (genderConditions.length > 0) {
      query.$expr = {
        $and: [query.$expr, ...genderConditions],
      };
    }
  }

  const updated = await EventCapacity.findOneAndUpdate(
    query,
    {
      $inc: {
        reserved_count: groupSize,
      },
    },
    {
      new: true,
      session,
    },
  );

  if (!updated) {
    throw new Error("No slots available", 400);
  }

  return updated;
}

async function confirmBooking({ registration, session }) {
  // CASE 1: Group-based booking (women priority men)
  if (registration.match_group) {
    const group = await EventMatchGroup.findOneAndUpdate(
      {
        _id: registration.match_group,

        // ATOMIC SLOT CHECK
        $expr: {
          $lt: ["$confirmed_count", "$max_group_size"],
        },
      },
      {
        $inc: {
          confirmed_count: registration.group_size || 1,
        },
      },
      {
        new: true,
        session,
      },
    );

    if (!group) {
      throw new ErrorResponse("No slots available in group", 400);
    }

    return;
  }

  // CASE 2: Normal flow (existing logic)
  const update = {
    reserved_count: -registration.group_size,
    booked_count: registration.group_size,
  };

  // Apply gender counts ONLY for SINGLE events
  if (registration.category_snapshot === "SINGLE") {
    if (registration.gender_snapshot === "male") {
      update.male_booked_count = registration.group_size;
    }

    if (registration.gender_snapshot === "female") {
      update.female_booked_count = registration.group_size;
    }
  }

  await EventCapacity.findOneAndUpdate(
    { event: registration.event },
    { $inc: update },
    { session },
  );
}

async function releaseCapacity({ registration, session }) {
  await EventCapacity.findOneAndUpdate(
    { event: registration.event },
    {
      $inc: {
        reserved_count: -registration.group_size,
      },
    },
    { session },
  );
}

async function cancelBooking({ registration, session }) {
  const update = {};

  // If PAYMENT_PENDING → release reserved
  if (registration.status === "PAYMENT_PENDING") {
    update.reserved_count = -registration.group_size;
  }

  // If CONFIRMED → release booked
  if (registration.status === "CONFIRMED") {
    update.booked_count = -registration.group_size;

    // Gender adjustment ONLY for SINGLE
    if (registration.category_snapshot === "SINGLE") {
      if (registration.gender_snapshot === "male") {
        update.male_booked_count = -registration.group_size;
      }

      if (registration.gender_snapshot === "female") {
        update.female_booked_count = -registration.group_size;
      }
    }
  }

  // WAITLISTED → no capacity impact
  if (Object.keys(update).length === 0) {
    return;
  }

  await EventCapacity.findOneAndUpdate(
    { event: registration.event },
    { $inc: update },
    { session },
  );
}

module.exports = {
  reserveCapacity,
  confirmBooking,
  releaseCapacity,
  cancelBooking,
};
