const asyncHandler = require("../utils/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const QuestionnaireDefinition = require("../models/QuestionnaireDefinition");
const Question = require("../models/Question");
const QuestionnaireResponse = require("../models/QuestionnaireResponse");
const mongoose = require("mongoose");
const {
  getActiveQuestionnaireBase,
} = require("../services/questionnaireDiscovery");
const questionnaireService = require("../services/questionnaire.service");
const {
  invalidateProfileQuestionnaireCache,
} = require("../cache/invalidation");
const { calculateAge } = require("../utils/age");

/* =========================
  CREATE QUESTIONNAIRE
========================== */
// @desc    Create Questionnaire Definition
// @route   POST /api/v1/admin/questionnaires
// @access  Admin
const createQuestionnaire = asyncHandler(async (req, res, next) => {
  const { questionnaireKey, type, contextMetadata, questions } = req.body;

  // Check if questionnaireKey already exists
  const existing = await QuestionnaireDefinition.findOne({
    questionnaireKey,
  });

  if (existing) {
    return next(
      new ErrorResponse(
        "Questionnaire key already exists. Use version endpoint.",
        400,
      ),
    );
  }

  // Validate referenced questions
  for (const q of questions) {
    const exists = await Question.findOne({
      questionKey: q.questionKey,
      version: q.questionVersion,
      isActive: true,
    });

    if (!exists) {
      return next(
        new ErrorResponse(
          `Invalid question reference: ${q.questionKey}@${q.questionVersion}`,
          400,
        ),
      );
    }
  }

  const questionnaire = await QuestionnaireDefinition.create({
    questionnaireKey,
    version: 1,
    type,
    contextMetadata,
    questions,
  });

  await invalidateProfileQuestionnaireCache(questionnaireKey);

  res.status(201).json({
    success: true,
    data: questionnaire,
  });
});

/* =========================
  CREATE QUESTIONNAIRE NEW VERSION
========================== */
// @desc    Edit Questionnaire and save as new version
// @route   POST /api/v1/admin/questionnaires/:questionnaireKey/version
// @access  Admin
const createQuestionnaireVersion = asyncHandler(async (req, res, next) => {
  const { questionnaireKey } = req.params;
  const { questions, contextMetadata } = req.body;

  const latest = await QuestionnaireDefinition.findOne({
    questionnaireKey,
  }).sort({ version: -1 });

  if (!latest) {
    return next(new ErrorResponse("Questionnaire not found", 404));
  }

  const newVersion = latest.version + 1;

  // Validate referenced questions
  for (const q of questions) {
    const exists = await Question.findOne({
      questionKey: q.questionKey,
      version: q.questionVersion,
      isActive: true,
    });

    if (!exists) {
      return next(
        new ErrorResponse(
          `Invalid question reference: ${q.questionKey}@${q.questionVersion}`,
          400,
        ),
      );
    }
  }

  const questionnaire = await QuestionnaireDefinition.create({
    questionnaireKey,
    version: newVersion,
    type: latest.type,
    contextMetadata: contextMetadata || latest.contextMetadata,
    questions,
  });

  await invalidateProfileQuestionnaireCache(questionnaireKey);

  res.status(201).json({
    success: true,
    data: questionnaire,
  });
});

/* =========================
  GET QUESTIONNAIRES
========================== */
// @desc    Get Questionnaires(admin) with filters
// @route   GET /api/v1/admin/questions?questionnaireKey=?type=?status=
// @access  Admin
const getQuestionnaires = asyncHandler(async (req, res, next) => {
  const { questionnaireKey, type, status } = req.query;

  const filter = {};

  if (questionnaireKey) filter.questionnaireKey = questionnaireKey;
  if (type) filter.type = type;
  if (status) filter.status = status;

  const questionnaires = await QuestionnaireDefinition.find(filter).sort({
    questionnaireKey: 1,
    version: -1,
  });

  res.status(200).json({
    success: true,
    count: questionnaires.length,
    data: questionnaires,
  });
});

/* =========================
  DEPRECATE QUESTIONNAIRE
========================== */
// @desc    Deprecate Questionnaire
// @route   PATCH /api/v1/admin/questionnaires/:id/deprecate
// @access  Admin
const deprecateQuestionnaire = asyncHandler(async (req, res, next) => {
  const questionnaire = await QuestionnaireDefinition.findById(req.params.id);

  if (!questionnaire) {
    return next(new ErrorResponse("Questionnaire not found", 404));
  }

  questionnaire.status = "deprecated";
  await questionnaire.save();

  await invalidateProfileQuestionnaireCache(questionnaireKey);

  res.status(200).json({
    success: true,
    message: "Questionnaire deprecated",
  });
});

/* =========================
  FETCH QUESTIONNAIRE
========================== */
// @desc    Fetch Active Questionnaire
// @route   GET /api/v1/questionnaires/:questionnaireKey
// @access  Private
const getActiveQuestionnaire = asyncHandler(async (req, res, next) => {
  const { questionnaireKey } = req.params;
  const user = req.user;
  const age = req.userAge ?? calculateAge(user.dateOfBirth);

  const base = await getActiveQuestionnaireBase(questionnaireKey);

  const validQuestions = base.questions;

  // Applicability filtering
  const applicableQuestions = validQuestions.filter((question) => {
    const { appliesTo } = question;

    if (!appliesTo) return true;

    // Age filtering
    if (appliesTo.ageRange && age !== null) {
      if (age < appliesTo.ageRange.min || age > appliesTo.ageRange.max) {
        return false;
      }
    }

    // Gender filtering
    if (appliesTo.gender?.length) {
      if (!appliesTo.gender.includes(user.gender)) {
        return false;
      }
    }

    // Category filtering
    if (appliesTo.category?.length) {
      if (!appliesTo.category.includes(user.category)) {
        return false;
      }
    }

    // Profession filtering
    if (appliesTo.occupation?.length) {
      if (!appliesTo.occupation.includes(user.occupation)) {
        return false;
      }
    }

    // Education filtering
    if (appliesTo.education?.length) {
      if (!appliesTo.education.includes(user.education)) {
        return false;
      }
    }

    return true;
  });

  // Fetch latest response
  let responseDoc = await QuestionnaireResponse.findOne({
    user: user._id,
    questionnaireKey,
    // questionnaireVersion: base.version,
    context: base.type,
  }).sort({ createdAt: -1 });

  // Merge answers
  const enrichedQuestions = applicableQuestions.map((question) => {
    let previousAnswer = null;
    let answered = false;

    if (responseDoc) {
      const match = responseDoc.answers.find(
        (a) =>
          a.questionKey === question.questionKey &&
          a.questionVersion === question.version,
      );

      if (match) {
        previousAnswer = match.value;
        answered = true;
      }
    }

    return {
      questionKey: question.questionKey,
      version: question.version,
      section: question.section,
      text: question.text,
      description: question.description,
      uiType: question.uiType,
      answerSchema: question.answerSchema,
      required: question.required || false,
      answered,
      previousAnswer,
    };
  });

  // Compute progress
  const total = enrichedQuestions.length;
  const answered = enrichedQuestions.filter((q) => q.answered).length;
  const requiredTotal = enrichedQuestions.filter((q) => q.required).length;
  const requiredAnswered = enrichedQuestions.filter(
    (q) => q.required && q.answered,
  ).length;

  const isComplete = requiredTotal === 0 || requiredAnswered === requiredTotal;

  res.status(200).json({
    success: true,
    data: {
      questionnaireKey: base.questionnaireKey,
      version: base.version,
      progress: {
        total,
        answered,
        requiredTotal,
        requiredAnswered,
        isComplete,
      },
      questions: enrichedQuestions,
    },
  });
});

/* =========================
  SAVE DRAFT
========================== */
// @desc    Save User Responses as Draft
// @route   PATCH /api/v1/questionnaires/:questionnaireKey/draft
// @access  Private
const saveDraft = asyncHandler(async (req, res, next) => {
  const { questionnaireKey } = req.params;
  const { answers } = req.body;
  const user = req.user;

  if (!Array.isArray(answers)) {
    return next(new ErrorResponse("Answers must be an array", 400));
  }

  // Get active questionnaire
  const definition = await QuestionnaireDefinition.findOne({
    questionnaireKey,
    status: "active",
  }).sort({ version: -1 });

  if (!definition) {
    return next(new ErrorResponse("Active questionnaire not found", 404));
  }

  // Validate each answer
  for (const ans of answers) {
    const question = definition.questions.find(
      (q) =>
        q.questionKey === ans.questionKey &&
        q.questionVersion === ans.questionVersion,
    );

    if (!question) {
      return next(
        new ErrorResponse(
          `Invalid question reference: ${ans.questionKey}`,
          400,
        ),
      );
    }

    if (ans.value === undefined) {
      return next(
        new ErrorResponse(`Answer value missing for ${ans.questionKey}`, 400),
      );
    }
  }

  const filter = {
    user: user._id,
    questionnaireKey,
    // questionnaireVersion: definition.version,
    context: definition.type,
    isDraft: true,
  };

  // Find existing draft
  let draft = await QuestionnaireResponse.findOne(filter).sort({
    questionnaireVersion: -1,
  });

  if (!draft) {
    draft = await QuestionnaireResponse.create({
      ...filter,
      questionnaireVersion: definition.version,
      answers,
    });
  } else {
    // Merge existing draft answers + incoming answers
    const mergedMap = new Map();

    draft.answers.forEach((a) => {
      mergedMap.set(`${a.questionKey}:${a.questionVersion}`, a.value);
    });
    answers.forEach((a) => {
      mergedMap.set(`${a.questionKey}:${a.questionVersion}`, a.value);
    });

    // Convert map back to array
    let mergedAnswers = Array.from(mergedMap.entries()).map(([key, value]) => {
      const [questionKey, questionVersion] = key.split(":");

      return {
        questionKey,
        questionVersion: Number(questionVersion),
        value,
      };
    });

    // If questionnaire version changed → create new response
    if (draft.questionnaireVersion !== definition.version) {
      // Keep only answers valid in new definition
      mergedAnswers = mergedAnswers.filter((ans) =>
        definition.questions.some(
          (q) =>
            q.questionKey === ans.questionKey &&
            q.questionVersion === ans.questionVersion,
        ),
      );

      await QuestionnaireResponse.create({
        ...filter,
        questionnaireVersion: definition.version,
        answers: mergedAnswers,
      });
    } else {
      // Same version → update draft
      draft.answers = mergedAnswers;
      await draft.save();
    }
  }

  res.status(200).json({
    success: true,
    message: "Draft saved successfully",
  });
});

/* =========================
  SUBMIT FINAL QUESTIONNAIRE
========================== */
// @desc    Submit Draft as Final Response to Questionnaire
// @route   POST /api/v1/questionnaires/:questionnaireKey/submit
// @access  Private
const submitQuestionnaire = asyncHandler(async (req, res, next) => {
  const { questionnaireKey } = req.params;
  const user = req.user;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const definition = await QuestionnaireDefinition.findOne({
      questionnaireKey,
      status: "active",
    })
      .sort({ version: -1 })
      .session(session);

    if (!definition) {
      throw new ErrorResponse("Active questionnaire not found", 404);
    }

    // Fetch draft strictly matching version
    const draft = await QuestionnaireResponse.findOne({
      user: user._id,
      questionnaireKey,
      questionnaireVersion: definition.version,
      context: definition.type,
      isDraft: true,
    }).session(session);

    if (!draft) {
      throw new ErrorResponse("No draft found", 400);
    }

    // Prevent duplicate final submission
    // const existingFinal = await QuestionnaireResponse.findOne({
    //   user: user._id,
    //   questionnaireKey,
    //   questionnaireVersion: definition.version,
    //   context: definition.type,
    //   isDraft: false,
    // }).session(session);

    // if (existingFinal) {
    //   throw new ErrorResponse(
    //     'Questionnaire already submitted',
    //     400
    //   );
    // }

    // Validate required questions
    const requiredQuestions = definition.questions.filter((q) => q.required);

    for (const rq of requiredQuestions) {
      const answered = draft.answers.find(
        (a) =>
          a.questionKey === rq.questionKey &&
          a.questionVersion === rq.questionVersion &&
          a.value !== undefined &&
          a.value !== null &&
          a.value !== "",
      );

      if (!answered) {
        throw new ErrorResponse(
          `Required question missing: ${rq.questionKey}`,
          400,
        );
      }
    }

    // Create final response
    await QuestionnaireResponse.create(
      [
        {
          user: user._id,
          questionnaireKey,
          questionnaireVersion: definition.version,
          context: definition.type,
          answers: draft.answers,
          isDraft: false,
        },
      ],
      { session },
    );

    // Delete draft
    await draft.deleteOne({ session });

    // Update profile completion
    user.profileCompletion.questionnaire = true;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Questionnaire submitted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

/* =========================
  UPDATE QUESTIONNAIRE ANSWERS
========================== */
// @desc    Submit Draft as Final Response to Questionnaire
// @route   PATCH /api/v1/questionnaires/:questionnaireKey/answers
// @access  Private
const updateQuestionnaireAnswers = asyncHandler(async (req, res) => {
  const { questionnaireKey } = req.params;
  const { answers } = req.body;

  const result = await questionnaireService.updateQuestionnaireAnswers({
    userId: req.user._id,
    questionnaireKey,
    answers,
  });

  res.status(200).json({
    success: true,
    data: {
      response: result.response,
      responseType: result.responseType,
    },
  });
});

module.exports = {
  createQuestionnaire,
  createQuestionnaireVersion,
  getQuestionnaires,
  deprecateQuestionnaire,
  getActiveQuestionnaire,
  saveDraft,
  submitQuestionnaire,
  updateQuestionnaireAnswers,
};
