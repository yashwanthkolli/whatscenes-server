require("dotenv").config();
const app = require("./app");
const { connectDB, closeDB } = require("./config/database");
const logger = require("./utils/logger");
const { connectRedis, closeRedis } = require("./cache/redisClient");
const { initLifecycleCron } = require("./services/lifecycleRunner.service");
const {
  initRegistrationExpiryCron,
} = require("./services/registrationExpiryRunner.service");

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "127.0.0.1";

// MongoDB connection
const connectToDatabase = async () => {
  try {
    await connectDB();
  } catch (error) {
    logger.error("Failed to connect to MongoDB - retrying in 5 seconds");
    setTimeout(connectToDatabase, 5000);
  }
};
connectToDatabase();

// Redis connection
const connectToRedis = async () => {
  try {
    await connectRedis();
  } catch (error) {
    logger.error("Failed to connect to redis");
  }
};
connectToRedis();
initLifecycleCron();
initRegistrationExpiryCron();

const server = app.listen(PORT, HOST, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    closeDB();
    closeRedis();
    process.exit(0);
  });
});
process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    closeDB();
    closeRedis();
    process.exit(0);
  });
});

// For nodemon restarts
process.once("SIGUSR2", () => {
  server.close(() => {
    closeDB();
    process.kill(process.pid, "SIGUSR2");
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection! Shutting down...");
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception! Shutting down...");
  logger.error(err.name, err.message);
  process.exit(1);
});
