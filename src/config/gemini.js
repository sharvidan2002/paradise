const axios = require('axios');

class GeminiAPI {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  }

  async generateContent(prompt, imageData = null) {
    try {
      const requestBody = {
        contents: [
          {
            parts: []
          }
        ]
      };

      // Add text prompt
      if (prompt) {
        requestBody.contents[0].parts.push({
          text: prompt
        });
      }

      // Add image data if provided
      if (imageData) {
        requestBody.contents[0].parts.push({
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.data
          }
        });
      }

      const response = await axios.post(this.baseURL, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.apiKey
        }
      });

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API Error:', error.response?.data || error.message);
      throw new Error('Failed to generate content with Gemini API');
    }
  }

  async analyzeContent(extractedText, userPrompt, contentType) {
    const analysisPrompt = `
      Content Type: ${contentType}
      User Request: ${userPrompt}
      Extracted Text: ${extractedText}

      Based on the above content, provide a comprehensive analysis in the following JSON format:
      {
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

      Ensure the response is valid JSON format only.
    `;

    return await this.generateContent(analysisPrompt);
  }

  async chatResponse(question, analysisData, extractedText) {
    const chatPrompt = `
      You are an AI tutor helping a student understand their study material.

      Original Content: ${extractedText}
      Previous Analysis: ${JSON.stringify(analysisData)}
      Student Question: ${question}

      Provide a helpful, clear answer to the student's question based on the uploaded content and analysis.
      If the question is about creating a mind map, provide the mind map data in this format:
      {
        "type": "mindmap",
        "data": {
          "central": "Main topic",
          "branches": [
            {
              "name": "Branch 1",
              "subtopics": ["subtopic1", "subtopic2"]
            }
          ]
        }
      }

      Otherwise, provide a direct text response.
    `;

    return await this.generateContent(chatPrompt);
  }
}

module.exports = new GeminiAPI();