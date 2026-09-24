const QuestionnaireResponse = require("../models/QuestionnaireResponse");
const QuestionnaireDefinition = require("../models/QuestionnaireDefinition");
const ErrorResponse = require("../utils/errorResponse");

const updateQuestionnaireAnswers = async ({
  userId,
  questionnaireKey,
  answers,
}) => {
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new ErrorResponse("At least one answer is required", 400);
  }

  /*
   * Resolve the active questionnaire definition.
   */
  const questionnaire = await QuestionnaireDefinition.findOne({
    questionnaireKey,
    status: "active",
  }).sort({ version: -1 });

  if (!questionnaire) {
    throw new ErrorResponse("Questionnaire not found", 404);
  }

  /*
   * Find the latest submitted response first.
   *
   * Submitted responses take priority over drafts.
   */
  let response = await QuestionnaireResponse.findOne({
    user: userId,
    questionnaireKey,
    isDraft: false,
    context: "profile",
  }).sort({ submittedAt: -1, createdAt: -1 });

  let responseType = "SUBMITTED";

  /*
   * If there is no submitted response, use the latest draft.
   */
  if (!response) {
    response = await QuestionnaireResponse.findOne({
      user: userId,
      questionnaireKey,
      isDraft: true,
      context: "profile",
    }).sort({ createdAt: -1 });

    responseType = "DRAFT";
  }

  /*
   * If neither exists, create a new draft.
   */
  if (!response) {
    response = new QuestionnaireResponse({
      user: userId,
      questionnaireKey,
      questionnaireVersion: questionnaire.version,
      context: "profile",
      isDraft: true,
      answers: [],
    });

    responseType = "DRAFT";
  }

  /*
   * Build a lookup of existing answers.
   *
   * questionKey + questionVersion identifies an answer.
   */
  const existingAnswers = new Map();

  for (const answer of response.answers || []) {
    const key = `${answer.questionKey}:${answer.questionVersion}`;

    existingAnswers.set(key, answer);
  }

  /*
   * Update ONLY the supplied answers.
   */
  for (const incomingAnswer of answers) {
    const { questionKey: answerKey, value } = incomingAnswer;

    const question = questionnaire.questions?.find(
      (question) => question.questionKey === answerKey,
    );

    if (!question) {
      throw new ErrorResponse(`Invalid question: ${answerKey}`, 400);
    }

    const questionVersion = question.questionVersion;

    const lookupKey = `${answerKey}:${questionVersion}`;

    const existingAnswer = existingAnswers.get(lookupKey);

    if (existingAnswer) {
      existingAnswer.value = value;
    } else {
      response.answers.push({
        questionKey: answerKey,
        questionVersion,
        value,
      });
    }
  }

  /*
   * For a newly-created draft, make sure questionnaire version
   * is associated with the active definition.
   */
  response.questionnaireVersion = questionnaire.version;

  /*
   * If this was a submitted response, retain its submitted state.
   * If it was a draft/new response, retain draft state.
   */
  response.isDraft = responseType === "DRAFT";

  await response.save();

  return {
    response,
    responseType,
  };
};

module.exports = {
  updateQuestionnaireAnswers,
};
