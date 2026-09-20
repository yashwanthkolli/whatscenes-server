const axios = require("axios");
const smsConfig = require("../../config/sms");

const GONUMS_SMS_URL = "https://sms-api.mapthrust.io/dev/bulkV2";

const sendOtp = async ({ phone, otp }) => {
  const { countryCode, number } = phone;

  if (countryCode !== "+91") {
    throw new Error("Gonums SMS currently supports Indian phone numbers only");
  }

  const { apiKey, senderId, entityId, templateId } = smsConfig.gonums;

  if (!apiKey) {
    throw new Error("GONUMS_API_KEY is not configured");
  }

  if (!senderId || !entityId || !templateId) {
    throw new Error("Gonums DLT SMS configuration is incomplete");
  }

  const message = `Hello, ${otp} is the OTP for your-app-name login using your phone number. Do not share it to anyone.`;

  try {
    const response = await axios.get(GONUMS_SMS_URL, {
      params: {
        authorization: apiKey,
        route: "dlt_manual",
        sender_id: senderId,
        template_id: templateId,
        entity_id: entityId,
        message,
        numbers: [String(number)],
      },
      timeout: 10000,
    });

    console.log(response);

    return {
      success: true,
      provider: "gonums",
      data: response.data,
    };
  } catch (error) {
    const providerError = error.response?.data;

    console.error("[GONUMS SMS ERROR]", {
      status: error.response?.status,
      data: providerError,
      message: error.message,
    });

    throw new Error(
      providerError?.message ||
        providerError?.error ||
        "Failed to send OTP through Gonums",
    );
  }
};

module.exports = {
  sendOtp,
};
