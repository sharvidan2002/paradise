const googleVision = require('../config/googleVision');
const fs = require('fs');

class VisionService {
  async extractTextFromImage(imagePath) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const extractedText = await googleVision.extractTextFromImage(imageBuffer);

      return {
        text: extractedText,
        confidence: this.calculateConfidence(extractedText)
      };
    } catch (error) {
      console.error('Vision service error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  async analyzeImageContent(imagePath) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const analysis = await googleVision.analyzeImage(imageBuffer);

      return {
        extractedText: analysis.text,
        objects: analysis.objects.map(obj => ({
          name: obj.name,
          confidence: obj.score
        })),
        labels: analysis.labels.map(label => ({
          name: label.description,
          confidence: label.score
        })),
        contentType: this.determineContentType(analysis)
      };
    } catch (error) {
      console.error('Vision analysis error:', error);
      throw new Error('Failed to analyze image content');
    }
  }

  determineContentType(analysis) {
    const labels = analysis.labels || [];
    const objects = analysis.objects || [];
    const text = analysis.text || '';

    // Check for handwritten content
    const handwritingIndicators = ['handwriting', 'writing', 'pen', 'pencil', 'notebook'];
    const hasHandwritingLabels = labels.some(label =>
      handwritingIndicators.some(indicator =>
        label.description.toLowerCase().includes(indicator)
      )
    );

    // Check for textbook/printed content
    const textbookIndicators = ['book', 'page', 'document', 'text'];
    const hasTextbookLabels = labels.some(label =>
      textbookIndicators.some(indicator =>
        label.description.toLowerCase().includes(indicator)
      )
    );

    // Check for diagrams
    const diagramIndicators = ['diagram', 'chart', 'graph', 'illustration', 'drawing'];
    const hasDiagramLabels = labels.some(label =>
      diagramIndicators.some(indicator =>
        label.description.toLowerCase().includes(indicator)
      )
    );

    const hasObjects = objects.length > 0;
    const hasLimitedText = text.length < 100;

    // Determine content type based on analysis
    if (hasDiagramLabels || (hasObjects && hasLimitedText)) {
      return 'diagram';
    } else if (hasHandwritingLabels) {
      return 'handwritten';
    } else if (hasTextbookLabels || text.length > 100) {
      return 'textbook';
    } else {
      // Default fallback - try to guess from text characteristics
      return this.guessContentTypeFromText(text);
    }
  }

  guessContentTypeFromText(text) {
    if (!text || text.length < 10) {
      return 'diagram';
    }

    // Check for characteristics of handwritten notes
    const informalMarkers = ['my', 'i think', 'note:', 'remember', '??', 'todo'];
    const hasInformalMarkers = informalMarkers.some(marker =>
      text.toLowerCase().includes(marker)
    );

    // Check for textbook characteristics
    const formalMarkers = ['chapter', 'definition', 'theorem', 'figure', 'table', 'reference'];
    const hasFormalMarkers = formalMarkers.some(marker =>
      text.toLowerCase().includes(marker)
    );

    if (hasInformalMarkers) {
      return 'handwritten';
    } else if (hasFormalMarkers) {
      return 'textbook';
    } else {
      return 'textbook'; // Default for text content
    }
  }

  calculateConfidence(text) {
    if (!text || text.length === 0) return 0;

    // Simple confidence calculation based on text characteristics
    let confidence = 0.5; // Base confidence

    // Increase confidence for longer text
    if (text.length > 50) confidence += 0.2;
    if (text.length > 200) confidence += 0.2;

    // Increase confidence for proper sentence structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  isTextExtractable(contentType) {
    // All content types can have extractable text
    return true;
  }

  preprocessImage(imagePath) {
    // In a production environment, you might want to add image preprocessing
    // such as rotation correction, contrast enhancement, etc.
    return imagePath;
  }
}

module.exports = new VisionService();