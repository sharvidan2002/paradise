const jsPDF = require('jspdf');
const fs = require('fs');
const path = require('path');

class PDFService {
  constructor() {
    // Ensure exports directory exists
    const exportsDir = 'exports/';
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
  }

  async generateStudyMaterialPDF(analysis, title) {
    try {
      const doc = new jsPDF();
      let yPosition = 20;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const maxLineWidth = 170;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yPosition);
      yPosition += 15;

      // Add line separator
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, margin + maxLineWidth, yPosition);
      yPosition += 15;

      // Summary Section
      if (analysis.summary) {
        yPosition = this.addSection(doc, 'Summary', analysis.summary, yPosition, margin, maxLineWidth, pageHeight);
        yPosition += 10;
      }

      // Explanation Section
      if (analysis.explanation) {
        yPosition = this.addSection(doc, 'Explanation', analysis.explanation, yPosition, margin, maxLineWidth, pageHeight);
        yPosition += 10;
      }

      // Key Topics Section
      if (analysis.keyTopics && analysis.keyTopics.length > 0) {
        yPosition = this.addSection(doc, 'Key Topics', analysis.keyTopics.join(', '), yPosition, margin, maxLineWidth, pageHeight);
        yPosition += 10;
      }

      // Quiz Questions Section
      if (analysis.quizQuestions && analysis.quizQuestions.length > 0) {
        yPosition = this.addQuizSection(doc, analysis.quizQuestions, yPosition, margin, maxLineWidth, pageHeight);
        yPosition += 10;
      }

      // Flashcards Section
      if (analysis.flashcards && analysis.flashcards.length > 0) {
        yPosition = this.addFlashcardsSection(doc, analysis.flashcards, yPosition, margin, maxLineWidth, pageHeight);
      }

      // Save the PDF
      const filename = `study-material-${Date.now()}.pdf`;
      const filepath = path.join('exports', filename);

      // Write PDF to file
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      fs.writeFileSync(filepath, pdfBuffer);

      return {
        filename,
        filepath,
        downloadUrl: `/api/export/download/${filename}`
      };
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  addSection(doc, title, content, yPosition, margin, maxLineWidth, pageHeight) {
    // Check if we need a new page
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPosition);
    yPosition += 8;

    // Section content
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const lines = doc.splitTextToSize(content, maxLineWidth);

    for (const line of lines) {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += 6;
    }

    return yPosition;
  }

  addQuizSection(doc, questions, yPosition, margin, maxLineWidth, pageHeight) {
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Quiz Questions', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    questions.forEach((question, index) => {
      // Check if we need a new page for this question
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }

      // Question number and text
      const questionText = `${index + 1}. ${question.question}`;
      const questionLines = doc.splitTextToSize(questionText, maxLineWidth);

      for (const line of questionLines) {
        doc.text(line, margin, yPosition);
        yPosition += 6;
      }

      // Options for MCQ
      if (question.type === 'mcq' && question.options) {
        question.options.forEach((option, optIndex) => {
          const optionText = `   ${String.fromCharCode(65 + optIndex)}. ${option}`;
          doc.text(optionText, margin, yPosition);
          yPosition += 5;
        });

        // Correct answer
        if (typeof question.correct === 'number') {
          doc.setFont('helvetica', 'bold');
          doc.text(`   Answer: ${String.fromCharCode(65 + question.correct)}`, margin, yPosition);
          doc.setFont('helvetica', 'normal');
          yPosition += 8;
        }
      }

      // Answer for short answer questions
      if (question.type === 'short_answer' && question.answer) {
        doc.setFont('helvetica', 'bold');
        doc.text('   Answer:', margin, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += 5;

        const answerLines = doc.splitTextToSize(question.answer, maxLineWidth - 10);
        for (const line of answerLines) {
          doc.text(line, margin + 10, yPosition);
          yPosition += 5;
        }
        yPosition += 3;
      }

      yPosition += 5; // Space between questions
    });

    return yPosition;
  }

  addFlashcardsSection(doc, flashcards, yPosition, margin, maxLineWidth, pageHeight) {
    // Check if we need a new page
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Flashcards', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    flashcards.forEach((card, index) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }

      // Card number
      doc.setFont('helvetica', 'bold');
      doc.text(`Card ${index + 1}:`, margin, yPosition);
      yPosition += 6;

      // Front
      doc.setFont('helvetica', 'bold');
      doc.text('Front:', margin + 5, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 5;

      const frontLines = doc.splitTextToSize(card.front, maxLineWidth - 10);
      for (const line of frontLines) {
        doc.text(line, margin + 10, yPosition);
        yPosition += 5;
      }

      // Back
      doc.setFont('helvetica', 'bold');
      doc.text('Back:', margin + 5, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 5;

      const backLines = doc.splitTextToSize(card.back, maxLineWidth - 10);
      for (const line of backLines) {
        doc.text(line, margin + 10, yPosition);
        yPosition += 5;
      }

      yPosition += 8; // Space between cards
    });

    return yPosition;
  }

  cleanupOldFiles() {
    try {
      const exportsDir = 'exports/';
      const files = fs.readdirSync(exportsDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      files.forEach(file => {
        const filepath = path.join(exportsDir, file);
        const stats = fs.statSync(filepath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filepath);
          console.log(`Deleted old export file: ${file}`);
        }
      });
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

module.exports = new PDFService();