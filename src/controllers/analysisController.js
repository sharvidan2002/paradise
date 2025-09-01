const Analysis = require('../models/Analysis');
const youtubeService = require('../services/youtubeService');
const { asyncHandler, AppError } = require('../utils/errorHandler');

const getAnalysis = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  res.json({
    success: true,
    analysis
  });
});

const getAllAnalyses = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, contentType, search } = req.query;

  const query = { userId };

  // Filter by content type
  if (contentType && ['handwritten', 'textbook', 'diagram'].includes(contentType)) {
    query.contentType = contentType;
  }

  // Search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { 'analysis.summary': { $regex: search, $options: 'i' } },
      { 'analysis.keyTopics': { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const analyses = await Analysis.find(query)
    .select('title imageUrl contentType analysis.summary analysis.keyTopics createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Analysis.countDocuments(query);

  res.json({
    success: true,
    analyses,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

const getQuizQuestions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  res.json({
    success: true,
    quizQuestions: analysis.analysis.quizQuestions || [],
    title: analysis.title
  });
});

const getFlashcards = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  res.json({
    success: true,
    flashcards: analysis.analysis.flashcards || [],
    title: analysis.title
  });
});

const getMindMap = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  res.json({
    success: true,
    mindMapData: analysis.analysis.mindMapData || { central: 'Main Topic', branches: [] },
    title: analysis.title
  });
});

const getYoutubeVideos = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  res.json({
    success: true,
    videos: analysis.youtubeVideos || [],
    keyTopics: analysis.analysis.keyTopics || [],
    title: analysis.title
  });
});

const refreshYoutubeVideos = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  try {
    let youtubeVideos = [];

    if (analysis.analysis.keyTopics && analysis.analysis.keyTopics.length > 0) {
      youtubeVideos = await youtubeService.getRelatedVideos(analysis.analysis.keyTopics);
    }

    // Update the analysis with new videos
    analysis.youtubeVideos = youtubeVideos;
    await analysis.save();

    res.json({
      success: true,
      message: 'YouTube videos refreshed successfully',
      videos: youtubeVideos
    });

  } catch (error) {
    throw new AppError('Failed to refresh YouTube videos', 500);
  }
});

const searchYoutubeVideos = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 3) {
    throw new AppError('Search query must be at least 3 characters long', 400);
  }

  try {
    const videos = await youtubeService.searchEducationalVideos(query);

    res.json({
      success: true,
      videos,
      query
    });

  } catch (error) {
    throw new AppError('Failed to search YouTube videos', 500);
  }
});

const getAnalysisStatistics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Analysis.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalAnalyses: { $sum: 1 },
        totalQuizQuestions: { $sum: { $size: '$analysis.quizQuestions' } },
        totalFlashcards: { $sum: { $size: '$analysis.flashcards' } },
        contentTypeBreakdown: {
          $push: '$contentType'
        }
      }
    },
    {
      $project: {
        totalAnalyses: 1,
        totalQuizQuestions: 1,
        totalFlashcards: 1,
        handwrittenCount: {
          $size: {
            $filter: {
              input: '$contentTypeBreakdown',
              cond: { $eq: ['$$this', 'handwritten'] }
            }
          }
        },
        textbookCount: {
          $size: {
            $filter: {
              input: '$contentTypeBreakdown',
              cond: { $eq: ['$$this', 'textbook'] }
            }
          }
        },
        diagramCount: {
          $size: {
            $filter: {
              input: '$contentTypeBreakdown',
              cond: { $eq: ['$$this', 'diagram'] }
            }
          }
        }
      }
    }
  ]);

  const recentAnalyses = await Analysis.find({ userId })
    .select('title contentType createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    statistics: stats[0] || {
      totalAnalyses: 0,
      totalQuizQuestions: 0,
      totalFlashcards: 0,
      handwrittenCount: 0,
      textbookCount: 0,
      diagramCount: 0
    },
    recentAnalyses
  });
});

const updateAnalysisTitle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const userId = req.user._id;

  if (!title || title.trim().length < 3) {
    throw new AppError('Title must be at least 3 characters long', 400);
  }

  const analysis = await Analysis.findOneAndUpdate(
    { _id: id, userId },
    { title: title.trim() },
    { new: true }
  );

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  res.json({
    success: true,
    message: 'Analysis title updated successfully',
    analysis: {
      id: analysis._id,
      title: analysis.title
    }
  });
});

const getPopularTopics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const topicStats = await Analysis.aggregate([
    { $match: { userId } },
    { $unwind: '$analysis.keyTopics' },
    {
      $group: {
        _id: '$analysis.keyTopics',
        count: { $sum: 1 },
        lastUsed: { $max: '$updatedAt' }
      }
    },
    { $sort: { count: -1, lastUsed: -1 } },
    { $limit: 20 }
  ]);

  res.json({
    success: true,
    topics: topicStats.map(topic => ({
      name: topic._id,
      count: topic.count,
      lastUsed: topic.lastUsed
    }))
  });
});

module.exports = {
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
};