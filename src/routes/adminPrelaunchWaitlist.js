const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const controller = require("../controllers/adminPrelaunchWaitlist.controller");
const router = express.Router();
router.use(protect, authorize("admin"));
router.get("/metrics", controller.getPrelaunchWaitlistMetrics);
router.get("/", controller.listPrelaunchWaitlist);
router.get("/:id", controller.getPrelaunchWaitlistEntry);
module.exports = router;
