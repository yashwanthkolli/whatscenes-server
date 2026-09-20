const smsConfig = {
  provider: process.env.SMS_PROVIDER || "mock",

  gonums: {
    apiKey: process.env.GONUMS_API_KEY,
    senderId: process.env.GONUMS_SENDER_ID,
    entityId: process.env.GONUMS_ENTITY_ID,
    templateId: process.env.GONUMS_TEMPLATE_ID,
  },
};

module.exports = smsConfig;
