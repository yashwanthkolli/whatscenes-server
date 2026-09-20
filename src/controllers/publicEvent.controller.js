const asyncHandler = require("../utils/asyncHandler");
const eventDiscoveryService = require("../services/eventDiscovery.service");

/* =========================
  Fetch Homepage Events
========================== */
// @desc    Get All the Displayed Events on Homepage
// @route   GET /api/v1/events/home
// @access  Public
const getHomeEvents = asyncHandler(async (req, res) => {
  const user = req.user || null;
  const resolvedCity = req.resolvedCity;

  const data = await eventDiscoveryService.getHomeEvents({
    user,
    resolvedCity,
  });

  res.status(200).json({
    success: true,
    data,
  });
});

/* =========================
  Fetch Events
========================== */
// @desc    Get Events with Filters and Search
// @route   GET /api/v1/events
// @access  Public
const getEventsListing = asyncHandler(async (req, res) => {
  const {
    search,
    city,
    area,
    event_type,
    difficulty_level,
    interest_tags,
    page,
    limit,
    sort,
  } = req.query;

  const data = await eventDiscoveryService.getEventsListing({
    query: search,
    city,
    area,
    event_type,
    difficulty_level,
    interest_tags,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
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
// @desc    Get Event Details including Config Data
// @route   GET /api/v1/events/:city/:slug
// @access  Public
const getPublicEventDetail = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const city = req.resolvedCity;

  const data = await eventDiscoveryService.getPublicEventDetail({
    city,
    slug,
    user: req.user,
  });

  res.status(200).json({
    success: true,
    data,
  });
});

/* =========================
  Fetch Event Questionnaire
========================== */
// @desc    Get Event Questionnaire
// @route   GET /api/v1/events/:city/:slug/questionnaire
// @access  Public
const getPublicEventQuestionnaire = asyncHandler(async (req, res) => {
  const { city, slug } = req.params;

  const data = await eventDiscoveryService.getPublicEventQuestionnaire({
    city,
    slug,
  });

  res.status(200).json({
    success: true,
    data,
  });
});

module.exports = {
  getHomeEvents,
  getEventsListing,
  getPublicEventDetail,
  getPublicEventQuestionnaire,
};
