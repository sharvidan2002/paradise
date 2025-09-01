const Chat = require('../models/Chat');
const Analysis = require('../models/Analysis');
const geminiService = require('../services/geminiService');
const { asyncHandler, AppError } = require('../utils/errorHandler');

const sendMessage = asyncHandler(async (req, res) => {
  const { message, analysisId } = req.body;
  const userId = req.user._id;

  // Verify analysis exists and belongs to user
  const analysis = await Analysis.findOne({ _id: analysisId, userId });
  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  // Find or create chat for this analysis
  let chat = await Chat.findOne({ analysisId, userId });
  if (!chat) {
    chat = new Chat({
      analysisId,
      userId,
      messages: []
    });
  }

  // Add user message
  chat.messages.push({
    role: 'user',
    content: message,
    type: 'text'
  });

  try {
    // Generate AI response
    const aiResponse = await geminiService.generateChatResponse(
      message,
      analysis.analysis,
      analysis.extractedText
    );

    // Add AI response to chat
    const aiMessage = {
      role: 'assistant',
      content: aiResponse.content,
      type: aiResponse.type || 'text'
    };

    // If it's a mind map response, add the mind map data
    if (aiResponse.type === 'mindmap' && aiResponse.mindMapData) {
      aiMessage.mindMapData = aiResponse.mindMapData;
    }

    chat.messages.push(aiMessage);

    // Save chat
    await chat.save();

    // Update analysis with chat reference if not already present
    if (!analysis.chats.includes(chat._id)) {
      analysis.chats.push(chat._id);
      await analysis.save();
    }

    res.json({
      success: true,
      message: 'Message sent successfully',
      response: aiMessage,
      chatId: chat._id
    });

  } catch (error) {
    console.error('Chat response generation error:', error);

    // Add error message to chat
    chat.messages.push({
      role: 'assistant',
      content: 'I apologize, but I encountered an error while processing your question. Please try again.',
      type: 'text'
    });

    await chat.save();

    throw new AppError('Failed to generate response', 500);
  }
});

const getChatHistory = asyncHandler(async (req, res) => {
  const { analysisId } = req.params;
  const userId = req.user._id;

  // Verify analysis exists and belongs to user
  const analysis = await Analysis.findOne({ _id: analysisId, userId });
  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  const chat = await Chat.findOne({ analysisId, userId });

  res.json({
    success: true,
    messages: chat ? chat.messages : [],
    chatId: chat ? chat._id : null,
    analysisTitle: analysis.title
  });
});

const clearChatHistory = asyncHandler(async (req, res) => {
  const { analysisId } = req.params;
  const userId = req.user._id;

  // Verify analysis exists and belongs to user
  const analysis = await Analysis.findOne({ _id: analysisId, userId });
  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  const chat = await Chat.findOne({ analysisId, userId });
  if (chat) {
    chat.messages = [];
    await chat.save();
  }

  res.json({
    success: true,
    message: 'Chat history cleared successfully'
  });
});

const deleteChat = asyncHandler(async (req, res) => {
  const { analysisId } = req.params;
  const userId = req.user._id;

  // Verify analysis exists and belongs to user
  const analysis = await Analysis.findOne({ _id: analysisId, userId });
  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  // Delete chat
  const deletedChat = await Chat.findOneAndDelete({ analysisId, userId });

  if (deletedChat) {
    // Remove chat reference from analysis
    analysis.chats = analysis.chats.filter(chatId => !chatId.equals(deletedChat._id));
    await analysis.save();
  }

  res.json({
    success: true,
    message: 'Chat deleted successfully'
  });
});

const getChatStatistics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Chat.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalChats: { $sum: 1 },
        totalMessages: { $sum: { $size: '$messages' } },
        avgMessagesPerChat: { $avg: { $size: '$messages' } }
      }
    }
  ]);

  const recentChats = await Chat.find({ userId })
    .populate('analysisId', 'title contentType')
    .select('analysisId messages updatedAt')
    .sort({ updatedAt: -1 })
    .limit(5);

  const formattedRecentChats = recentChats.map(chat => ({
    analysisId: chat.analysisId._id,
    analysisTitle: chat.analysisId.title,
    contentType: chat.analysisId.contentType,
    messageCount: chat.messages.length,
    lastMessage: chat.messages[chat.messages.length - 1]?.content?.substring(0, 100) + '...',
    updatedAt: chat.updatedAt
  }));

  res.json({
    success: true,
    statistics: stats[0] || {
      totalChats: 0,
      totalMessages: 0,
      avgMessagesPerChat: 0
    },
    recentChats: formattedRecentChats
  });
});

const generateMindMap = asyncHandler(async (req, res) => {
  const { analysisId } = req.params;
  const { customPrompt } = req.body;
  const userId = req.user._id;

  // Verify analysis exists and belongs to user
  const analysis = await Analysis.findOne({ _id: analysisId, userId });
  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  try {
    const mindMapPrompt = customPrompt ||
      `Create a detailed mind map for the following content: ${analysis.extractedText}`;

    const response = await geminiService.generateChatResponse(
      mindMapPrompt,
      analysis.analysis,
      analysis.extractedText
    );

    let mindMapData;

    if (response.type === 'mindmap') {
      mindMapData = response.mindMapData;
    } else {
      // Fallback to existing mind map data
      mindMapData = analysis.analysis.mindMapData || { central: 'Main Topic', branches: [] };
    }

    res.json({
      success: true,
      mindMapData,
      title: analysis.title
    });

  } catch (error) {
    console.error('Mind map generation error:', error);

    // Return existing mind map data as fallback
    res.json({
      success: true,
      mindMapData: analysis.analysis.mindMapData || { central: 'Main Topic', branches: [] },
      title: analysis.title
    });
  }
});

const getMessagesByType = asyncHandler(async (req, res) => {
  const { analysisId } = req.params;
  const { type } = req.query; // 'text' or 'mindmap'
  const userId = req.user._id;

  // Verify analysis exists and belongs to user
  const analysis = await Analysis.findOne({ _id: analysisId, userId });
  if (!analysis) {
    throw new AppError('Analysis not found', 404);
  }

  const chat = await Chat.findOne({ analysisId, userId });

  if (!chat) {
    return res.json({
      success: true,
      messages: []
    });
  }

  const filteredMessages = type
    ? chat.messages.filter(msg => msg.type === type)
    : chat.messages;

  res.json({
    success: true,
    messages: filteredMessages,
    totalMessages: chat.messages.length
  });
});

const updateMessage = asyncHandler(async (req, res) => {
  const { chatId, messageId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) {
    throw new AppError('Chat not found', 404);
  }

  const message = chat.messages.id(messageId);
  if (!message) {
    throw new AppError('Message not found', 404);
  }

  // Only allow updating user messages
  if (message.role !== 'user') {
    throw new AppError('Can only edit user messages', 403);
  }

  message.content = content;
  await chat.save();

  res.json({
    success: true,
    message: 'Message updated successfully',
    updatedMessage: message
  });
});

const deleteMessage = asyncHandler(async (req, res) => {
  const { chatId, messageId } = req.params;
  const userId = req.user._id;

  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) {
    throw new AppError('Chat not found', 404);
  }

  const messageIndex = chat.messages.findIndex(msg => msg._id.toString() === messageId);
  if (messageIndex === -1) {
    throw new AppError('Message not found', 404);
  }

  // Remove the message and any subsequent assistant response
  if (chat.messages[messageIndex].role === 'user' &&
      messageIndex + 1 < chat.messages.length &&
      chat.messages[messageIndex + 1].role === 'assistant') {
    chat.messages.splice(messageIndex, 2); // Remove both user message and AI response
  } else {
    chat.messages.splice(messageIndex, 1);
  }

  await chat.save();

  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
});

module.exports = {
  sendMessage,
  getChatHistory,
  clearChatHistory,
  deleteChat,
  getChatStatistics,
  generateMindMap,
  getMessagesByType,
  updateMessage,
  deleteMessage
};