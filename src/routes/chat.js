const express = require('express');
const {
  sendMessage,
  getChatHistory,
  clearChatHistory,
  deleteChat,
  getChatStatistics,
  generateMindMap,
  getMessagesByType,
  updateMessage,
  deleteMessage
} = require('../controllers/chatController');

const { authenticateToken } = require('../middleware/auth');
const {
  validateChat,
  handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// CORS middleware for chat routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// All chat routes require authentication
router.use(authenticateToken);

// SPECIFIC ROUTES FIRST

// Get chat statistics
router.get('/statistics', getChatStatistics);

// Send a message
router.post('/message', validateChat, handleValidationErrors, sendMessage);

// PARAMETERIZED ROUTES - Must come after specific routes

// Get chat history for an analysis
router.get('/history/:analysisId', getChatHistory);

// Get messages by type (text or mindmap)
router.get('/history/:analysisId/messages', getMessagesByType);

// Generate mind map for an analysis
router.post('/mindmap/:analysisId', generateMindMap);

// Clear chat history for an analysis
router.delete('/history/:analysisId', clearChatHistory);

// Update a specific message
router.put('/:chatId/message/:messageId', updateMessage);

// Delete a specific message
router.delete('/:chatId/message/:messageId', deleteMessage);

// Delete entire chat for an analysis
router.delete('/:analysisId', deleteChat);

module.exports = router;