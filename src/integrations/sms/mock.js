const sendOtp = async ({ phone, otp }) => {
  const { countryCode, number } = phone;

  if (process.env.NODE_ENV === "development") {
    console.log(`[SMS:MOCK] OTP ${otp} sent to ${countryCode}${number}`);
  }

  return {
    success: true,
    provider: "mock",
  };
};

module.exports = {
  sendOtp,
};
