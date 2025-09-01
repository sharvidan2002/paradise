const vision = require('@google-cloud/vision');

class GoogleVisionAPI {
  constructor() {
    this.client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
  }

  async extractTextFromImage(imageBuffer) {
    try {
      const [result] = await this.client.textDetection(imageBuffer);
      const detections = result.textAnnotations;

      if (detections && detections.length > 0) {
        return detections[0].description;
      }

      return '';
    } catch (error) {
      console.error('Google Vision API Error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  async analyzeImage(imageBuffer) {
    try {
      const [result] = await this.client.annotateImage({
        image: { content: imageBuffer },
        features: [
          { type: 'TEXT_DETECTION' },
          { type: 'OBJECT_LOCALIZATION' },
          { type: 'LABEL_DETECTION' }
        ]
      });

      return {
        text: result.textAnnotations?.[0]?.description || '',
        objects: result.localizedObjectAnnotations || [],
        labels: result.labelAnnotations || []
      };
    } catch (error) {
      console.error('Google Vision API Error:', error);
      throw new Error('Failed to analyze image');
    }
  }
}

module.exports = new GoogleVisionAPI();