const express = require('express');
const {
  exportToPDF,
  downloadPDF,
  exportMultipleAnalyses,
  getExportHistory,
  deleteExport,
  exportFlashcards,
  exportQuizQuestions,
  cleanupOldExports
} = require('../controllers/exportController');

const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// CORS middleware for export routes
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

// SPECIFIC ROUTES FIRST

// Public download route (no auth required for downloading with direct link)
router.get('/download/:filename', downloadPDF);

// Get export history (specific route before parameterized ones)
router.get('/history', getExportHistory);

// Export multiple analyses to combined PDF (specific route)
router.post('/pdf/multiple', exportMultipleAnalyses);

// Admin route for cleanup (specific route)
router.post('/cleanup', cleanupOldExports);

// PROTECTED ROUTES (require authentication)
router.use(authenticateToken);

// PARAMETERIZED ROUTES - Must come after specific routes

// Export single analysis to PDF
router.post('/pdf/:id', exportToPDF);

// Export flashcards only
router.post('/flashcards/:id', exportFlashcards);

// Export quiz questions only
router.post('/quiz/:id', exportQuizQuestions);

// Delete export file
router.delete('/:filename', deleteExport);

module.exports = router;