const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const securityMiddleware = require("./middleware/security");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminQuestionRoutes = require("./routes/adminQuestions");
const adminQuestionnaireRoutes = require("./routes/adminQuestionnaires");
const questionnaireRoutes = require("./routes/questionnaires");
const onboardingRoutes = require("./routes/onboarding");
const adminEventRoutes = require("./routes/adminEvent.route");
const eventRoutes = require("./routes/events.route");
const registrationRoute = require("./routes/registration.route");
const adminRegistrationRoute = require("./routes/adminRegistration.route");
const locationRoute = require("./routes/location.route");
const prelaunchRoute = require("./routes/prelaunchWaitlist.routes");

const app = express();
app.set("trust proxy", 1);

// HTTP request logging with Morgan
app.use(morgan("tiny", { stream: logger.stream }));

// Other Middleware
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  process.env.CLIENT_URL ||
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log(allowedOrigins);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware
securityMiddleware(app);

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/admin/questions", adminQuestionRoutes);
app.use("/api/v1/admin/questionnaires", adminQuestionnaireRoutes);
app.use("/api/v1/questionnaires", questionnaireRoutes);
app.use("/api/v1/onboarding", onboardingRoutes);
app.use("/api/v1/admin/events", adminEventRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/registrations", registrationRoute);
app.use("/api/v1/admin/registrations", adminRegistrationRoute);
app.use("/api/v1/location", locationRoute);
app.use("/api/v1/prelaunch", prelaunchRoute);

// Error handling middleware (should be last)
app.use(errorHandler);

module.exports = app;
