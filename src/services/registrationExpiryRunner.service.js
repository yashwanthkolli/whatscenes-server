const cron = require("node-cron");
const logger = require("../utils/logger");

const {
  processExpiredRegistrations,
} = require("./registrationExpiryProcessor.service");

let expiryState = {
  lastRunAt: null,
  lastDurationMs: null,
  lastProcessed: 0,
  lastError: null,
  isRunning: false,
};

/**
 * Single tick execution
 */
async function runRegistrationExpiryTick() {
  if (expiryState.isRunning) {
    logger.warn("REGISTRATION_EXPIRY_SKIPPED - Previous tick still running");
    return;
  }

  expiryState.isRunning = true;
  expiryState.lastError = null;

  const start = Date.now();
  const now = new Date();

  try {
    const processed = await processExpiredRegistrations(now);

    expiryState.lastRunAt = now;
    expiryState.lastDurationMs = Date.now() - start;
    expiryState.lastProcessed = processed;

    logger.info(
      `REGISTRATION_EXPIRY_TICK - Processed=${processed} Duration=${expiryState.lastDurationMs}ms`,
    );
  } catch (err) {
    expiryState.lastError = err.message;

    logger.error("REGISTRATION_EXPIRY_FATAL", err.message);
  } finally {
    expiryState.isRunning = false;
  }
}

/**
 * Initialize cron
 */
function initRegistrationExpiryCron() {
  cron.schedule("* * * * *", async () => {
    await runRegistrationExpiryTick();
  });

  logger.info("REGISTRATION_EXPIRY_CRON_INITIALIZED");
}

/**
 * Health endpoint support
 */
function getRegistrationExpiryHealth() {
  return {
    ...expiryState,
  };
}

module.exports = {
  initRegistrationExpiryCron,
  runRegistrationExpiryTick,
  getRegistrationExpiryHealth,
};
