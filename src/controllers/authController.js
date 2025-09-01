const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { asyncHandler, AppError } = require('../utils/errorHandler');

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      return done(null, user);
    }

    // Check if user exists with same email
    user = await User.findOne({ email: profile.emails[0].value });

    if (user) {
      // Link Google account to existing user
      user.googleId = profile.id;
      user.avatar = profile.photos[0].value;
      user.isVerified = true;
      await user.save();
      return done(null, user);
    }

    // Create new user
    user = new User({
      googleId: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value,
      avatar: profile.photos[0].value,
      isVerified: true
    });

    await user.save();
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User already exists with this email', 400);
  }

  // Create new user
  const user = new User({
    name,
    email,
    password,
    isVerified: false
  });

  await user.save();

  // Generate token
  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = await User.findOne({ email });
  if (!user || !await user.comparePassword(password)) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate token
  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified
    }
  });
});

const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email']
});

const googleCallback = asyncHandler(async (req, res) => {
  // Generate token for the authenticated user
  const token = generateToken(req.user._id);

  // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('analyses', 'title createdAt contentType')
    .select('-password');

  res.json({
    success: true,
    user
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const userId = req.user._id;

  // Check if email is already taken by another user
  if (email && email !== req.user.email) {
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      ...(name && { name }),
      ...(email && { email })
    },
    { new: true, runValidators: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  const user = await User.findById(userId);

  // Check if user has a password (Google users might not have one)
  if (!user.password) {
    throw new AppError('Cannot change password for Google authenticated users', 400);
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Delete user's analyses and related data
  const Analysis = require('../models/Analysis');
  const Chat = require('../models/Chat');

  await Analysis.deleteMany({ userId });
  await Chat.deleteMany({ userId });
  await User.findByIdAndDelete(userId);

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
});

const logout = asyncHandler(async (req, res) => {
  // For JWT-based auth, logout is handled client-side by removing the token
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = {
  register,
  login,
  googleAuth,
  googleCallback,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  logout
};