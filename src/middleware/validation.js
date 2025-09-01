const { body, validationResult } = require('express-validator');

const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateUpload = [
  body('prompt')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Prompt must be between 5 and 500 characters'),
  body('contentType')
    .isIn(['handwritten', 'textbook', 'diagram'])
    .withMessage('Content type must be handwritten, textbook, or diagram'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters')
];

const validateChat = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  body('analysisId')
    .isMongoId()
    .withMessage('Invalid analysis ID')
];

const handleValidationErrors = (req, res, next) => {
  console.log('Validation middleware called'); // Debug log
  console.log('Request body:', req.body); // Debug log

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array()); // Debug log

    // Ensure CORS headers are set for validation errors
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', 'true');

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg
      }))
    });
  }

  console.log('Validation passed, continuing...'); // Debug log
  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateUpload,
  validateChat,
  handleValidationErrors
};