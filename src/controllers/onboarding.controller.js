const asyncHandler = require('../utils/asyncHandler');

/* =========================
  Get Onboarding Status
========================== */
// @desc    Get Onboarding Status
// @route   GET /api/v1/onboarding/status
// @access  Private
exports.getOnboardingStatus = asyncHandler(async (req, res, next) => {
  const user = req.user;

  const {
    phoneVerified,
    profileCompletion: {
      basicInfo,
      photos,
      questionnaire,
      verification,
    },
  } = user;

  let nextStep = null;

  if (!phoneVerified) nextStep = 'phone_verification';
  else if (!basicInfo) nextStep = 'basic_info';
  else if (!photos) nextStep = 'photos';
  else if (!questionnaire) nextStep = 'questionnaire';
  else if (!verification) nextStep = 'verification';
  else nextStep = 'completed';

  const steps = [
    phoneVerified,
    basicInfo,
    photos,
    questionnaire,
    verification,
  ];

  const completedSteps = steps.filter(Boolean).length;
  const progressPercent = Math.round(
    (completedSteps / steps.length) * 100
  );

  res.status(200).json({
    success: true,
    data: {
      phoneVerified,
      basicInfoComplete: basicInfo,
      photosComplete: photos,
      questionnaireComplete: questionnaire,
      verificationComplete: verification,
      isFullyOnboarded: nextStep === 'completed',
      nextStep,
      progressPercent,
    },
  });
});
