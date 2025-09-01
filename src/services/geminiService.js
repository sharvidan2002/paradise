const geminiAPI = require('../config/gemini');
const fs = require('fs');

class GeminiService {
  async processImageWithGemini(imagePath, prompt, contentType) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const imageData = {
        mimeType: this.getMimeType(imagePath),
        data: base64Image
      };

      const analysisPrompt = `
        Content Type: ${contentType}
        User Request: ${prompt}

        Analyze this ${contentType} image and provide a comprehensive analysis in the following JSON format:
        {
          "extractedText": "All text found in the image",
          "summary": "Concise summary of the content",
          "explanation": "Detailed explanation of key concepts in simple language",
          "quizQuestions": [
            {
              "type": "mcq",
              "question": "Question text",
              "options": ["A", "B", "C", "D"],
              "correct": 0
            },
            {
              "type": "short_answer",
              "question": "Question text",
              "answer": "Expected answer"
            }
          ],
          "flashcards": [
            {
              "front": "Question or term",
              "back": "Answer or definition"
            }
          ],
          "keyTopics": ["topic1", "topic2", "topic3"],
          "mindMapData": {
            "central": "Main topic",
            "branches": [
              {
                "name": "Branch 1",
                "subtopics": ["subtopic1", "subtopic2"]
              }
            ]
          }
        }

        Ensure the response is valid JSON format only. For diagrams, focus on explaining the visual elements and their relationships.
      `;

      const result = await geminiAPI.generateContent(analysisPrompt, imageData);
      return this.parseAnalysisResult(result);
    } catch (error) {
      console.error('Gemini service error:', error);
      throw new Error('Failed to process image with Gemini');
    }
  }

  async analyzeExtractedText(extractedText, prompt, contentType) {
    try {
      const result = await geminiAPI.analyzeContent(extractedText, prompt, contentType);
      return this.parseAnalysisResult(result);
    } catch (error) {
      console.error('Gemini analysis error:', error);
      throw new Error('Failed to analyze extracted text');
    }
  }

  async generateChatResponse(question, analysisData, extractedText) {
    try {
      const response = await geminiAPI.chatResponse(question, analysisData, extractedText);

      // Check if response is a mind map
      try {
        const parsed = JSON.parse(response);
        if (parsed.type === 'mindmap') {
          return {
            type: 'mindmap',
            content: response,
            mindMapData: parsed.data
          };
        }
      } catch (parseError) {
        // Not JSON, return as regular text
      }

      return {
        type: 'text',
        content: response
      };
    } catch (error) {
      console.error('Chat response error:', error);
      throw new Error('Failed to generate chat response');
    }
  }

  parseAnalysisResult(result) {
    try {
      // Clean the result string to ensure it's valid JSON
      let cleanResult = result.trim();

      // Remove markdown code blocks if present
      if (cleanResult.startsWith('```json')) {
        cleanResult = cleanResult.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResult.startsWith('```')) {
        cleanResult = cleanResult.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanResult);

      // Validate required fields
      const requiredFields = ['summary', 'explanation', 'quizQuestions', 'flashcards', 'keyTopics'];
      for (const field of requiredFields) {
        if (!parsed[field]) {
          parsed[field] = this.getDefaultValue(field);
        }
      }

      return parsed;
    } catch (error) {
      console.error('Parse error:', error);
      return this.getDefaultAnalysis();
    }
  }

  getDefaultValue(field) {
    const defaults = {
      summary: 'Unable to generate summary',
      explanation: 'Unable to generate explanation',
      quizQuestions: [],
      flashcards: [],
      keyTopics: [],
      mindMapData: { central: 'Main Topic', branches: [] }
    };
    return defaults[field] || '';
  }

  getDefaultAnalysis() {
    return {
      extractedText: '',
      summary: 'Unable to analyze content',
      explanation: 'Unable to provide explanation',
      quizQuestions: [],
      flashcards: [],
      keyTopics: [],
      mindMapData: { central: 'Main Topic', branches: [] }
    };
  }

  getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}

module.exports = new GeminiService();