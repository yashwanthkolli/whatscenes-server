const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

const {
  createQuestionnaire,
  createQuestionnaireVersion,
  getQuestionnaires,
  deprecateQuestionnaire,
} = require('../controllers/questionnaire.controller');

router.use(protect, authorize('admin'));

router.post('/', createQuestionnaire);
router.post('/:questionnaireKey/version', createQuestionnaireVersion);
router.get('/', getQuestionnaires);
router.patch('/:id/deprecate', deprecateQuestionnaire);

module.exports = router;
