const express = require("express");
const router = express.Router();

const {
  createEvent,
  configurePolicy,
  configureCapacity,
  configureFinancial,
  configureTimeline,
  updateEvent,
  publishEvent,
  duplicateEvent,
  transitionLifecycle,
  getAdminEvents,
  getAdminEventById,
  softDeleteEvent,
  attachQuestionnaire,
  removeQuestionnaire,
  getEventQuestionnaire,
  uploadCoverImage,
} = require("../controllers/adminEvent.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadImage } = require("../middleware/upload");

router.use(protect, authorize("admin"));

router.post("/", createEvent);
router.put("/:id/policy", configurePolicy);
router.put("/:id/capacity", configureCapacity);
router.put("/:id/financial", configureFinancial);
router.put("/:id/timeline", configureTimeline);
router.put("/:id", updateEvent);
router.patch("/:id/cover", uploadImage.single("cover"), uploadCoverImage);
router.post("/:id/publish", publishEvent);
router.post("/:id/duplicate", duplicateEvent);
router.post("/:id/transition", transitionLifecycle);
router.get("/", getAdminEvents);
router.get("/:id", getAdminEventById);
router.delete("/:id", softDeleteEvent);
router.put("/:id/questionnaire", attachQuestionnaire);
router.delete("/:id/questionnaire", removeQuestionnaire);
router.get("/:id/questionnaire", getEventQuestionnaire);

module.exports = router;
