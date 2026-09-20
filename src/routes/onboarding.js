const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const {
  getOnboardingStatus,
} = require('../controllers/onboarding.controller');

router.get('/status', protect, getOnboardingStatus);

module.exports = router;
