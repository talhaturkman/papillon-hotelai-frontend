const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const documentai = require('./documentai');

class PDFProcessor {
    constructor() {
        this.maxPagesPerChunk = 15;
    }

    async processPdf(filePath) {
        try {
            console.log(`[PDFProcessor] Starting full processing for: ${filePath}`);
            const fileBuffer = await fs.readFile(filePath);

            const chunks = await this.splitPDF(fileBuffer);
            console.log(`[PDFProcessor] PDF split into ${chunks.length} chunks.`);

            const processingPromises = chunks.map(chunk => 
                documentai.processDocument(chunk.buffer, 'application/pdf')
            );

            const chunkResults = await Promise.all(processingPromises);
            
            let combinedText = '';
            chunkResults.forEach((result, index) => {
                if (result.success && result.text) {
                    if (combinedText) combinedText += '\n\n--- Page Break ---\n\n';
                    combinedText += result.text;
                } else {
                    console.warn(`[PDFProcessor] Chunk ${index + 1} failed processing: ${result.error}`);
                }
            });

            if (!combinedText) {
                throw new Error('All chunks failed processing or returned no text.');
            }

            console.log(`[PDFProcessor] Successfully processed and combined text. Total length: ${combinedText.length}`);
            return combinedText;

        } catch (error) {
            console.error(`❌ [PDFProcessor] Error during PDF processing of ${filePath}:`, error.message);
            throw error;
        }
    }

    async splitPDF(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const totalPages = pdfDoc.getPageCount();

            if (totalPages <= this.maxPagesPerChunk) {
                console.log(`[PDFProcessor] No splitting needed for ${totalPages} pages.`);
                return [{ buffer: pdfBuffer }];
            }

            console.log(`[PDFProcessor] Splitting ${totalPages} pages into chunks of ${this.maxPagesPerChunk}.`);
            const chunks = [];
            const totalChunks = Math.ceil(totalPages / this.maxPagesPerChunk);

            for (let i = 0; i < totalChunks; i++) {
                const startPage = i * this.maxPagesPerChunk;
                const endPage = Math.min(startPage + this.maxPagesPerChunk, totalPages);
                
                const chunkDoc = await PDFDocument.create();
                const copiedPages = await chunkDoc.copyPages(pdfDoc, Array.from({length: endPage - startPage}, (_, k) => startPage + k));
                copiedPages.forEach(page => chunkDoc.addPage(page));
                
                const chunkBuffer = await chunkDoc.save();
                chunks.push({ buffer: Buffer.from(chunkBuffer) });
            }

            console.log(`[PDFProcessor] PDF split into ${chunks.length} buffers.`);
            return chunks;

        } catch (error) {
            console.error('❌ [PDFProcessor] Error splitting PDF:', error);
            throw error;
        }
    }
    
    async getPDFInfo(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const totalPages = pdfDoc.getPageCount();
            return {
                totalPages: totalPages,
                estimatedChunks: Math.ceil(totalPages / this.maxPagesPerChunk),
            };
        } catch (error) {
            console.error('❌ Error getting PDF info:', error);
            throw error;
        }
    }
}

module.exports = new PDFProcessor();
