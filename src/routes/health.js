const express = require('express');
const { healthCheck, getLifecycleHealthStatus } = require('../controllers/healthCheck');

const router = express.Router();

router.get('/', healthCheck);
router.get('/lifecycle', getLifecycleHealthStatus);

module.exports = router;