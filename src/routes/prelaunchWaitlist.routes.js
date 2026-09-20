const express = require("express");

const {
  joinPrelaunchWaitlist,
} = require("../controllers/prelaunchWaitlist.controller");

const { protect } = require("../middleware/auth");
const { requireProfileCompletion } = require("../middleware/profileCompletion");

const router = express.Router();

router.use(protect, requireProfileCompletion("basicInfo", "questionnaire"));

// Join prelaunch waitlist
router.post("/:eventId/prelaunch-waitlist", joinPrelaunchWaitlist);

module.exports = router;
