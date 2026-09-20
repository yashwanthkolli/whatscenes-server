const MINIMOTH_API_URL =
  process.env.MINIMOTH_API_URL || "https://api.minimoth.dev";

const MINIMOTH_API_KEY = process.env.MINIMOTH_API_KEY;

if (!MINIMOTH_API_KEY) {
  throw new Error("MINIMOTH_API_KEY is not configured");
}

const request = async (path, options = {}) => {
  const response = await fetch(`${MINIMOTH_API_URL}${path}`, {
    ...options,
    headers: {
      "X-Api-Key": MINIMOTH_API_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    // Ignore non-JSON responses
  }

  if (!response.ok) {
    const error = new Error(data?.error || "MiniMoth request failed");

    error.status = response.status;
    error.code = data?.code;
    error.requestId = data?.request_id;

    throw error;
  }

  return data;
};

/**
 * Send OTP
 */
const sendOtp = async ({ phone }) => {
  return request("/v1/otp/send", {
    method: "POST",
    body: JSON.stringify({
      phone,
    }),
  });
};

/**
 * Verify OTP
 */
const verifyOtp = async ({ phone, otp }) => {
  return request("/v1/otp/verify", {
    method: "POST",
    body: JSON.stringify({
      phone,
      code: otp,
    }),
  });
};

/**
 * Optional delivery status
 */
const getOtpStatus = async (otpId) => {
  return request(`/v1/otp/status/${otpId}`, {
    method: "GET",
  });
};

module.exports = {
  sendOtp,
  verifyOtp,
  getOtpStatus,
};
