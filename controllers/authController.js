import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import User from '../models/User.js';
import Product from '../models/Product.js';
import OTPVerification from '../models/OTPVerification.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import sendEmail, { generateOTPEmailHTML, generateWelcomeEmailHTML } from '../utils/sendEmail.js';
import { generateOTP, hashOTP, verifyOTP } from '../utils/otpUtils.js';
import { getGoogleAuthURL, getGoogleTokens, getGoogleUser } from '../utils/googleOAuth.js';

// Cookie options helper
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production' || 
                 (process.env.GOOGLE_CALLBACK_URL && process.env.GOOGLE_CALLBACK_URL.startsWith('https://')) ||
                 (process.env.CLIENT_URL && process.env.CLIENT_URL.startsWith('https://'));
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
};

// @desc    Send OTP for user registration
// @route   POST /api/auth/send-register-otp
// @access  Public
export const sendRegisterOTP = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please provide name, email and password');
  }

  // Check if User already exists with this email
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  // Rate limit check: if OTP sent in last 1 minute
  const existingOTP = await OTPVerification.findOne({ email });
  if (existingOTP) {
    const timeSinceSent = 10 * 60 * 1000 - (existingOTP.expiresAt - Date.now());
    if (timeSinceSent < 60 * 1000) {
      res.status(429);
      throw new Error('Please wait before requesting another OTP');
    }
  }

  // Delete any existing OTPVerification documents for this email
  await OTPVerification.deleteMany({ email });

  // Generate and process OTP
  const otp = generateOTP();
  console.log(`[TESTING] REGISTRATION OTP FOR ${email}: ${otp}`);
  fs.writeFileSync('d:\\Girly\\backend\\otp-log.txt', otp);
  const hashedOTP = await hashOTP(otp);

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create OTPVerification document
  await OTPVerification.create({
    name,
    email,
    hashedPassword,
    otp: hashedOTP,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // Send OTP Email
  try {
    await sendEmail({
      to: email,
      subject: 'Verify your Girly Store account',
      html: generateOTPEmailHTML(otp, 'register'),
    });

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email address',
    });
  } catch (error) {
    await OTPVerification.deleteMany({ email });
    res.status(500);
    throw new Error(`Email sending failed: ${error.message}`);
  }
});

// @desc    Verify OTP and complete user registration
// @route   POST /api/auth/verify-register-otp
// @access  Public
export const verifyRegisterOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error('Please provide email and OTP');
  }

  // Find OTPVerification document
  const document = await OTPVerification.findOne({ email });
  if (!document) {
    res.status(400);
    throw new Error('OTP expired or not found. Please request a new OTP');
  }

  // Check expiry
  if (document.expiresAt < Date.now()) {
    await OTPVerification.deleteMany({ email });
    res.status(400);
    throw new Error('OTP has expired. Please request a new OTP');
  }

  // Verify OTP
  const isMatch = await verifyOTP(otp, document.otp);
  if (!isMatch) {
    res.status(400);
    throw new Error('Invalid OTP. Please try again');
  }

  // Create user bypassing pre-save hook for password (which is already hashed)
  const user = await User.create({
    name: document.name,
    email: document.email,
    password: document.name, // temporary password
  });

  await User.findByIdAndUpdate(user._id, { password: document.hashedPassword });
  const savedUser = await User.findById(user._id);

  // Delete the OTPVerification document
  await OTPVerification.deleteOne({ _id: document._id });

  // Send Welcome Email asynchronously
  try {
    const products = await Product.find({ isActive: true }).limit(4);
    const welcomeHtml = generateWelcomeEmailHTML(savedUser.name, products);
    sendEmail({
      to: savedUser.email,
      subject: 'Welcome to Girly Store! 💗',
      html: welcomeHtml,
    }).catch((err) => console.error('Error sending welcome email:', err));
  } catch (emailErr) {
    console.error('Failed to prepare welcome email:', emailErr);
  }

  // Generate tokens
  const accessToken = generateAccessToken(savedUser._id);
  const refreshToken = generateRefreshToken(savedUser._id);

  savedUser.refreshToken = refreshToken;
  await savedUser.save();

  res.cookie('refreshToken', refreshToken, getCookieOptions());

  res.status(201).json({
    success: true,
    accessToken,
    user: {
      _id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
    },
  });
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (user.isBanned) {
    res.status(403);
    throw new Error('Your account has been banned. Access denied.');
  }

  try {
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    res.status(400);
    throw new Error(error.message || 'Invalid email or password');
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie('refreshToken', refreshToken, getCookieOptions());

  res.json({
    success: true,
    accessToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    },
  });
});

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    const user = await User.findOne({ refreshToken });
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }
  }

  const cookieOptions = getCookieOptions();
  delete cookieOptions.maxAge;
  res.clearCookie('refreshToken', cookieOptions);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    res.status(401);
    throw new Error('Refresh token not found');
  }

  const user = await User.findOne({ refreshToken });

  if (!user) {
    res.status(401);
    throw new Error('Invalid refresh token');
  }

  if (user.isBanned) {
    res.status(403);
    throw new Error('User is banned');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (decoded.id !== user._id.toString()) {
      res.status(401);
      throw new Error('Invalid token mapping');
    }

    const accessToken = generateAccessToken(user._id);
    res.json({
      success: true,
      accessToken,
    });
  } catch (error) {
    res.status(401);
    throw new Error('Refresh token verification failed');
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({
    success: true,
    user: req.user,
  });
});

// @desc    Forgot Password OTP request
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Please provide an email address');
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error('No account found with this email');
  }

  // Rate limit check: if OTP sent in last 1 minute
  if (user.resetOTPExpiry) {
    const timeSinceSent = 10 * 60 * 1000 - (user.resetOTPExpiry - Date.now());
    if (timeSinceSent < 60 * 1000) {
      res.status(429);
      throw new Error('Please wait before requesting another OTP');
    }
  }

  // Generate and process OTP
  const otp = generateOTP();
  console.log(`[TESTING] RESET OTP FOR ${email}: ${otp}`);
  fs.writeFileSync('d:\\Girly\\backend\\otp-log.txt', otp);
  const hashedOTP = await hashOTP(otp);

  user.resetOTP = hashedOTP;
  user.resetOTPExpiry = Date.now() + 10 * 60 * 1000;
  await user.save();

  try {
    await sendEmail({
      to: email,
      subject: 'Reset your Girly Store password',
      html: generateOTPEmailHTML(otp, 'reset'),
    });

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email address',
    });
  } catch (error) {
    user.resetOTP = undefined;
    user.resetOTPExpiry = undefined;
    await user.save();

    res.status(500);
    throw new Error(`Email sending failed: ${error.message}`);
  }
});

// @desc    Verify Reset OTP and generate resetToken
// @route   POST /api/auth/verify-reset-otp
// @access  Public
export const verifyResetOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error('Please provide email and OTP');
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error('No account found with this email');
  }

  if (!user.resetOTP) {
    res.status(400);
    throw new Error('No OTP requested. Please request password reset first');
  }

  if (user.resetOTPExpiry < Date.now()) {
    res.status(400);
    throw new Error('OTP has expired. Please request a new one');
  }

  const isMatch = await verifyOTP(otp, user.resetOTP);
  if (!isMatch) {
    res.status(400);
    throw new Error('Invalid OTP. Please try again');
  }

  // Generate short-lived reset token
  const resetToken = jwt.sign(
    { id: user._id, purpose: 'password-reset' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  // Clear OTP fields
  user.resetOTP = undefined;
  user.resetOTPExpiry = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'OTP verified',
    resetToken,
  });
});

// @desc    Reset password using resetToken
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    res.status(400);
    throw new Error('Please provide resetToken and newPassword');
  }

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_ACCESS_SECRET);
    
    if (decoded.purpose !== 'password-reset') {
      res.status(400);
      throw new Error('Invalid reset token');
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (newPassword.length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters');
    }

    user.password = newPassword; // Pre-save hook will hash this
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please login with your new password',
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message || 'Invalid or expired reset token');
  }
});

// @desc    Redirect to Google OAuth consent screen
// @route   GET /api/auth/google
// @access  Public
export const googleAuth = asyncHandler(async (req, res) => {
  const url = getGoogleAuthURL();
  res.redirect(url);
});

// @desc    Handle Google OAuth callback redirect
// @route   GET /api/auth/google/callback
// @access  Public
export const googleCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=Google authentication failed`);
  }

  try {
    // Exchange code for tokens
    const { access_token, id_token } = await getGoogleTokens(code);

    // Get user info from Google
    const googleUser = await getGoogleUser(access_token, id_token);

    if (!googleUser.verified_email) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=Please verify your Google email first`);
    }

    // Check if user exists by googleId or email
    let user = await User.findOne({
      $or: [{ googleId: googleUser.id }, { email: googleUser.email }]
    });

    let isNewUser = false;
    if (user) {
      // Update googleId and avatar if logging in with Google for first time
      if (!user.googleId) {
        user.googleId = googleUser.id;
        user.avatar = googleUser.picture;
        user.authProvider = 'google';
        await user.save();
      }
    } else {
      // Create new user from Google profile
      user = await User.create({
        name: googleUser.name,
        email: googleUser.email,
        googleId: googleUser.id,
        avatar: googleUser.picture,
        authProvider: 'google',
        password: null,
        role: 'user',
      });
      isNewUser = true;

      try {
        const products = await Product.find({ isActive: true }).limit(4);
        const welcomeHtml = generateWelcomeEmailHTML(user.name, products);
        sendEmail({
          to: user.email,
          subject: 'Welcome to Girly Store! 💗',
          html: welcomeHtml,
        }).catch((err) => console.error('Error sending google welcome email:', err));
      } catch (emailErr) {
        console.error('Failed to prepare google welcome email:', emailErr);
      }
    }

    if (user.isBanned) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=Your account has been banned`);
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    // Redirect to frontend with access token
    res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${accessToken}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&role=${user.role}&id=${user._id}&avatar=${encodeURIComponent(user.avatar || '')}&isNew=${isNewUser}`);

  } catch (error) {
    console.error('Google OAuth error:', error.message);
    res.redirect(`${process.env.CLIENT_URL}/login?error=Google authentication failed. Please try again`);
  }
});
