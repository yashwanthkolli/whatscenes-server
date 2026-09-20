const { getRedisClient } = require("./redisClient");
const logger = require("../utils/logger");

const isDev = process.env.NODE_ENV !== "production";

/**
 * Generic Cache-Aside Helper
 *
 * @param {string} key - Redis cache key
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {Function} fetchFn - Async function to fetch fresh data
 */
async function cacheAside(key, ttlSeconds, fetchFn) {
  const redis = getRedisClient();

  // If Redis not initialized or not connected → fallback to DB
  if (!redis || !redis.isOpen) {
    if (isDev) {
      logger.debug(`CACHE SKIP (redis not ready): ${key}`);
    }
    return fetchFn();
  }

  try {
    // Try to get from cache
    const cached = await Promise.race([
      redis.get(key),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis timeout")), 200)
      ),
    ]);

    if (cached) {
      if (isDev) {
        logger.debug(`CACHE HIT: ${key}`);
      }
      return JSON.parse(cached);
    }

    if (isDev) {
      logger.debug(`CACHE MISS: ${key}`);
    }

    // Fetch fresh data
    const freshData = await fetchFn();

    // Store in cache (only if not null/undefined)
    if (freshData !== undefined) {
      await redis.set(key, JSON.stringify(freshData), {
        EX: ttlSeconds,
      });
    }

    return freshData;

  } catch (err) {
    // Never break app because of cache
    logger.error(`Cache error for key ${key}: ${err.message}`);

    return fetchFn();
  }
}

module.exports = cacheAside;