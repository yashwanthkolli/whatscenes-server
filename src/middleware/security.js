const helmet = require('helmet');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');

// Rate limiting for different routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs for auth endpoints
  message: 'Too many authentication attempts from this IP, please try again later'
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // limit each IP to 10 requests per windowMs for otp endpoints
  message: 'Too many OTP requests from this IP, please try again later'
});

const publicDiscoveryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many requests. Please slow down.'
});

const adminMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many admin actions. Please wait.'
});

const otpPhoneLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    if (!req.body) return req.ip;

    const countryCode = req.body.countryCode || '';
    const phone = req.body.phone || '';

    if (!countryCode || !phone) return req.ip;

    return `${countryCode}-${phone}`;
  },
  message: {
    success: false,
    message: 'Too many OTP requests for this number.'
  }
});

const securityMiddleware = (app) => {
  // Set security HTTP headers
  app.use(helmet());
  
  // Data sanitization against NoSQL query injection
  app.use(mongoSanitize());
  
  // Data sanitization against XSS
  app.use(xss());
  
  // Prevent parameter pollution
  app.use(hpp());
  
  // Apply rate limiting to all requests
  app.use('/api/', generalLimiter);
  
  // Apply stronger rate limiting to auth endpoints
  app.use('/api/v1/auth/refresh', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  app.use('/api/v1/auth/forgot-password', authLimiter);

  // Apply stronger rate limiting to otp endpoints
  app.use('/api/v1/auth/otp/send', otpLimiter);
  app.use('/api/v1/auth/otp/verify', otpLimiter);
  app.use('/api/v1/auth/login/otp', otpLimiter);
  app.use('/api/v1/auth/otp/send', otpPhoneLimiter);

  // Public event discovery routes
  app.use('/api/v1/events', publicDiscoveryLimiter);
  app.use('/api/v1/questionnaires', publicDiscoveryLimiter);

  // Admin event + questionnaire routes
  app.use('/api/v1/admin/events', adminMutationLimiter);
  app.use('/api/v1/admin/questionnaires', adminMutationLimiter);
  app.use('/api/v1/admin/questions', adminMutationLimiter);
};

module.exports = securityMiddleware;