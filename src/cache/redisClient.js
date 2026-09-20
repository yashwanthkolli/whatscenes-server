const { createClient } = require("redis");
const logger = require("../utils/logger");

let redisClient;

async function connectRedis() {
  if (redisClient) return redisClient;

  redisClient = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    // socket: {
    //   reconnectStrategy: (retries) => {
    //     if (retries > 5) {
    //       return new Error("Redis reconnect failed");
    //     }
    //     return Math.min(retries * 100, 1000);
    //   },
    // },
  });

  redisClient.on("error", (err) => {
    logger.error("Redis Error:", err.message);
  });

  redisClient.on("connect", () => {
    logger.info("Redis connecting...");
  });

  redisClient.on("ready", () => {
    logger.info("Redis connected and ready");
  });

  redisClient.on("reconnecting", () => {
    logger.info("Redis reconnecting...");
  });

  redisClient.on("end", () => {
    logger.warn("Redis connection closed");
  });

  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err.message);
  }

  return redisClient;
}

function getRedisClient() {
  return redisClient;
}

async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis,
};