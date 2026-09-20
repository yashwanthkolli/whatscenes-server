const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../utils/asyncHandler");
const Question = require("../models/Question");

/* =========================
  CREATE QUESTION
========================== */
// @desc    Create Question
// @route   POST /api/v1/admin/questions
// @access  Admin
const createQuestion = asyncHandler(async (req, res, next) => {
  const {
    questionKey,
    text,
    description,
    section,
    uiType,
    answerSchema,
    appliesTo,
    scoreTag,
  } = req.body;

  // Check if questionKey already exists
  const existing = await Question.findOne({ questionKey });

  if (existing) {
    return next(
      new ErrorResponse(
        "Question with this key already exists. Use version endpoint.",
        400,
      ),
    );
  }

  const question = await Question.create({
    questionKey,
    version: 1,
    text,
    description,
    section,
    uiType,
    answerSchema,
    appliesTo,
    scoreTag,
  });

  res.status(201).json({
    success: true,
    data: question,
  });
});

/* =========================
  CREATE QUESTION NEW VERSION
========================== */
// @desc    Edit question and save as new version
// @route   POST /api/v1/admin/questions/:questionKey/version
// @access  Admin
const createQuestionVersion = asyncHandler(async (req, res, next) => {
  const { questionKey } = req.params;

  const latest = await Question.findOne({ questionKey }).sort({
    version: -1,
  });

  if (!latest) {
    return next(new ErrorResponse("Question key not found", 404));
  }

  const newVersion = latest.version + 1;

  const question = await Question.create({
    ...req.body,
    questionKey,
    version: newVersion,
  });

  res.status(201).json({
    success: true,
    data: question,
  });
});

/* =========================
  GET QUESITONS
========================== */
// @desc    Get Questions(admin) with filters
// @route   GET /api/v1/admin/questions?questionKey=?context=?active=
// @access  Admin
const getQuestions = asyncHandler(async (req, res, next) => {
  const { questionKey, context, active } = req.query;

  const filter = {};

  if (questionKey) filter.questionKey = questionKey;
  if (active) filter.isActive = active === "true";
  if (context) filter["appliesTo.context"] = context;

  const questions = await Question.find(filter).sort({
    questionKey: 1,
    version: -1,
  });

  res.status(200).json({
    success: true,
    count: questions.length,
    data: questions,
  });
});

/* =========================
  DEACTIVATE QUESITON
========================== */
// @desc    Deactivate Question
// @route   PATCH /api/v1/admin/questions/:id/deactivate
// @access  Admin
const deactivateQuestion = asyncHandler(async (req, res, next) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    return next(new ErrorResponse("Question not found", 404));
  }

  question.isActive = false;
  await question.save();

  res.status(200).json({
    success: true,
    message: "Question deactivated",
  });
});

module.exports = {
  createQuestion,
  createQuestionVersion,
  getQuestions,
  deactivateQuestion,
};
