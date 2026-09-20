const mongoose = require("mongoose");
const { Parser } = require("json2csv");
const { randomUUID } = require("crypto");

const Event = require("../models/Event");
const EventPolicy = require("../models/EventPolicy");
const EventCapacity = require("../models/EventCapacity");
const EventRegistration = require("../models/EventRegistration");
const QuestionnaireResponse = require("../models/QuestionnaireResponse");
const EventMatchGroup = require("../models/EventMatchGroup");

const ErrorResponse = require("../utils/errorResponse");
const {
  validateRegistrationCreation,
} = require("../utils/registrationValidators");
const { parseMatchmakingCSV } = require("../utils/matchCsvParser");
const { calculateAge } = require("../utils/age");

const bookingService = require("./booking.service");

function resolveGroupSize({ event, capacity, groupSizeInput }) {
  switch (event.category_type) {
    case "SINGLE":
      return 1;

    case "COUPLE":
      return 2;

    case "GROUP":
      if (!groupSizeInput) {
        throw new ErrorResponse("Group size required", 400);
      }

      if (
        groupSizeInput < capacity.group_size_min ||
        groupSizeInput > capacity.group_size_max
      ) {
        throw new ErrorResponse("Invalid group size", 400);
      }

      return groupSizeInput;

    default:
      throw new ErrorResponse("Invalid event category", 400);
  }
}

async function createRegistration({ user, eventId, groupSizeInput }) {
  const RETRYABLE_STATUSES = ["CANCELLED", "EXPIRED", "REFUNDED"];

  const [event, policy, capacity] = await Promise.all([
    Event.findById(eventId),
    EventPolicy.findOne({ event: eventId }),
    EventCapacity.findOne({ event: eventId }),
  ]);

  const { registrationGender } = validateRegistrationCreation({
    event,
    policy,
    capacity,
    user,
  });

  const existing = await EventRegistration.findOne({
    event: eventId,
    user: user._id,
  });

  if (existing && !RETRYABLE_STATUSES.includes(existing.status)) {
    throw new ErrorResponse("Already registered for this event", 400);
  }

  const groupSize = resolveGroupSize({
    event,
    capacity,
    groupSizeInput,
  });

  const isWomenPriority =
    event.category_type === "SINGLE" && policy.women_priority_enabled;

  if (isWomenPriority && registrationGender === "male") {
    if (existing && existing.status === "SELECTED") {
      return existing; // don't downgrade
    }

    let registration;

    if (existing) {
      existing.flow_type = "WOMEN_PRIORITY";
      existing.entry_type = "WAITLIST";
      existing.status = "WAITLISTED";
      existing.gender_snapshot = registrationGender;
      existing.category_snapshot = event.category_type;
      existing.group_size = 1;
      existing.payment_required = false;
      existing.payment_status = "NONE";
      existing.expires_at = undefined;
      existing.booking_confirmed_at = undefined;

      registration = await existing.save();
    } else {
      registration = await EventRegistration.create({
        user: user._id,
        event: eventId,
        flow_type: "WOMEN_PRIORITY",
        entry_type: "WAITLIST",
        status: "WAITLISTED",
        gender_snapshot: registrationGender,
        category_snapshot: event.category_type,
        group_size: 1,
        payment_required: false,
        payment_status: "NONE",
      });
    }

    return registration;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const shouldReserve =
      !existing ||
      (existing.entry_type === "DIRECT" &&
        existing.status !== "PAYMENT_PENDING");

    if (shouldReserve) {
      // Reserve capacity for new registrations and retries after released states.
      await bookingService.reserveCapacity({
        event,
        groupSize,
        gender: registrationGender,
        session,
      });
    }

    let registration;

    if (existing) {
      existing.flow_type = isWomenPriority ? "WOMEN_PRIORITY" : "NORMAL";
      existing.entry_type = "DIRECT";
      existing.status = "PAYMENT_PENDING";
      existing.gender_snapshot = registrationGender;
      existing.category_snapshot = event.category_type;
      existing.group_size = groupSize;
      existing.payment_required = true;
      existing.payment_status = "PENDING";
      existing.expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      existing.booking_confirmed_at = undefined;

      registration = await existing.save({ session });
    } else {
      [registration] = await EventRegistration.create(
        [
          {
            user: user._id,
            event: eventId,
            flow_type: isWomenPriority ? "WOMEN_PRIORITY" : "NORMAL",
            entry_type: "DIRECT",
            status: "PAYMENT_PENDING",
            gender_snapshot: registrationGender,
            category_snapshot: event.category_type,
            group_size: groupSize,
            payment_required: true,
            payment_status: "PENDING",
            expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 min
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    return registration;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function cancelRegistration({ userId, registrationId }) {
  const registration = await EventRegistration.findById(registrationId);

  if (!registration) {
    throw new ErrorResponse("Registration not found", 404);
  }

  // Ownership check
  if (registration.user.toString() !== userId.toString()) {
    throw new ErrorResponse("Not authorized", 403);
  }

  // Idempotency check
  if (
    registration.status === "CANCELLED" ||
    registration.status === "EXPIRED"
  ) {
    return {
      alreadyCancelled: true,
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Re-fetch inside transaction
    const fresh =
      await EventRegistration.findById(registrationId).session(session);

    if (!fresh) {
      throw new ErrorResponse("Registration not found", 404);
    }

    // Double-check state
    if (fresh.status === "CANCELLED" || fresh.status === "EXPIRED") {
      await session.abortTransaction();
      session.endSession();

      return {
        alreadyCancelled: true,
      };
    }

    // Release capacity
    await bookingService.cancelBooking({
      registration: fresh,
      session,
    });

    // Update registration
    fresh.status = "CANCELLED";

    await fresh.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function getEventRegistrations({ eventId, filters }) {
  const { status, entry_type, gender, payment_status } = filters;

  // Base query
  const query = {
    event: eventId,
  };

  // Dynamic filters
  if (status?.length) {
    query.status = { $in: status };
  }

  if (entry_type?.length) {
    query.entry_type = { $in: entry_type };
  }

  if (gender?.length) {
    query.gender_snapshot = { $in: gender };
  }

  if (payment_status?.length) {
    query.payment_status = { $in: payment_status };
  }

  const registrations = await EventRegistration.find(query)
    .populate("user", "name phone email")
    .sort({ createdAt: -1 })
    .lean();

  return registrations;
}

async function exportEventRegistrationsCSV({ eventId, filters }) {
  const query = { event: eventId };

  const ALLOWED_STATUSES = [
    "INITIATED",
    "WAITLISTED",
    "SELECTED",
    "PAYMENT_PENDING",
    "CONFIRMED",
    "CANCELLED",
    "EXPIRED",
    "REFUNDED",
  ];

  const DEFAULT_STATUSES = ["CONFIRMED", "WAITLISTED"];

  const ALLOWED_ENTRY_TYPES = ["DIRECT", "WAITLIST"];

  // STATUS FILTER
  let statuses = filters.status?.filter((s) => ALLOWED_STATUSES.includes(s));

  // Apply default if not provided
  if (!statuses || statuses.length === 0) {
    statuses = DEFAULT_STATUSES;
  }

  query.status = { $in: statuses };

  // ENTRY TYPE FILTER
  if (filters.entry_type?.length) {
    const entryTypes = filters.entry_type.filter((e) =>
      ALLOWED_ENTRY_TYPES.includes(e),
    );

    if (entryTypes.length) {
      query.entry_type = { $in: entryTypes };
    }
  }

  // Fetch registrations + user
  const registrations = await EventRegistration.find(query)
    .populate(
      "user",
      "name dateOfBirth phone email gender orientation occupation education",
    )
    .lean();

  if (!registrations.length) {
    return { csv: "", count: 0 };
  }

  const userIds = registrations.map((r) => r.user?._id).filter(Boolean);

  // Fetch questionnaire responses
  const responses = await QuestionnaireResponse.find({
    user: { $in: userIds },
  }).lean();

  // Map responses by user
  const responseMap = {};

  for (const r of responses) {
    const userId = String(r.user);

    if (!responseMap[userId]) {
      responseMap[userId] = {};
    }

    for (const ans of r.answers || []) {
      if (!ans?.questionKey) continue;
      responseMap[userId][ans.questionKey] = ans.value ?? "";
    }
  }

  // Collect all unique question keys (for CSV headers)
  const allQuestions = new Set();

  Object.values(responseMap).forEach((resp) => {
    Object.keys(resp).forEach((q) => allQuestions.add(q));
  });

  const questionFields = Array.from(allQuestions);

  // Build rows
  const rows = registrations.map((r) => {
    const {
      name,
      dateOfBirth,
      phone,
      email,
      gender,
      orientation,
      occupation,
      education,
    } = r.user || {};

    const base = {
      registration_id: r._id,
      status: r.status,
      entry_type: r.entry_type,
      payment_status: r.payment_status,
      group_size: r.group_size,
      created_at: r.createdAt.toISOString(),

      name,
      age: calculateAge(dateOfBirth),
      phone,
      email,
      gender,
      orientation,
      occupation,
      education,
    };

    const userResp = responseMap[String(r.user?._id)] || {};

    // Add questionnaire fields
    questionFields.forEach((q) => {
      base[q] = userResp[q] || "";
    });

    return base;
  });

  // CSV conversion
  const parser = new Parser();
  const csv = parser.parse(rows);

  return {
    csv,
    count: rows.length,
  };
}

async function uploadMatchGroups({ eventId, fileBuffer, adminId }) {
  // Parse CSV
  const { groups, registrationIds } = parseMatchmakingCSV(fileBuffer);

  // Fetch event config
  const [capacity, policy] = await Promise.all([
    EventCapacity.findOne({ event: eventId }).lean(),
    EventPolicy.findOne({ event: eventId }).lean(),
  ]);

  if (!capacity || !policy) {
    throw new ErrorResponse("Event configuration missing", 500);
  }

  const maxGroupSize = capacity.group_size_max;

  // Fetch registrations
  const registrations = await EventRegistration.find({
    _id: { $in: registrationIds },
    event: eventId,
  }).lean();

  if (registrations.length !== registrationIds.length) {
    throw new ErrorResponse(
      "Some registrations not found or do not belong to this event",
      400,
    );
  }

  // Build map
  const registrationMap = {};
  registrations.forEach((r) => {
    registrationMap[r._id.toString()] = r;
  });

  // Validate statuses
  for (const regId of registrationIds) {
    const reg = registrationMap[regId];

    if (reg.status !== "WAITLISTED" && reg.status !== "CONFIRMED") {
      throw new ErrorResponse(
        `Invalid status for registration ${regId}. Must be WAITLISTED or CONFIRMED`,
        400,
      );
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const batchId = randomUUID();

    // Delete old groups
    await EventMatchGroup.deleteMany({ event: eventId }, { session });

    // Reset registrations
    await EventRegistration.updateMany(
      { event: eventId },
      { $set: { match_group: null } },
      { session },
    );

    let groupsCreated = 0;
    let usersProcessed = 0;

    for (const [groupNumber, regIds] of Object.entries(groups)) {
      let confirmedCount = 0;

      const members = regIds.map((regId) => {
        const reg = registrationMap[regId];

        if (reg.status === "CONFIRMED") {
          confirmedCount += reg.group_size || 1;
        }

        return {
          registration: reg._id,
          user: reg.user,
        };
      });

      const group = await EventMatchGroup.create(
        [
          {
            event: eventId,
            group_number: Number(groupNumber),
            members,
            max_group_size: maxGroupSize,
            confirmed_count: confirmedCount,
            created_by_admin: adminId,
            batch_id: batchId,
          },
        ],
        { session },
      );

      const groupId = group[0]._id;

      // Update registrations
      for (const regId of regIds) {
        const reg = registrationMap[regId];

        const update = {
          match_group: groupId,
        };

        // WAITLISTED → SELECTED
        if (reg.status === "WAITLISTED") {
          update.status = "SELECTED";
          update.expires_at = new Date(
            Date.now() + 12 * 60 * 60 * 1000, // 12 hours
          );
        }

        await EventRegistration.updateOne(
          { _id: reg._id },
          { $set: update },
          { session },
        );

        usersProcessed++;
      }

      groupsCreated++;
    }

    // Cancel unmatched users (ONLY for NORMAL events)
    // if (!policy.women_priority_enabled) {
    //   await EventRegistration.updateMany(
    //     {
    //       event: eventId,
    //       match_group: null,
    //       status: "CONFIRMED",
    //     },
    //     {
    //       $set: {
    //         status: "MATCH_NOT_FOUND",
    //       },
    //     },
    //     { session },
    //   );
    // }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      groups_created: groupsCreated,
      users_processed: usersProcessed,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function initiatePayment({ registrationId, userId }) {
  // Fetch registration
  const registration = await EventRegistration.findById(registrationId);

  if (!registration) {
    throw new ErrorResponse("Registration not found", 404);
  }

  // Ownership check
  if (registration.user.toString() !== userId.toString()) {
    throw new ErrorResponse("Not authorized", 403);
  }

  // Validate status
  const validStatuses = ["PAYMENT_PENDING", "SELECTED"];
  if (!validStatuses.includes(registration.status)) {
    throw new ErrorResponse("Payment not allowed in current state", 400);
  }

  // Fetch event
  const event = await Event.findById(registration.event);

  if (!event) {
    throw new ErrorResponse("Event not found", 404);
  }

  // Women priority check
  if (event.category_type === "SINGLE") {
    const policy = await EventPolicy.findOne({ event: event._id });

    if (policy?.women_priority_enabled) {
      // Gender check (only men go through this flow)
      if (registration.gender_snapshot !== "male") {
        throw new ErrorResponse("Invalid flow for this user", 400);
      }

      // Time check
      const now = new Date();

      if (event.men_selection_open_at && now < event.men_selection_open_at) {
        throw new ErrorResponse("Payment window not open yet", 400);
      }

      // Group check
      if (!registration.match_group) {
        throw new ErrorResponse("User not assigned to a group", 400);
      }

      const group = await EventMatchGroup.findById(registration.match_group);

      if (!group) {
        throw new ErrorResponse("Group not found", 500);
      }

      // Slot availability check
      if (group.confirmed_count >= group.max_group_size) {
        throw new ErrorResponse("Group is already full", 400);
      }
    }
  }

  // Move to PAYMENT_PENDING
  registration.status = "PAYMENT_PENDING";
  registration.payment_status = "PENDING";

  // Set expiry
  registration.expires_at = new Date(Date.now() + 10 * 60 * 1000);

  await registration.save();

  return {
    success: true,
    registrationId: registration._id,
  };
}

module.exports = {
  createRegistration,
  cancelRegistration,
  getEventRegistrations,
  exportEventRegistrationsCSV,
  uploadMatchGroups,
  initiatePayment,
};
