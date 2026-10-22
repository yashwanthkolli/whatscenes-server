const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const {
  listUsers,
  getUserMetrics,
  getUserById,
  suspendUser,
  reactivateUser,
} = require("../controllers/adminUser.controller");

const router = express.Router();

// Every endpoint in this router requires an authenticated admin.
router.use(protect, authorize("admin"));

// Keep /metrics before /:id to avoid treating "metrics" as a user ID.
router.get("/metrics", getUserMetrics);
router.get("/", listUsers);
router.get("/:id", getUserById);
router.patch("/:id/suspend", suspendUser);
router.patch("/:id/reactivate", reactivateUser);

module.exports = router;
