const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  userPrompt: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['handwritten', 'textbook', 'diagram'],
    required: true
  },
  extractedText: {
    type: String,
    required: true
  },
  analysis: {
    summary: String,
    explanation: String,
    quizQuestions: [{
      type: {
        type: String,
        enum: ['mcq', 'short_answer', 'true_false']
      },
      question: String,
      options: [String],
      correct: mongoose.Schema.Types.Mixed,
      answer: String
    }],
    flashcards: [{
      front: String,
      back: String
    }],
    keyTopics: [String],
    mindMapData: {
      central: String,
      branches: [{
        name: String,
        subtopics: [String]
      }]
    }
  },
  youtubeVideos: [{
    title: String,
    videoId: String,
    thumbnail: String,
    views: Number,
    duration: String
  }],
  chats: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'
  }]
}, {
  timestamps: true
});

// Index for efficient querying
AnalysisSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Analysis', AnalysisSchema);