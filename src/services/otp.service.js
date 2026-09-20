// const crypto = require("crypto");
// const Otp = require("../models/Otp");
// const ErrorResponse = require("../utils/errorResponse");

// /* =========================
//   CONFIG
// ========================== */
// const OTP_LENGTH = process.env.OTP_LENGTH;
// const OTP_EXPIRY_MINUTES = process.env.OTP_EXPIRY_MINUTES;
// const MAX_ATTEMPTS = process.env.OTP_MAX_ATTEMPTS;
// const COOLDOWN_SECONDS = process.env.OTP_COOLDOWN_SECONDS;
// const BLOCK_DURATION_MINUTES = process.env.OTP_BLOCK_DURATION_MINUTES;
// const OTP_SECRET = process.env.OTP_SECRET;

// /* =========================
//   HELPERS
// ========================== */
// const generateOtp = () => {
//   return crypto.randomInt(100000, 999999).toString();
// };

// const hashOtp = (otp) => {
//   return crypto
//     .createHash("sha256")
//     .update(otp + OTP_SECRET)
//     .digest("hex");
// };

// const getExpiryTime = () => {
//   return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
// };

// /* =========================
//   SEND OTP
// ========================== */
// const sendOtp = async ({ phone, purpose = "login" }) => {
//   const { countryCode, number } = phone;

//   // Check cooldown
//   const lastOtp = await Otp.findOne({
//     "phone.countryCode": countryCode,
//     "phone.number": number,
//     purpose,
//   }).sort({ createdAt: -1 });

//   if (lastOtp) {
//     const secondsSinceLastOtp =
//       (Date.now() - lastOtp.createdAt.getTime()) / 1000;

//     if (secondsSinceLastOtp < COOLDOWN_SECONDS) {
//       throw new ErrorResponse(
//         `Please wait ${Math.ceil(
//           COOLDOWN_SECONDS - secondsSinceLastOtp,
//         )} seconds before requesting another OTP`,
//         400,
//       );
//     }
//   }

//   // Invalidate any existing active OTPs for this phone + purpose
//   await Otp.updateMany(
//     {
//       "phone.countryCode": countryCode,
//       "phone.number": number,
//       purpose,
//       isUsed: false,
//     },
//     {
//       $set: { isUsed: true },
//     },
//   );

//   const otp = generateOtp();
//   const otpHash = hashOtp(otp);

//   try {
//     await Otp.create({
//       phone: { countryCode, number },
//       otpHash,
//       purpose,
//       expiresAt: getExpiryTime(),
//       maxAttempts: MAX_ATTEMPTS,
//     });
//   } catch (err) {
//     // Unique index violation → active OTP already exists
//     if (err.code === 11000) {
//       throw new ErrorResponse(
//         "OTP already sent. Please wait before requesting again.",
//         429,
//       );
//     }
//     throw err;
//   }

//   /**
//    * IMPORTANT:
//    * - Do NOT log OTP in production
//    * - In dev, you may return it for testing
//    */
//   if (process.env.NODE_ENV === "development") {
//     console.log(otp);
//     return { otp };
//   }

//   return { success: true };
// };

// /* =========================
//   VERIFY OTP
// ========================== */
// const verifyOtp = async ({ phone, otp, purpose = "login" }, session = null) => {
//   const { countryCode, number } = phone;

//   const otpRecord = await Otp.findOneAndUpdate(
//     {
//       "phone.countryCode": countryCode,
//       "phone.number": number,
//       purpose,
//       isUsed: false,
//       expiresAt: { $gt: new Date() },
//       attempts: { $lt: MAX_ATTEMPTS },
//     },
//     {
//       $inc: { attempts: 1 },
//     },
//     { new: true },
//   ).session(session);

//   if (!otpRecord) {
//     throw new ErrorResponse("Invalid or expired OTP", 400);
//   }

//   const incomingOtpHash = hashOtp(otp);
//   const otpMatch = crypto.timingSafeEqual(
//     Buffer.from(incomingOtpHash),
//     Buffer.from(otpRecord.otpHash),
//   );

//   // Incorrect OTP
//   if (!otpMatch) {
//     if (otpRecord.attempts >= otpRecord.maxAttempts) {
//       await Otp.updateOne({ _id: otpRecord._id }, { $set: { isUsed: true } });
//       throw new ErrorResponse("Too many incorrect attempts", 429);
//     }

//     throw new ErrorResponse("Invalid OTP", 400);
//   }

//   // Correct OTP
//   await Otp.updateOne(
//     { _id: otpRecord._id },
//     { $set: { isUsed: true } },
//   ).session(session);

//   return { verified: true };
// };

// module.exports = {
//   sendOtp,
//   verifyOtp,
// };

const ErrorResponse = require("../utils/errorResponse");
const minimoth = require("../integrations/minimoth/minimoth.client");

/* =========================
  CONFIG
========================== */

const COOLDOWN_SECONDS = Number(process.env.OTP_COOLDOWN_SECONDS) || 60;

/* =========================
  HELPERS
========================== */

const formatPhone = ({ countryCode, number }) => {
  return `${countryCode}${number}`;
};

/* =========================
  SEND OTP
========================== */

const sendOtp = async ({ phone, purpose = "login" }) => {
  const formattedPhone = formatPhone(phone);

  try {
    const result = await minimoth.sendOtp({
      phone: formattedPhone,
    });

    return {
      success: true,
      otpId: result.otp_id,
    };
  } catch (error) {
    if (error.code === "OTP_RATE_LIMITED") {
      throw new ErrorResponse(
        "Too many OTP requests. Please wait before requesting another OTP.",
        429,
      );
    }

    if (error.code === "INVALID_PHONE") {
      throw new ErrorResponse("Please enter a valid phone number.", 422);
    }

    if (error.code === "INSUFFICIENT_BALANCE") {
      throw new ErrorResponse(
        "OTP service is temporarily unavailable. Please try again later.",
        503,
      );
    }

    if (error.code === "SMS_FAILED") {
      throw new ErrorResponse(
        "Unable to send OTP right now. Please try again later.",
        503,
      );
    }

    throw error;
  }
};

/* =========================
  VERIFY OTP
========================== */

const verifyOtp = async ({ phone, otp, purpose = "login" }, session = null) => {
  const formattedPhone = formatPhone(phone);

  try {
    await minimoth.verifyOtp({
      phone: formattedPhone,
      otp,
    });

    return {
      verified: true,
    };
  } catch (error) {
    if (error.code === "OTP_NOT_FOUND") {
      throw new ErrorResponse("Invalid or expired OTP", 400);
    }

    if (error.code === "INVALID_OTP") {
      throw new ErrorResponse("Invalid OTP", 400);
    }

    if (error.code === "VERIFY_RATE_LIMITED") {
      throw new ErrorResponse("Too many incorrect attempts", 429);
    }

    throw error;
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
};
