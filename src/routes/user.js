const express = require("express");
const router = express.Router();

const { uploadImage } = require("../middleware/upload");
const { protect } = require("../middleware/auth");

const {
  updateBasicInfo,
  updateProfessionalInfo,
  getProfileSummary,
  getMyEvents,
} = require("../controllers/user.controller");
const { uploadProfilePicture } = require("../controllers/userMedia.controller");

router.patch("/basic-info", protect, updateBasicInfo);
router.patch("/professional-info", protect, updateProfessionalInfo);
router.post(
  "/profile-picture",
  protect,
  uploadImage.single("image"),
  uploadProfilePicture,
);
router.get("/profile-summary", protect, getProfileSummary);
router.get("/my-events", protect, getMyEvents);

module.exports = router;
