const asyncHandler = require('../utils/asyncHandler');
const { sendOtp, verifyOtp } = require('../services/otp.service');
const ErrorResponse = require('../utils/errorResponse');
const { normalizePhone } = require('../utils/phoneUtils');

/* =========================
  SEND OTP
========================== */
exports.sendOtp = asyncHandler(async (req, res, next) => {
  const { countryCode, phone, purpose = 'login' } = req.body;

  const normalizedPhone = normalizePhone({ countryCode, number: phone });

  if (!countryCode || !phone) {
    return next(new ErrorResponse('Phone number is required', 400));
  }

  await sendOtp({
    phone: {
      countryCode: normalizedPhone.countryCode,
      number: normalizedPhone.number,
    },
    purpose,
  });

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
  });
});

/* =========================
  VERIFY OTP
========================== */
exports.verifyOtp = asyncHandler(async (req, res, next) => {
  const { countryCode, phone, otp, purpose = 'login' } = req.body;
  
  const normalizedPhone = normalizePhone({ countryCode, number: phone });

  if (!countryCode || !phone || !otp) {
    return next(new ErrorResponse('Phone number and OTP are required', 400));
  }

  await verifyOtp({
    phone: {
      countryCode: normalizedPhone.countryCode,
      number: normalizedPhone.number,
    },
    otp,
    purpose,
  });

  res.status(200).json({
    success: true,
    verified: true,
  });
});
