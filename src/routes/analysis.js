const express = require('express');
const {
  getAnalysis,
  getAllAnalyses,
  getQuizQuestions,
  getFlashcards,
  getMindMap,
  getYoutubeVideos,
  refreshYoutubeVideos,
  searchYoutubeVideos,
  getAnalysisStatistics,
  updateAnalysisTitle,
  getPopularTopics
} = require('../controllers/analysisController');

const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All analysis routes require authentication
router.use(authenticateToken);

// IMPORTANT: Specific routes MUST come before parameterized routes

// Get all analyses for user
router.get('/', getAllAnalyses);

// Get analysis statistics
router.get('/statistics', getAnalysisStatistics);

// Get popular topics
router.get('/popular-topics', getPopularTopics);

// Search YouTube videos (specific route)
router.get('/youtube/search', searchYoutubeVideos);

// PARAMETERIZED ROUTES - These must come AFTER specific routes

// Get specific analysis
router.get('/:id', getAnalysis);

// Update analysis title
router.put('/:id/title', updateAnalysisTitle);

// Get quiz questions for an analysis
router.get('/:id/quiz', getQuizQuestions);

// Get flashcards for an analysis
router.get('/:id/flashcards', getFlashcards);

// Get mind map for an analysis
router.get('/:id/mindmap', getMindMap);

// Get YouTube videos for an analysis
router.get('/:id/videos', getYoutubeVideos);

// Refresh YouTube videos for an analysis
router.post('/:id/videos/refresh', refreshYoutubeVideos);

module.exports = router;