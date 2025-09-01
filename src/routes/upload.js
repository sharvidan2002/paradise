const express = require('express');
const {
  uploadAndAnalyze,
  getUserUploads,
  getUploadDetails,
  deleteUpload,
  retryAnalysis,
  getUploadStatistics
} = require('../controllers/uploadController');

const { authenticateToken } = require('../middleware/auth');
const { upload, handleMulterError } = require('../middleware/upload');
const {
  validateUpload,
  handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// CORS middleware for upload routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// All upload routes require authentication
router.use(authenticateToken);

// SPECIFIC ROUTES FIRST

// Upload and analyze image
router.post(
  '/analyze',
  upload.single('image'),
  handleMulterError,
  validateUpload,
  handleValidationErrors,
  uploadAndAnalyze
);

// Get user's uploads
router.get('/my-uploads', getUserUploads);

// Get upload statistics
router.get('/statistics', getUploadStatistics);

// PARAMETERIZED ROUTES - Must come after specific routes

// Get specific upload details
router.get('/:id', getUploadDetails);

// Delete an upload
router.delete('/:id', deleteUpload);

// Retry analysis with new prompt
router.post('/:id/retry', retryAnalysis);

module.exports = router;