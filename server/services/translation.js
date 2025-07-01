// Imports the Google Cloud client library
const { Translate } = require('@google-cloud/translate').v2;

class TranslationService {
    constructor() {
        this.translateClient = null;
        this.isInitialized = false;
        this.projectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0930707875';
    }

    initialize() {
        if (this.isInitialized) return;

        try {
            // We can reuse the same authentication mechanism as Firebase.
            // If GOOGLE_APPLICATION_CREDENTIALS or the specific env vars are set,
            // the library will automatically pick them up.
            this.translateClient = new Translate({
                projectId: this.projectId,
            });
            this.isInitialized = true;
            console.log('✅ Google Cloud Translation service initialized.');
        } catch (error) {
            console.error('❌ Google Cloud Translation initialization error:', error);
            this.isInitialized = false;
        }
    }

    async detectLanguage(text) {
        this.initialize(); // Ensure the service is initialized
        if (!text) return { language: 'tr', confidence: 1.0 }; // Default to Turkish for empty text

        try {
            const [detections] = await this.translateClient.detect(text);
            const detection = Array.isArray(detections) ? detections[0] : detections;
            
            console.log(`[Translation] Language detection result: ${detection.language}`);
            return detection; // Return the full detection object
            
        } catch (error) {
            console.error('❌ Cloud Translation API detection error:', error.message);
            // In case of API error, default to Turkish
            return { language: 'tr', confidence: 0.0 };
        }
    }

    async translateText(text, targetLanguage) {
        this.initialize(); // Ensure the client is ready
        if (!this.isInitialized || !text || !targetLanguage) {
            return text; // Return original text if service fails or text is empty
        }

        try {
            // Detect the source language of the AI's response
            let [detections] = await this.translateClient.detect(text);
            const sourceLanguage = detections.language;

            // If the source is already the target, no need to translate
            if (sourceLanguage === targetLanguage) {
                console.log(`[Translation] Source language (${sourceLanguage}) matches target (${targetLanguage}). Skipping.`);
                return text;
            }

            console.log(`[Translation] Translating from '${sourceLanguage}' to '${targetLanguage}'...`);
            
            // Translates the text into the target language.
            let [translations] = await this.translateClient.translate(text, targetLanguage);
            const translation = Array.isArray(translations) ? translations[0] : translations;
            
            console.log(`[Translation] Success. Original: "${text.substring(0,20)}...", Translated: "${translation.substring(0,20)}..."`);
            return translation;

        } catch (error) {
            console.error('❌ Translation API error:', error);
            return text; // Return original text on error
        }
    }
}

module.exports = new TranslationService(); 