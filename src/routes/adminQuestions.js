const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

const {
  createQuestion,
  createQuestionVersion,
  getQuestions,
  deactivateQuestion,
} = require('../controllers/question.controller');

router.use(protect, authorize('admin'));

router.post('/', createQuestion);
router.post('/:questionKey/version', createQuestionVersion);
router.get('/', getQuestions);
router.patch('/:id/deactivate', deactivateQuestion);

module.exports = router;
