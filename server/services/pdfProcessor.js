const { PDFDocument } = require('pdf-lib');

class PDFProcessor {
    constructor() {
        this.maxPagesPerChunk = 15; // Document AI limit
    }

    // Split PDF into chunks based on page limit
    async splitPDF(pdfBuffer) {
        try {
            console.log('📄 Starting PDF split process...');
            
            // Load the PDF
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const totalPages = pdfDoc.getPageCount();
            
            console.log(`📄 PDF has ${totalPages} pages, splitting into chunks of ${this.maxPagesPerChunk} pages`);

            if (totalPages <= this.maxPagesPerChunk) {
                // No need to split
                console.log('📄 PDF is within page limit, no splitting needed');
                return [{
                    buffer: pdfBuffer,
                    pageRange: `1-${totalPages}`,
                    chunkIndex: 1,
                    totalChunks: 1
                }];
            }

            const chunks = [];
            const totalChunks = Math.ceil(totalPages / this.maxPagesPerChunk);

            for (let i = 0; i < totalChunks; i++) {
                const startPage = i * this.maxPagesPerChunk;
                const endPage = Math.min(startPage + this.maxPagesPerChunk - 1, totalPages - 1);
                
                console.log(`📄 Creating chunk ${i + 1}/${totalChunks}: pages ${startPage + 1}-${endPage + 1}`);

                // Create new PDF document for this chunk
                const chunkDoc = await PDFDocument.create();
                
                // Copy pages from original PDF to chunk
                const pagesToCopy = [];
                for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
                    pagesToCopy.push(pageIndex);
                }

                const copiedPages = await chunkDoc.copyPages(pdfDoc, pagesToCopy);
                copiedPages.forEach((page) => chunkDoc.addPage(page));

                // Save chunk as buffer
                const chunkBuffer = await chunkDoc.save();

                chunks.push({
                    buffer: Buffer.from(chunkBuffer),
                    pageRange: `${startPage + 1}-${endPage + 1}`,
                    chunkIndex: i + 1,
                    totalChunks: totalChunks,
                    pages: endPage - startPage + 1
                });
            }

            console.log(`✅ PDF split into ${chunks.length} chunks successfully`);
            return chunks;

        } catch (error) {
            console.error('❌ Error splitting PDF:', error);
            throw new Error(`PDF splitting failed: ${error.message}`);
        }
    }

    // Combine text from multiple chunks
    combineChunkTexts(chunkResults) {
        try {
            let combinedText = '';
            let totalPages = 0;
            const metadata = {
                chunks: [],
                totalProcessedPages: 0,
                processingTime: new Date().toISOString()
            };

            // Sort chunks by index to maintain order
            const sortedResults = chunkResults.sort((a, b) => a.chunkIndex - b.chunkIndex);

            sortedResults.forEach((result, index) => {
                if (result.success && result.text) {
                    // Add separator between chunks
                    if (combinedText.length > 0) {
                        combinedText += '\n\n--- Sayfa Geçişi ---\n\n';
                    }
                    
                    combinedText += `[Sayfa ${result.pageRange}]\n${result.text}`;
                    totalPages += result.pages || 0;
                    
                    metadata.chunks.push({
                        chunkIndex: result.chunkIndex,
                        pageRange: result.pageRange,
                        textLength: result.text.length,
                        success: true
                    });
                } else {
                    console.warn(`⚠️ Chunk ${result.chunkIndex} failed:`, result.error);
                    metadata.chunks.push({
                        chunkIndex: result.chunkIndex,
                        pageRange: result.pageRange,
                        success: false,
                        error: result.error
                    });
                }
            });

            metadata.totalProcessedPages = totalPages;
            
            console.log(`✅ Combined text from ${sortedResults.length} chunks, total pages: ${totalPages}`);
            
            return {
                success: true,
                text: combinedText,
                metadata: metadata,
                totalChunks: sortedResults.length,
                successfulChunks: metadata.chunks.filter(c => c.success).length
            };

        } catch (error) {
            console.error('❌ Error combining chunk texts:', error);
            return {
                success: false,
                error: error.message,
                metadata: { chunks: [] }
            };
        }
    }

    // Get PDF info without processing
    async getPDFInfo(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const totalPages = pdfDoc.getPageCount();
            const estimatedChunks = Math.ceil(totalPages / this.maxPagesPerChunk);
            
            return {
                totalPages: totalPages,
                estimatedChunks: estimatedChunks,
                needsSplitting: totalPages > this.maxPagesPerChunk,
                maxPagesPerChunk: this.maxPagesPerChunk
            };
        } catch (error) {
            console.error('❌ Error getting PDF info:', error);
            throw error;
        }
    }
}

module.exports = new PDFProcessor(); 