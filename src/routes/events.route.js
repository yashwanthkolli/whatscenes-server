const express = require("express");
const router = express.Router();

const {
  getEventsListing,
  getHomeEvents,
  getPublicEventDetail,
  getPublicEventQuestionnaire,
} = require("../controllers/publicEvent.controller");
const { optionalAuth } = require("../middleware/auth");
const { resolveCity } = require("../middleware/resolveCity");

router.post("/home", optionalAuth, resolveCity, getHomeEvents);
router.get("/", optionalAuth, getEventsListing);
router.get("/:city/:slug", optionalAuth, resolveCity, getPublicEventDetail);
router.get(
  "/:city/:slug/questionnaire",
  optionalAuth,
  getPublicEventQuestionnaire,
);

module.exports = router;
