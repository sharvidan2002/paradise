const Analysis = require('../models/Analysis');
const User = require('../models/User');
const visionService = require('../services/visionService');
const geminiService = require('../services/geminiService');
const youtubeService = require('../services/youtubeService');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { deleteFile, validateImageFile } = require('../utils/helpers');

const uploadAndAnalyze = asyncHandler(async (req, res) => {
  try {
    const { prompt, contentType, title } = req.body;
    const userId = req.user._id;

    if (!req.file) {
      throw new AppError('No image file uploaded', 400);
    }

    // Validate the uploaded file
    validateImageFile(req.file);

    const imagePath = req.file.path;
    const imageUrl = `/uploads/${req.file.filename}`;

    let extractedText = '';
    let analysisResult = {};

    try {
      // Process based on content type
      if (contentType === 'diagram') {
        // For diagrams, use both Vision API and Gemini
        const visionAnalysis = await visionService.analyzeImageContent(imagePath);
        extractedText = visionAnalysis.extractedText;

        // Use Gemini to analyze the diagram with the image
        analysisResult = await geminiService.processImageWithGemini(imagePath, prompt, contentType);

        // If Gemini didn't extract text, use Vision API text
        if (!analysisResult.extractedText && extractedText) {
          analysisResult.extractedText = extractedText;
        }
      } else {
        // For handwritten and textbook content
        // First extract text with Vision API
        const textExtraction = await visionService.extractTextFromImage(imagePath);
        extractedText = textExtraction.text;

        if (!extractedText || extractedText.length < 10) {
          throw new AppError('Unable to extract text from image. Please ensure the image is clear and contains readable text.', 400);
        }

        // Then analyze with Gemini
        analysisResult = await geminiService.analyzeExtractedText(extractedText, prompt, contentType);
      }

      // Get YouTube video suggestions
      let youtubeVideos = [];
      if (analysisResult.keyTopics && analysisResult.keyTopics.length > 0) {
        try {
          youtubeVideos = await youtubeService.getRelatedVideos(analysisResult.keyTopics);
        } catch (videoError) {
          console.error('YouTube service error:', videoError);
          // Continue without videos if YouTube service fails
        }
      }

      // Create analysis record
      const analysis = new Analysis({
        userId,
        title,
        imageUrl,
        userPrompt: prompt,
        contentType,
        extractedText: analysisResult.extractedText || extractedText,
        analysis: {
          summary: analysisResult.summary || '',
          explanation: analysisResult.explanation || '',
          quizQuestions: analysisResult.quizQuestions || [],
          flashcards: analysisResult.flashcards || [],
          keyTopics: analysisResult.keyTopics || [],
          mindMapData: analysisResult.mindMapData || { central: 'Main Topic', branches: [] }
        },
        youtubeVideos
      });

      await analysis.save();

      // Update user's analyses
      await User.findByIdAndUpdate(userId, {
        $push: { analyses: analysis._id }
      });

      res.status(201).json({
        success: true,
        message: 'Image analyzed successfully',
        analysis: {
          id: analysis._id,
          title: analysis.title,
          imageUrl: analysis.imageUrl,
          contentType: analysis.contentType,
          extractedText: analysis.extractedText,
          analysis: analysis.analysis,
          youtubeVideos: analysis.youtubeVideos,
          createdAt: analysis.createdAt
        }
      });

    } catch (processingError) {
      // Clean up uploaded file on processing error
      deleteFile(imagePath);
      throw processingError;
    }

  } catch (error) {
    // Clean up uploaded file on any error
    if (req.file && req.file.path) {
      deleteFile(req.file.path);
    }
    throw error;
  }
});

const getUserUploads = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const contentType = req.query.contentType;

  const query = { userId };
  if (contentType && ['handwritten', 'textbook', 'diagram'].includes(contentType)) {
    query.contentType = contentType;
  }

  const skip = (page - 1) * limit;

  const analyses = await Analysis.find(query)
    .select('title imageUrl contentType createdAt analysis.summary')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Analysis.countDocuments(query);

  res.json({
    success: true,
    analyses,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: limit
    }
  });
});

const getUploadDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId })
    .populate('chats');

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  res.json({
    success: true,
    analysis
  });
});

const deleteUpload = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  // Delete associated chats
  const Chat = require('../models/Chat');
  await Chat.deleteMany({ analysisId: id });

  // Delete image file
  if (analysis.imageUrl) {
    const imagePath = analysis.imageUrl.replace('/uploads/', 'uploads/');
    deleteFile(imagePath);
  }

  // Remove from user's analyses
  await User.findByIdAndUpdate(userId, {
    $pull: { analyses: id }
  });

  // Delete analysis
  await Analysis.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Analysis deleted successfully'
  });
});

const retryAnalysis = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { prompt } = req.body;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  try {
    const imagePath = analysis.imageUrl.replace('/uploads/', 'uploads/');
    let analysisResult = {};

    if (analysis.contentType === 'diagram') {
      analysisResult = await geminiService.processImageWithGemini(imagePath, prompt, analysis.contentType);
    } else {
      analysisResult = await geminiService.analyzeExtractedText(analysis.extractedText, prompt, analysis.contentType);
    }

    // Get new YouTube videos
    let youtubeVideos = [];
    if (analysisResult.keyTopics && analysisResult.keyTopics.length > 0) {
      try {
        youtubeVideos = await youtubeService.getRelatedVideos(analysisResult.keyTopics);
      } catch (videoError) {
        console.error('YouTube service error:', videoError);
      }
    }

    // Update analysis
    analysis.userPrompt = prompt;
    analysis.analysis = {
      summary: analysisResult.summary || '',
      explanation: analysisResult.explanation || '',
      quizQuestions: analysisResult.quizQuestions || [],
      flashcards: analysisResult.flashcards || [],
      keyTopics: analysisResult.keyTopics || [],
      mindMapData: analysisResult.mindMapData || { central: 'Main Topic', branches: [] }
    };
    analysis.youtubeVideos = youtubeVideos;

    await analysis.save();

    res.json({
      success: true,
      message: 'Analysis updated successfully',
      analysis
    });

  } catch (error) {
    throw new AppError('Failed to retry analysis', 500);
  }
});

const getUploadStatistics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Analysis.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: null,
        totalAnalyses: { $sum: 1 },
        handwrittenCount: {
          $sum: { $cond: [{ $eq: ["$contentType", "handwritten"] }, 1, 0] }
        },
        textbookCount: {
          $sum: { $cond: [{ $eq: ["$contentType", "textbook"] }, 1, 0] }
        },
        diagramCount: {
          $sum: { $cond: [{ $eq: ["$contentType", "diagram"] }, 1, 0] }
        },
        totalQuizQuestions: {
          $sum: { $size: "$analysis.quizQuestions" }
        },
        totalFlashcards: {
          $sum: { $size: "$analysis.flashcards" }
        }
      }
    }
  ]);

  const statistics = stats.length > 0 ? stats[0] : {
    totalAnalyses: 0,
    handwrittenCount: 0,
    textbookCount: 0,
    diagramCount: 0,
    totalQuizQuestions: 0,
    totalFlashcards: 0
  };

  res.json({
    success: true,
    statistics
  });
});

module.exports = {
  uploadAndAnalyze,
  getUserUploads,
  getUploadDetails,
  deleteUpload,
  retryAnalysis,
  getUploadStatistics
};