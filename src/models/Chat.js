const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  analysisId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Analysis',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['text', 'mindmap'],
      default: 'text'
    },
    mindMapData: {
      central: String,
      branches: [{
        name: String,
        subtopics: [String]
      }]
    }
  }]
}, {
  timestamps: true
});

// Index for efficient querying
ChatSchema.index({ analysisId: 1, userId: 1 });

module.exports = mongoose.model('Chat', ChatSchema);