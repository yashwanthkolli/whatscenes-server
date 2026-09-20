const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const { calculateAge } = require("../utils/age");
const userService = require("../services/user.service");

/* =========================
  Helper: Check Basic Info Completion
========================== */
const checkBasicInfoCompletion = (user) => {
  const age = calculateAge(user.dateOfBirth);

  return Boolean(
    user.name &&
    age !== null &&
    user.gender &&
    user.orientation &&
    (user.occupation || user.education),
  );
};

// @desc    Update user basic info
// @route   PATCH /api/v1/user/basic-info
// @access  Private
const updateBasicInfo = asyncHandler(async (req, res, next) => {
  const {
    name,
    dateOfBirth,
    gender,
    orientation,
    email,
    occupation,
    education,
    freeTime,
    interests,
  } = req.body;
  const user = req.user;

  if (!user) return next(new ErrorResponse("User not found", 404));

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
  if (gender !== undefined) user.gender = gender;
  if (orientation !== undefined) user.orientation = orientation;
  if (occupation !== undefined) user.occupation = occupation;
  if (education !== undefined) user.education = education;
  if (freeTime !== undefined) user.freeTime = freeTime;
  if (interests !== undefined) user.interests = interests;

  user.profileCompletion.basicInfo = checkBasicInfoCompletion(user);
  await user.save();

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Update user professional info
// @route   PATCH /api/v1/user/professional-info
// @access  Private
const updateProfessionalInfo = asyncHandler(async (req, res, next) => {
  const { occupation, education } = req.body;
  const user = req.user;

  if (!user) return next(new ErrorResponse("User not found", 404));

  if (occupation !== undefined) user.occupation = occupation;
  if (education !== undefined) user.education = education;

  user.profileCompletion.basicInfo = checkBasicInfoCompletion(user);
  await user.save();

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Get user profile summary for profile page
// @route   GET /api/v1/user/profile-summary
// @access  Private
const getProfileSummary = async (req, res) => {
  const profileSummary = await userService.getProfileSummary(req.user._id);

  res.status(200).json({
    success: true,
    data: profileSummary,
  });
};

// @desc    Get user's upcoming and past events
// @route   GET /api/v1/user/my-events
// @access  Private
const getMyEvents = asyncHandler(async (req, res) => {
  const { tab, page, limit } = req.query;

  const result = await userService.getMyEvents(req.user._id, {
    tab,
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  updateBasicInfo,
  updateProfessionalInfo,
  getProfileSummary,
  getMyEvents,
};
