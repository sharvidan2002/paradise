const Analysis = require('../models/Analysis');
const pdfService = require('../services/pdfService');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const fs = require('fs');
const path = require('path');

const exportToPDF = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  try {
    const pdfResult = await pdfService.generateStudyMaterialPDF(analysis.analysis, analysis.title);

    res.json({
      success: true,
      message: 'PDF generated successfully',
      downloadUrl: pdfResult.downloadUrl,
      filename: pdfResult.filename
    });

  } catch (error) {
    console.error('PDF export error:', error);
    throw new AppError('Failed to generate PDF', 500);
  }
});

const downloadPDF = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  const filepath = path.join('exports', filename);

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    throw new AppError('File not found', 404);
  }

  // Security check - ensure filename doesn't contain path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new AppError('Invalid filename', 400);
  }

  // Set appropriate headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Stream the file
  const fileStream = fs.createReadStream(filepath);
  fileStream.pipe(res);

  fileStream.on('error', (error) => {
    console.error('File stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error downloading file' });
    }
  });
});

const exportMultipleAnalyses = asyncHandler(async (req, res) => {
  const { analysisIds } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(analysisIds) || analysisIds.length === 0) {
    throw new AppError('Analysis IDs array is required', 400);
  }

  if (analysisIds.length > 10) {
    throw new AppError('Cannot export more than 10 analyses at once', 400);
  }

  // Fetch all analyses
  const analyses = await Analysis.find({
    _id: { $in: analysisIds },
    userId
  });

  if (analyses.length !== analysisIds.length) {
    throw new AppError('Some analyses not found or do not belong to user', 404);
  }

  try {
    // Combine all analyses into one comprehensive document
    const combinedAnalysis = {
      summary: analyses.map(a => `**${a.title}**\n${a.analysis.summary}`).join('\n\n'),
      explanation: analyses.map(a => `**${a.title}**\n${a.analysis.explanation}`).join('\n\n'),
      quizQuestions: analyses.flatMap(a =>
        a.analysis.quizQuestions.map(q => ({ ...q, source: a.title }))
      ),
      flashcards: analyses.flatMap(a =>
        a.analysis.flashcards.map(f => ({ ...f, source: a.title }))
      ),
      keyTopics: [...new Set(analyses.flatMap(a => a.analysis.keyTopics))],
      mindMapData: {
        central: 'Combined Study Material',
        branches: analyses.map(a => ({
          name: a.title,
          subtopics: a.analysis.keyTopics || []
        }))
      }
    };

    const title = `Combined Study Material - ${analyses.length} Analyses`;
    const pdfResult = await pdfService.generateStudyMaterialPDF(combinedAnalysis, title);

    res.json({
      success: true,
      message: 'Combined PDF generated successfully',
      downloadUrl: pdfResult.downloadUrl,
      filename: pdfResult.filename,
      analysesCount: analyses.length
    });

  } catch (error) {
    console.error('Multiple export error:', error);
    throw new AppError('Failed to generate combined PDF', 500);
  }
});

const getExportHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get recent analyses that could be exported
  const recentAnalyses = await Analysis.find({ userId })
    .select('title contentType createdAt')
    .sort({ createdAt: -1 })
    .limit(20);

  // List available export files (in a production environment, you might want to track this in the database)
  const exportsDir = 'exports/';
  let availableExports = [];

  try {
    if (fs.existsSync(exportsDir)) {
      const files = fs.readdirSync(exportsDir);
      availableExports = files
        .filter(file => file.endsWith('.pdf'))
        .map(file => {
          const stats = fs.statSync(path.join(exportsDir, file));
          return {
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime,
            downloadUrl: `/api/export/download/${file}`
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10); // Limit to 10 most recent
    }
  } catch (error) {
    console.error('Error reading exports directory:', error);
  }

  res.json({
    success: true,
    recentAnalyses,
    availableExports
  });
});

const deleteExport = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Security check
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new AppError('Invalid filename', 400);
  }

  const filepath = path.join('exports', filename);

  if (!fs.existsSync(filepath)) {
    throw new AppError('Export file not found', 404);
  }

  try {
    fs.unlinkSync(filepath);
    res.json({
      success: true,
      message: 'Export file deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting export file:', error);
    throw new AppError('Failed to delete export file', 500);
  }
});

const exportFlashcards = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  if (!analysis.analysis.flashcards || analysis.analysis.flashcards.length === 0) {
    throw new AppError('No flashcards found for this analysis', 404);
  }

  try {
    // Create a flashcard-only export
    const flashcardAnalysis = {
      summary: `Flashcards for: ${analysis.title}`,
      explanation: '',
      quizQuestions: [],
      flashcards: analysis.analysis.flashcards,
      keyTopics: analysis.analysis.keyTopics,
      mindMapData: analysis.analysis.mindMapData
    };

    const title = `${analysis.title} - Flashcards`;
    const pdfResult = await pdfService.generateStudyMaterialPDF(flashcardAnalysis, title);

    res.json({
      success: true,
      message: 'Flashcards PDF generated successfully',
      downloadUrl: pdfResult.downloadUrl,
      filename: pdfResult.filename
    });

  } catch (error) {
    console.error('Flashcard export error:', error);
    throw new AppError('Failed to generate flashcards PDF', 500);
  }
});

const exportQuizQuestions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const analysis = await Analysis.findOne({ _id: id, userId });

  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  if (!analysis.analysis.quizQuestions || analysis.analysis.quizQuestions.length === 0) {
    throw new AppError('No quiz questions found for this analysis', 404);
  }

  try {
    // Create a quiz-only export
    const quizAnalysis = {
      summary: `Quiz Questions for: ${analysis.title}`,
      explanation: '',
      quizQuestions: analysis.analysis.quizQuestions,
      flashcards: [],
      keyTopics: analysis.analysis.keyTopics,
      mindMapData: analysis.analysis.mindMapData
    };

    const title = `${analysis.title} - Quiz Questions`;
    const pdfResult = await pdfService.generateStudyMaterialPDF(quizAnalysis, title);

    res.json({
      success: true,
      message: 'Quiz questions PDF generated successfully',
      downloadUrl: pdfResult.downloadUrl,
      filename: pdfResult.filename
    });

  } catch (error) {
    console.error('Quiz export error:', error);
    throw new AppError('Failed to generate quiz PDF', 500);
  }
});

// Cleanup old exports (this could be called by a cron job)
const cleanupOldExports = asyncHandler(async (req, res) => {
  try {
    pdfService.cleanupOldFiles();
    res.json({
      success: true,
      message: 'Cleanup completed successfully'
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    throw new AppError('Failed to cleanup old exports', 500);
  }
});

module.exports = {
  exportToPDF,
  downloadPDF,
  exportMultipleAnalyses,
  getExportHistory,
  deleteExport,
  exportFlashcards,
  exportQuizQuestions,
  cleanupOldExports
};