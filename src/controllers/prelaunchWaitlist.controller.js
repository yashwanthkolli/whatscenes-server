const asyncHandler = require("../utils/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");

const prelaunchWaitlistService = require("../services/prelaunchWaitlist.service");

/* =========================
  Join Prelaunch Waitlist
========================== */
// @desc    Join prelaunch waitlist for an event
// @route   POST /api/v1/events/:eventId/prelaunch-waitlist
// @access  Private
exports.joinPrelaunchWaitlist = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  if (!eventId) {
    throw new ErrorResponse("Event ID is required", 400);
  }

  const waitlistEntry = await prelaunchWaitlistService.joinPrelaunchWaitlist({
    userId: req.user._id,
    eventId,
  });

  res.status(201).json({
    success: true,
    message: "Joined prelaunch waitlist successfully",
    data: waitlistEntry,
  });
});
