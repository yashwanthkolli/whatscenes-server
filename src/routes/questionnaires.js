const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth");
const {
  getActiveQuestionnaire,
  saveDraft,
  submitQuestionnaire,
  updateQuestionnaireAnswers,
} = require("../controllers/questionnaire.controller");
const { requireProfileCompletion } = require("../middleware/profileCompletion");

router.get(
  "/:questionnaireKey",
  protect,
  requireProfileCompletion("basicInfo"),
  getActiveQuestionnaire,
);
router.patch("/:questionnaireKey/draft", protect, saveDraft);
router.post("/:questionnaireKey/submit", protect, submitQuestionnaire);
router.patch("/:questionnaireKey/answers", protect, updateQuestionnaireAnswers);

module.exports = router;
