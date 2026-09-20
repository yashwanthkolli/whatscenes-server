const express = require("express");

const {
  getEventRegistrations,
  exportRegistrationsCSV,
  uploadMatchGroups,
} = require("../controllers/registration.controller");

const { protect, authorize } = require("../middleware/auth");
const { uploadCsv } = require("../middleware/upload");

const router = express.Router();

// Admin only
router.get("/:eventId", protect, authorize("admin"), getEventRegistrations);

router.get(
  "/:eventId/export",
  protect,
  authorize("admin"),
  exportRegistrationsCSV,
);

router.post(
  "/:eventId/match-groups/upload",
  protect,
  authorize("admin"),
  uploadCsv.single("file"),
  uploadMatchGroups,
);

module.exports = router;
