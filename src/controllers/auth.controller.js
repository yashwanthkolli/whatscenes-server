const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const { verifyOtp, sendOtp } = require('../services/otp.service');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} = require('../utils/jwtUtils');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { normalizePhone } = require('../utils/phoneUtils');

/* =========================
  OTP LOGIN
========================== */
// @desc    OTP Login
// @route   POST /api/v1/auth/login/otp
// @access  Public
const loginWithOtp = asyncHandler(async (req, res, next) => {
  const { countryCode, phone, otp } = req.body;

  if (!countryCode || !phone || !otp) {
    return next(
      new ErrorResponse('Phone number and OTP are required', 400)
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify OTP
    await verifyOtp(
      {
        phone: {
          countryCode,
          number: phone,
        },
        otp,
        purpose: 'login',
      },
      session
    );

    // Find or create user
    let user = await User.findOne({
      'phone.countryCode': countryCode,
      'phone.number': phone,
    }).session(session);

    if (user && user.status === 'deleted') {
      return next(
        new ErrorResponse('Account has been deleted', 403)
      );
    }

    if (!user) {
      user = await User.create(
        [
          {
            phone: {
              countryCode,
              number: phone,
            },
            phoneVerified: true,
            status: 'active',
          },
        ], { session });

        user = user[0];
    } else {
      if (!user.phoneVerified) {
        user.phoneVerified = true;
      }

      // Update login metadata
      user.lastLoginAt = new Date();
      user.lastLoginMethod = 'otp';
      await user.save({ session });
    }

    // Issue Tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    const tokenFamily = crypto.randomUUID();

    // Store hashed refresh token in DB
    await RefreshToken.create([{
      user: user._id,
      tokenHash: hashToken(refreshToken),
      tokenFamily,
      expiresAt: new Date(
        Date.now() + process.env.REFRESH_TOKEN_EXPIRE * 24 * 60 * 60 * 1000 
      ),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Set Cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000, 
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: process.env.REFRESH_TOKEN_EXPIRE * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user
      // user: {
      //   id: user._id,
      //   role: user.role,
      //   profileCompletion: user.profileCompletion
      // },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// @desc    Log user out / clear cookie
// @route   POST /api/v1/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies.refreshToken ||
    req.body.refreshToken;

  if (token) {
    const hashed = hashToken(token);
    await RefreshToken.updateOne(
      { tokenHash: hashed },
      { isRevoked: true }
    );
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Refresh Access Token
// @route   POST /api/v1/auth/refresh
// @access  Public
const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies.refreshToken ||
    req.body.refreshToken;

  if (!token) {
    return next(new ErrorResponse('Refresh token required', 401));
  }

  const hashed = hashToken(token);
  const now = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find token
    const existing = await RefreshToken.findOne({
      tokenHash: hashed,
    }).session(session);

    if (!existing) {
      throw new ErrorResponse('Invalid refresh token', 401);
    }

    // If token already revoked- REPLAY ATTACK
    if (existing.isRevoked) {
      await RefreshToken.updateMany(
        { tokenFamily: existing.tokenFamily },
        { isRevoked: true }
      ).session(session);

      throw new ErrorResponse(
        'Refresh token reuse detected. Please login again.',
        401
      );
    }

    // Expiry check
    if (existing.expiresAt < now) {
      throw new ErrorResponse('Refresh token expired', 401);
    }

    // Generate new token
    const newRefreshToken = generateRefreshToken();
    const newRefreshHash = hashToken(newRefreshToken);

    // Revoke current token
    existing.isRevoked = true;
    existing.replacedByToken = newRefreshHash;
    await existing.save({ session });

    // Create rotated token
    await RefreshToken.create(
      [
        {
          user: existing.user,
          tokenHash: newRefreshHash,
          tokenFamily: existing.tokenFamily,
          expiresAt: new Date(
            Date.now() +
              process.env.REFRESH_TOKEN_EXPIRE * 24 * 60 * 60 * 1000
          ),
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
        },
      ],
      { session }
    );

    const newAccessToken = generateAccessToken(existing.user);

    await session.commitTransaction();
    session.endSession();

    // Set cookies
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: process.env.REFRESH_TOKEN_EXPIRE * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

// @desc    Soft Delete User Account
// @route   DELETE /api/v1/auth/delete-account
// @access  Private
const deleteAccount = asyncHandler(async (req, res, next) => {
  const user = req.user;

  // Mark as deleted
  user.status = 'deleted';
  await user.save();

  // Remove all refresh tokens
  await RefreshToken.deleteMany({ user: user._id });

  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
});

// @desc    Initiate Account Reactivation
// @route   POST /api/v1/reactivate/initiate
// @access  Public
const reactivateInitiate = asyncHandler(async (req, res, next) => {
  const { countryCode, phone } = req.body;

  if (!countryCode || !phone) {
    return next(new ErrorResponse('Phone number is required', 400));
  }

  const user = await User.findOne({
    'phone.countryCode': countryCode,
    'phone.number': phone,
  });

  // Always generic response to avoid enumeration
  if (!user || user.status !== 'deleted') {
    return res.status(200).json({
      success: true,
      message: 'If account exists, OTP has been sent.',
    });
  }

  await sendOtp({
    phone: { countryCode, number: phone },
    purpose: 'reactivation',
  });

  res.status(200).json({
    success: true,
    message: 'If account exists, OTP has been sent.',
  });
});

// @desc    Confirm Account Reactivation
// @route   POST /api/v1/reactivate/confirm
// @access  Public
const reactivateConfirm = asyncHandler(async (req, res, next) => {
  const { countryCode, phone, otp } = req.body;

  if (!countryCode || !phone || !otp) {
    return next(
      new ErrorResponse('Phone number and OTP required', 400)
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify OTP (purpose reactivation)
    await verifyOtp(
      {
        phone: { countryCode, number: phone },
        otp,
        purpose: 'reactivation',
      },
      session
    );

    const user = await User.findOne({
      'phone.countryCode': countryCode,
      'phone.number': phone,
    }).session(session);

    if (!user || user.status !== 'deleted') {
      throw new ErrorResponse('Invalid reactivation request', 400);
    }

    // Reactivate
    user.status = 'active';
    user.lastLoginAt = new Date();
    user.lastLoginMethod = 'reactivation';

    await user.save({ session });

    // Create new token family
    const refreshToken = generateRefreshToken();
    const tokenFamily = crypto.randomUUID();

    await RefreshToken.create([{
      user: user._id,
      tokenHash: hashToken(refreshToken),
      tokenFamily,
      expiresAt: new Date(
        Date.now() + process.env.REFRESH_TOKEN_EXPIRE * 24 * 60 * 60 * 1000
      ),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    }], { session });

    const accessToken = generateAccessToken(user._id);

    await session.commitTransaction();
    session.endSession();

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: process.env.REFRESH_TOKEN_EXPIRE * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});


module.exports = {
  loginWithOtp, 
  logout,
  getMe,
  refreshAccessToken,
  deleteAccount,
  reactivateInitiate, 
  reactivateConfirm
};