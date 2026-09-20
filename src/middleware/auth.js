const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../utils/asyncHandler");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { calculateAge } = require("../utils/age");

// Protect routes
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(new ErrorResponse("Not authorized to access this route", 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id).select("-__v");

    if (!user) {
      return next(new ErrorResponse("User no longer exists", 401));
    }

    // Block inactive users
    if (user.status !== "active") {
      return next(new ErrorResponse("User account is not active", 403));
    }

    req.user = user;
    req.userAge = calculateAge(user.dateOfBirth);

    next();
  } catch (err) {
    return next(new ErrorResponse("Not authorized, token failed", 401));
  }
});

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403,
        ),
      );
    }
    next();
  };
};

// Get User details and pass them
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-__v");
    req.user = user;
    req.userAge = user ? calculateAge(user.dateOfBirth) : null;
  } else {
    req.user = null;
    req.userAge = null;
  }

  next();
});

module.exports = {
  protect,
  authorize,
  optionalAuth,
};
