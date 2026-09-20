const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate JWT Access token
const generateAccessToken  = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Extract token from request
const getTokenFromRequest = (req) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.query && req.query.accessToken) {
    token = req.query.accessToken;
  }

  return token;
};

// Generate Refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Hash Token
const hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

module.exports = {
  generateAccessToken ,
  verifyToken,
  getTokenFromRequest,
  generateRefreshToken,
  hashToken
};