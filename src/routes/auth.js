const express = require('express');
const {
  register,
  login,
  googleAuth,
  googleCallback,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  logout
} = require('../controllers/authController');

const { authenticateToken } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', validateRegistration, handleValidationErrors, register);
router.post('/login', validateLogin, handleValidationErrors, login);

// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleAuth, googleCallback);

// Protected routes - apply authentication middleware
router.use(authenticateToken);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.delete('/account', deleteAccount);
router.post('/logout', logout);

module.exports = router;