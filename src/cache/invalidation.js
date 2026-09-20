const { getRedisClient } = require("./redisClient");
const logger = require("../utils/logger");

const isDev = process.env.NODE_ENV !== "production";

async function invalidateEventCaches(event) {
  const redis = getRedisClient();

  if (!redis || !redis.isOpen) {
    if (isDev) {
      logger.debug("CACHE INVALIDATION SKIPPED (redis not ready)");
    }
    return;
  }

  try {
    const { city, slug } = event;

    // Home Events 
    await redis.del("events:home:base");

    // Event Detail Cache
    await redis.del(`event:detail:${city}:${slug}`);

    for await (const result of redis.scanIterator({
      MATCH: "events:list:*",
      COUNT: 100,
    })) {
      const keys = Array.isArray(result) ? result : [result];

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    if (isDev) {
      logger.debug(
        `CACHE INVALIDATED for event ${slug} (city: ${city})`
      );
    }
  } catch (err) {
    logger.error(
      `Cache invalidation error for event ${slug}: ${err.message}`
    );
  }
}

async function invalidateProfileQuestionnaireCache(questionnaireKey) {
  const redis = getRedisClient();
  if (!redis || !redis.isOpen) return;

  const key = `profile:questionnaire:active:${questionnaireKey}`;
  await redis.del(key);
}

module.exports = {
  invalidateEventCaches,
  invalidateProfileQuestionnaireCache
};