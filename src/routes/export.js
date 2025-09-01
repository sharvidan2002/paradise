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

// SPECIFIC ROUTES FIRST

// Public download route (no auth required for downloading with direct link)
router.get('/download/:filename', downloadPDF);

// Get export history (specific route before parameterized ones)
router.get('/history', authenticateToken, getExportHistory);

// Export multiple analyses to combined PDF (specific route)
router.post('/pdf/multiple', authenticateToken, exportMultipleAnalyses);

// Admin route for cleanup (specific route)
router.post('/cleanup', cleanupOldExports);

// PROTECTED ROUTES (require authentication)
// PARAMETERIZED ROUTES - Must come after specific routes

// Export single analysis to PDF
router.post('/pdf/:id', authenticateToken, exportToPDF);

// Export flashcards only
router.post('/flashcards/:id', authenticateToken, exportFlashcards);

// Export quiz questions only
router.post('/quiz/:id', authenticateToken, exportQuizQuestions);

// Delete export file
router.delete('/:filename', authenticateToken, deleteExport);

module.exports = router;