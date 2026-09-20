const asyncHandler = require("../utils/asyncHandler");
const adminEventService = require("../services/adminEvent.service");
const ErrorResponse = require("../utils/errorResponse");

/* =========================
  Create Event
========================== */
// @desc    Create Event Core
// @route   POST /api/v1/admin/events
// @access  Admin
const createEvent = asyncHandler(async (req, res) => {
  const adminId = req.user._id;

  const {
    title,
    slug,
    cityId,
    area,
    description,
    runtime,
    tagline,
    venue_name,
    venue_address,
    geo_coordinates,
    category_type,
    event_type,
    interest_tags,
    difficulty_level,
    search_keywords,
    is_premium,
    cover_image,
  } = req.body;

  const event = await adminEventService.createEventCore(
    {
      title,
      slug,
      cityId,
      area,
      description,
      runtime,
      tagline,
      venue_name,
      venue_address,
      geo_coordinates,
      category_type,
      event_type,
      interest_tags,
      difficulty_level,
      search_keywords,
      is_premium,
      cover_image,
    },
    adminId,
  );

  res.status(201).json({
    success: true,
    message: "Event created successfully (DRAFT)",
    data: event,
  });
});

/* =========================
  Configure Event Policy
========================== */
// @desc    Add Policy to Event
// @route   PUT /api/v1/admin/events/:id/policy
// @access  Admin
const configurePolicy = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const { id: eventId } = req.params;

  const policy = await adminEventService.configurePolicy(
    eventId,
    req.body,
    adminId,
  );

  res.status(200).json({
    success: true,
    message: "Event policy configured successfully",
    data: policy,
  });
});

/* =========================
  Configure Event Capacity
========================== */
// @desc    Set Capacity Limits to Event
// @route   PUT /api/v1/admin/events/:id/capacity
// @access  Admin
const configureCapacity = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  const capacity = await adminEventService.configureCapacity(eventId, req.body);

  res.status(200).json({
    success: true,
    message: "Event capacity configured successfully",
    data: capacity,
  });
});

/* =========================
  Configure Event Finances
========================== */
// @desc    Set Price and Other Financial Configuration of Event
// @route   PUT /api/v1/admin/events/:id/financial
// @access  Admin
const configureFinancial = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  const financial = await adminEventService.configureFinancial(
    eventId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Event financial configuration updated",
    data: financial,
  });
});

/* =========================
  Configure Event Timeline
========================== */
// @desc    Set Timeline of Event
// @route   PUT /api/v1/admin/events/:id/timeline
// @access  Admin
const configureTimeline = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  const timeline = await adminEventService.configureTimeline(eventId, req.body);

  res.status(200).json({
    success: true,
    message: "Event timeline configured successfully",
    data: timeline,
  });
});

/* =========================
  Update Event
========================== */
// @desc    Update Event Core
// @route   PUT /api/v1/admin/events/:id
// @access  Admin
const updateEvent = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  const updatedEvent = await adminEventService.updateEventCore(
    eventId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Event updated successfully",
    data: updatedEvent,
  });
});

/* =========================
  Cover Image
========================== */
// @desc    Upload Cover Image of Event
// @route   PATCH /api/v1/admin/events/:id/cover
// @access  Admin
const uploadCoverImage = asyncHandler(async (req, res, next) => {
  const { id: eventId } = req.params;

  if (!req.file) {
    return next(new ErrorResponse("Image file is required", 400));
  }

  const event = await adminEventService.uploadEventCoverImage(
    eventId,
    req.file,
    req.user._id,
  );

  res.status(200).json({
    success: true,
    data: {
      eventId: event._id,
      cover_image_url: event.cover_image.url,
    },
  });
});

/* =========================
  Publish Event
========================== */
// @desc    Publish a Draft Event
// @route   POST /api/v1/admin/events/:id/publish
// @access  Admin
const publishEvent = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const { id: eventId } = req.params;

  const event = await adminEventService.publishEvent(eventId, adminId);

  res.status(200).json({
    success: true,
    message: "Event published successfully",
    data: event,
  });
});

/* =========================
  Event Status Transition
========================== */
// @desc    Change the status of the Event
// @route   POST /api/v1/admin/events/:id/transition
// @access  Admin
const transitionLifecycle = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const { id: eventId } = req.params;
  const { nextState, reason } = req.body;

  if (!nextState) {
    return res.status(400).json({
      success: false,
      message: "nextState is required",
    });
  }

  const updatedEvent = await adminEventService.transitionLifecycle(
    eventId,
    nextState,
    adminId,
    reason,
  );

  res.status(200).json({
    success: true,
    message: `Event transitioned to ${nextState}`,
    data: updatedEvent,
  });
});

/* =========================
  Duplicate Event
========================== */
// @desc    Duplicate to Create a New Event
// @route   POST /api/v1/admin/events/:id/duplicate
// @access  Admin
const duplicateEvent = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const { id: eventId } = req.params;

  const newEvent = await adminEventService.duplicateEvent(eventId, adminId);

  res.status(201).json({
    success: true,
    message: "Event duplicated successfully",
    data: newEvent,
  });
});

/* =========================
  Fetch Events
========================== */
// @desc    Get All Events with Filters
// @route   GET /api/v1/admin/events
// @access  Admin
const getAdminEvents = asyncHandler(async (req, res) => {
  const { page, limit, status, city, event_type, is_deleted, sort } = req.query;

  const data = await adminEventService.getAdminEvents({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    status,
    city,
    event_type,
    is_deleted,
    sort,
  });

  res.status(200).json({
    success: true,
    ...data,
  });
});

/* =========================
  Fetch Event Details
========================== */
// @desc    Get Events Details with Configs
// @route   GET /api/v1/admin/events/:id
// @access  Admin
const getAdminEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const data = await adminEventService.getAdminEventById(id);

  res.status(200).json({
    success: true,
    data,
  });
});

/* =========================
  Delete Event
========================== */
// @desc    Soft Delete Event
// @route   DELETE /api/v1/admin/events/:id
// @access  Admin
const softDeleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedEvent = await adminEventService.softDeleteEvent(id);

  res.status(200).json({
    success: true,
    message: "Event soft deleted successfully",
    data: deletedEvent,
  });
});

/* =========================
  Attach Questionnaire
========================== */
// @desc    Attach a Questionnaire to Event
// @route   PUT /api/v1/admin/events/:id/questionnaire
// @access  Admin
const attachQuestionnaire = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  const config = await adminEventService.attachQuestionnaireToEvent(
    eventId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Questionnaire attached successfully",
    data: config,
  });
});

/* =========================
  Remove Questionnaire
========================== */
// @desc    Remove a Questionnaire from Event
// @route   DELETE /api/v1/admin/events/:id/questionnaire
// @access  Admin
const removeQuestionnaire = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  await adminEventService.removeQuestionnaireFromEvent(eventId);

  res.status(200).json({
    success: true,
    message: "Questionnaire removed successfully",
  });
});

/* =========================
  Fetch Questionnaire
========================== */
// @desc    Get Questionnaire Details of Event
// @route   GET /api/v1/admin/events/:id/questionnaire
// @access  Admin
const getEventQuestionnaire = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  const data = await adminEventService.getEventQuestionnaire(eventId);

  res.status(200).json({
    success: true,
    data,
  });
});

module.exports = {
  createEvent,
  configurePolicy,
  configureCapacity,
  configureFinancial,
  configureTimeline,
  updateEvent,
  uploadCoverImage,
  publishEvent,
  transitionLifecycle,
  duplicateEvent,
  getAdminEvents,
  getAdminEventById,
  softDeleteEvent,
  attachQuestionnaire,
  removeQuestionnaire,
  getEventQuestionnaire,
};
