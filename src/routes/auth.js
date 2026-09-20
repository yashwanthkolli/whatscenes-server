const express = require('express');
const {
  logout,
  getMe,
  updateDetails,
  loginWithOtp, 
  refreshAccessToken,
  deleteAccount,
  reactivateInitiate,
  reactivateConfirm
} = require('../controllers/auth.controller');
const {
  sendOtp, 
  verifyOtp
} = require('../controllers/otp.controller');

const { protect } = require('../middleware/auth');

const router = express.Router();

// OTP routes
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);

// Auth routes
router.post('/login/otp', loginWithOtp);

// Token lifecycle routes
router.post('/logout', protect, logout);
router.post('/refresh', refreshAccessToken);

// router.post('/register', register);
// router.post('/login', login);
router.get('/me', protect, getMe);
router.delete('/delete-account', protect, deleteAccount);
router.post('/reactivate/initiate', reactivateInitiate);
router.post('/reactivate/confirm', reactivateConfirm);
// router.put('/updatepassword', protect, updatePassword);
// router.post('/forgotpassword', forgotPassword);
// router.put('/resetpassword/:resettoken', resetPassword);
// router.get('/google', googleAuth);
// router.get(
//   '/google/callback', 
//   passport.authenticate('google', {
//     session: false,
//     failureRedirect: process.env.CLIENT_URL + '/login?error=google',
//   }),
//   googleCallback
// );

module.exports = router;