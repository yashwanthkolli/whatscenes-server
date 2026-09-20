const express = require("express");
const router = express.Router();

const { optionalAuth } = require("../middleware/auth");
const { initializeLocation } = require("../controllers/location.controller");
const { resolveCity } = require("../middleware/resolveCity");

router.post("/initialize", optionalAuth, resolveCity, initializeLocation);

module.exports = router;
