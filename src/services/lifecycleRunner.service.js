const cron = require("node-cron");
const logger = require("../utils/logger");
const {
  processOpenTransitions,
  processCloseTransitions,
  processCompletionTransitions,
} = require("./lifecycleProcessor.service");

let lifecycleState = {
  lastRunAt: null,
  lastDurationMs: null,
  lastOpened: 0,
  lastClosed: 0,
  lastCompleted: 0,
  lastError: null,
  isRunning: false,
};

async function runLifecycleTick() {
  if (lifecycleState.isRunning) {
    logger.warn("LIFECYCLE_SKIPPED- Previous tick still running");
    return;
  }

  lifecycleState.isRunning = true;
  lifecycleState.lastError = null;

  const start = Date.now();
  const now = new Date();

  try {
    const opened = await processOpenTransitions(now);
    const closed = await processCloseTransitions(now);
    const completed = await processCompletionTransitions(now);

    lifecycleState.lastRunAt = now;
    lifecycleState.lastDurationMs = Date.now() - start;
    lifecycleState.lastOpened = opened;
    lifecycleState.lastClosed = closed;
    lifecycleState.lastCompleted = completed;

    logger.info(`LIFECYCLE_TICK- Opened=${opened} Closed=${closed} Completed=${completed} Duration=${lifecycleState.lastDurationMs}ms`);
  } catch (err) {
    lifecycleState.lastError = err.message;
    logger.error("LIFECYCLE_FATAL", err.message);
  } finally {
    lifecycleState.isRunning = false;
  }
}

function initLifecycleCron() {
  cron.schedule("* * * * *", async () => {   // Runs every 1 minute
    await runLifecycleTick();
  });

  logger.info("LIFECYCLE_CRON_INITIALIZED");
}

function getLifecycleHealth() {
  return {
    ...lifecycleState,
  };
}

module.exports = {
  initLifecycleCron,
  runLifecycleTick,
  getLifecycleHealth
};