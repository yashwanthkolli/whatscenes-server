const express = require("express");

const {
  registerForEvent,
  initiatePayment,
  paymentSuccess,
  paymentFailure,
  cancelRegistration,
} = require("../controllers/registration.controller");

const { protect } = require("../middleware/auth");
const { requireProfileCompletion } = require("../middleware/profileCompletion");

const router = express.Router();

router.use(protect, requireProfileCompletion("basicInfo", "questionnaire"));

// Register for event
router.post("/events/:eventId/register", registerForEvent);

// Mock payment endpoints
router.post("/:id/initiate-payment", initiatePayment);
router.post("/:id/payment-success", paymentSuccess);
router.post("/:id/payment-failure", paymentFailure);

// Cancel registration
router.post("/:id/cancel", cancelRegistration);

module.exports = router;
