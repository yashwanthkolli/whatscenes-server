const cacheAside = require("../cache/cacheAside");
const { profileQuestionnaireKey } = require("../cache/cacheKeys");
const Question = require("../models/Question");
const QuestionnaireDefinition = require("../models/QuestionnaireDefinition");

async function getActiveQuestionnaireBase(questionnaireKey) {
  const key = profileQuestionnaireKey(questionnaireKey);

  return cacheAside(key, 3600, async () => {
    const definition = await QuestionnaireDefinition.findOne({
      questionnaireKey,
      status: "active",
    })
      .sort({ version: -1 })
      .lean();

    if (!definition) {
      throw new Error("Active questionnaire not found");
    }

    const questionFilters = definition.questions.map((q) => ({
      questionKey: q.questionKey,
      version: q.questionVersion,
      isActive: true,
    }));

    const questionDocs = await Question.find({
      $or: questionFilters,
    }).lean();

    const questionMap = new Map();
    questionDocs.forEach((q) => {
      questionMap.set(`${q.questionKey}@${q.version}`, q);
    });

    const orderedQuestions = definition.questions
      .map((q) => questionMap.get(`${q.questionKey}@${q.questionVersion}`))
      .filter(Boolean)
      .map((question) => {
        const requiredEntry = definition.questions.find(
          (q) =>
            q.questionKey === question.questionKey &&
            q.questionVersion === question.version,
        );

        return {
          questionKey: question.questionKey,
          version: question.version,
          text: question.text,
          description: question.description,
          section: question.section,
          uiType: question.uiType,
          answerSchema: question.answerSchema,
          required: requiredEntry?.required || false,
          appliesTo: question.appliesTo || null,
        };
      });

    return {
      questionnaireKey: definition.questionnaireKey,
      version: definition.version,
      type: definition.type,
      questions: orderedQuestions,
    };
  });
}

module.exports = {
  getActiveQuestionnaireBase,
};
