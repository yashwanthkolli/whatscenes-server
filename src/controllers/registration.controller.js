const EventRegistration = require("../models/EventRegistration");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../utils/asyncHandler");

const Event = require("../models/Event");
const EventPolicy = require("../models/EventPolicy");

const registrationService = require("../services/registration.service");
const bookingService = require("../services/booking.service");

const mongoose = require("mongoose");
const { mapRegistration } = require("../utils/registration.mapper");

/* =========================
  Register for event
========================== */
// @desc    Register for an event
// @route   POST /api/v1/events/:eventId/register
// @access  Private
exports.registerForEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { group_size } = req.body;

  const registration = await registrationService.createRegistration({
    user: req.user,
    eventId,
    groupSizeInput: group_size,
  });

  res.status(201).json({
    success: true,
    data: mapRegistration(registration),
  });
});

/* =========================
  Initiate Payment
========================== */
// @desc    Initiate Payment for SELECTED Users
// @route   POST /api/v1/registrations/:id/initiate-payment
// @access  Private
exports.initiatePayment = asyncHandler(async (req, res) => {
  const result = await registrationService.initiatePayment({
    registrationId: req.params.id,
    userId: req.user._id,
  });

  res.status(200).json({
    success: true,
    message: "Payment initiated",
    data: result,
  });
});

/* =========================
  Mock Payment Success
========================== */
// @desc    Mock Payment Success
// @route   POST /api/v1/registrations/:id/payment-success
// @access  Private
exports.paymentSuccess = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const registration = await EventRegistration.findById(
      req.params.id,
    ).session(session);

    if (!registration) {
      throw new ErrorResponse("Registration not found", 404);
    }

    if (registration.status !== "PAYMENT_PENDING") {
      throw new ErrorResponse("Invalid state", 400);
    }

    await bookingService.confirmBooking({
      registration,
      session,
    });

    // Update registration
    registration.status = "CONFIRMED";
    registration.payment_status = "SUCCESS";
    registration.booking_confirmed_at = new Date();

    await registration.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Payment successful, booking confirmed",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/* =========================
  Mock Payment Failure
========================== */
// @desc    Mock Payment Failure
// @route   POST /api/v1/registrations/:id/payment-failure
// @access  Private
exports.paymentFailure = asyncHandler(async (req, res) => {
  const registration = await EventRegistration.findById(req.params.id);

  if (!registration) {
    throw new ErrorResponse("Registration not found", 404);
  }

  const validStatuses = ["PAYMENT_PENDING"];

  if (!validStatuses.includes(registration.status)) {
    throw new ErrorResponse("Invalid registration state", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(registration.event).session(session);
    const policy = await EventPolicy.findOne({ event: event._id }).session(
      session,
    );

    const isWomenPriority =
      event.category_type === "SINGLE" &&
      policy?.women_priority_enabled &&
      registration.gender_snapshot === "male";

    if (isWomenPriority) {
      registration.status = "SELECTED";
      registration.payment_status = "FAILED";
    } else {
      // Release reserved capacity
      await bookingService.releaseCapacity({ registration, session });

      // Update registration
      registration.status = "CANCELLED";
      registration.payment_status = "FAILED";
    }

    await registration.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: mapRegistration(registration),
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/* =========================
  Cancel Registration
========================== */
// @desc    Cancel registration
// @route   POST /api/v1/registrations/:id/cancel
// @access  Private
exports.cancelRegistration = asyncHandler(async (req, res) => {
  const result = await registrationService.cancelRegistration({
    userId: req.user._id,
    registrationId: req.params.id,
  });

  if (result.alreadyCancelled) {
    return res.status(200).json({
      success: true,
      message: "Already cancelled",
    });
  }

  res.status(200).json({
    success: true,
    message: "Registration cancelled successfully",
  });
});

/* =========================
  Fetch registrations of an Event
========================== */
// @desc    Get event registrations (admin)
// @route   GET /api/v1/admin/registrations/:eventId
// @access  Admin
exports.getEventRegistrations = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  // helper to normalize into array
  const normalize = (value) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    return value.split(","); // "a,b" → ["a","b"]
  };

  const filters = {
    status: normalize(req.query.status),
    entry_type: normalize(req.query.entry_type),
    gender: normalize(req.query.gender),
    payment_status: normalize(req.query.payment_status),
  };

  const registrations = await registrationService.getEventRegistrations({
    eventId,
    filters,
  });

  res.status(200).json({
    success: true,
    data: registrations,
  });
});

/* =========================
  Get Excel sheet
========================== */
// @desc    Get CSV file of registrations
// @route   GET /api/v1/admin/registrations/:eventId/export
// @access  Admin
exports.exportRegistrationsCSV = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  // helper to normalize into array
  const normalize = (value) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    return value.split(","); // "a,b" → ["a","b"]
  };

  const filters = {
    status: normalize(req.query.status),
    entry_type: normalize(req.query.entry_type),
  };

  const { csv, count } = await registrationService.exportEventRegistrationsCSV({
    eventId,
    filters,
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=event-${eventId}-registrations.csv`,
  );

  return res.status(200).send(csv);
});

/* =========================
  Upload Excel sheet
========================== */
// @desc    Upload CSV file of matches
// @route   POST /api/v1/admin/registrations/:eventId/match-groups/upload
// @access  Admin
exports.uploadMatchGroups = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  // Validate file presence
  if (!req.file || !req.file.buffer) {
    throw new ErrorResponse("CSV file is required", 400);
  }

  // Basic mime/type check
  const isCSV =
    req.file.mimetype === "text/csv" || req.file.originalname.endsWith(".csv");

  if (!isCSV) {
    throw new ErrorResponse("Only CSV files are allowed", 400);
  }

  // Call service
  const result = await registrationService.uploadMatchGroups({
    eventId,
    fileBuffer: req.file.buffer,
    adminId: req.user._id,
  });

  return res.status(200).json({
    success: true,
    message: "Match groups uploaded successfully",
    data: result,
  });
});
