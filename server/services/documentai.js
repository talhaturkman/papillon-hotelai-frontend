const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');

class DocumentAIService {
    constructor() {
        this.projectId = process.env.DOCUMENT_AI_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
        this.location = process.env.DOCUMENT_AI_LOCATION || 'eu'; // Default to EU
        this.processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
        this.client = null;

        if (!this.projectId || !this.location || !this.processorId) {
            console.warn('⚠️ Document AI environment variables are not fully configured. Service may be limited.');
        } else {
             const clientOptions = {
                apiEndpoint: `${this.location}-documentai.googleapis.com`,
            };
            this.client = new DocumentProcessorServiceClient(clientOptions);
            console.log(`✅ Document AI Service configured for endpoint: ${clientOptions.apiEndpoint}`);
        }
    }

    async processDocument(fileBuffer, mimeType = 'application/pdf') {
        if (!this.client) {
            console.error('❌ Document AI client is not initialized. Cannot process document.');
            return { success: false, error: 'Document AI client not initialized.' };
        }

        const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;
        
        try {
            const encodedImage = fileBuffer.toString('base64');

            const request = {
                name,
                rawDocument: {
                    content: encodedImage,
                    mimeType,
                },
            };

            console.log(`[DocumentAI] Processing document chunk with processor: ${this.processorId}`);
            const [result] = await this.client.processDocument(request);
            const { document } = result;
            
            console.log(`[DocumentAI] Successfully extracted text from chunk.`);
            return {
                success: true,
                text: document.text || '',
            };

        } catch (error) {
            console.error('❌ Document AI processing error:', error.message);
            return {
                success: false,
                error: `Document AI API error: ${error.message}`,
            };
        }
    }
}

module.exports = new DocumentAIService();
