const axios = require('axios');

class NaturalLanguageService {
    constructor() {
        this.apiKey = process.env.GOOGLE_CLOUD_API_KEY;
        this.baseUrl = 'https://language.googleapis.com/v1';
        
        console.log('🧠 Natural Language API initialized');
        if (!this.apiKey) {
            console.error('❌ GOOGLE_CLOUD_API_KEY not found');
        }
    }

    // Detect language with conversation context
    async detectLanguageWithContext(text, chatHistory = []) {
        try {
            // Check conversation history for language consistency
            const recentMessages = chatHistory.slice(-3); // Last 3 messages
            let contextLanguage = null;
            
            if (recentMessages.length > 0) {
                // Get languages from recent messages using fallback (more reliable)
                const recentLanguages = [];
                for (const msg of recentMessages) {
                    if (msg.role === 'user') {
                        const lang = this.detectLanguageFallback(msg.content);
                        recentLanguages.push(lang);
                    }
                }
                
                // If recent messages are consistently in one language, prefer that
                if (recentLanguages.length > 0) {
                    const languageCount = {};
                    recentLanguages.forEach(lang => {
                        languageCount[lang] = (languageCount[lang] || 0) + 1;
                    });
                    
                    const dominantLang = Object.keys(languageCount).reduce((a, b) => 
                        languageCount[a] > languageCount[b] ? a : b
                    );
                    
                    // If 1+ recent messages are in the same language, use context (lowered threshold)
                    if (languageCount[dominantLang] >= 1) {
                        contextLanguage = dominantLang;
                        console.log(`🧠 Using conversation context: ${contextLanguage} (${languageCount[dominantLang]} recent messages)`);
                    }
                }
            }
            
            // Detect current message language
            const currentLanguage = await this.detectLanguage(text);
            
            // For very short messages (< 15 chars), strongly prefer context language
            if (text.trim().length < 15 && contextLanguage) {
                console.log(`🔗 Short message, using context: "${text}" → ${contextLanguage} (instead of ${currentLanguage})`);
                return contextLanguage;
            }
            
            // For ambiguous cases where context exists, check confidence
            if (contextLanguage && contextLanguage !== currentLanguage) {
                // If current detection has low confidence and context is consistent, use context
                if (text.trim().length < 25) {
                    console.log(`🔗 Ambiguous message, using context: "${text}" → ${contextLanguage}`);
                    return contextLanguage;
                }
            }
            
            return currentLanguage;
            
        } catch (error) {
            console.warn('⚠️ Language detection with context failed:', error.message);
            return await this.detectLanguage(text);
        }
    }

    // Detect language using Google Cloud Natural Language API
    async detectLanguage(text) {
        try {
            if (!text || text.trim().length === 0) {
                return 'tr'; // Default to Turkish
            }

            // ÖNCE FALLBACK'İ DENE - daha güvenilir
            const fallbackResult = this.detectLanguageFallback(text);
            
            // Türkçe karakterler varsa kesinlikle Türkçe
            if (/[çğıöşüÇĞIİÖŞÜ]/.test(text)) {
                console.log(`🇹🇷 Turkish characters detected, using TR (instead of API)`);
                return 'tr';
            }
            
            // Net Türkçe kelimeler varsa Türkçe
            if (/\b(ben|de|da|kalıyorum|istiyorum|nedir|nasıl|hakkında|bilgi)\b/i.test(text)) {
                console.log(`🇹🇷 Turkish words detected, using TR (instead of API)`);
                return 'tr';
            }
            
            // Net İngilizce kelimeler varsa İngilizce
            if (/\b(need|information|staying|hotel|english|restaurant|hello|please|want)\b/i.test(text)) {
                console.log(`🇺🇸 English words detected, using EN (instead of API)`);
                return 'en';
            }

            // Eğer fallback güçlü sonuç verdiyse onu kullan
            if (fallbackResult !== 'en' || text.length < 20) {
                console.log(`🔍 Using fallback result: ${fallbackResult} (skipping Google API)`);
                return fallbackResult;
            }

            // Sadece belirsiz durumlarda Google API'yi kullan
            const requestData = {
                document: {
                    type: 'PLAIN_TEXT',
                    content: text
                }
            };

            const response = await axios.post(
                `${this.baseUrl}/documents:detectLanguage?key=${this.apiKey}`,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 5000
                }
            );

            if (response.data && response.data.languages && response.data.languages.length > 0) {
                const detectedLang = response.data.languages[0].language;
                const confidence = response.data.languages[0].confidence;
                
                console.log(`🌐 Google API detected: ${detectedLang} (confidence: ${confidence.toFixed(2)})`);
                
                // Map Google language codes to our supported languages
                const languageMap = {
                    'tr': 'tr',
                    'en': 'en', 
                    'de': 'de',
                    'ru': 'ru',
                    'es': 'en', // Spanish → English fallback
                    'fr': 'en', // French → English fallback
                    'it': 'en', // Italian → English fallback
                };
                
                return languageMap[detectedLang] || 'en'; // Default to English if unknown
            }
            
            console.log('⚠️ No language detected, using fallback result:', fallbackResult);
            return fallbackResult;
            
        } catch (error) {
            console.warn('⚠️ Natural Language API error:', error.response?.data?.error?.message || error.message);
            
            // Fallback to regex pattern matching
            return this.detectLanguageFallback(text);
        }
    }

    // Fallback language detection using regex patterns
    detectLanguageFallback(text) {
        const patterns = {
            'tr': /[çğıöşüÇĞIİÖŞÜ]|[Bb]ir|[Dd]e|[Vv]e|[İi]ç[İi]n|[Hh]akkında|[Nn]erede|[Mm]erhaba|[Ss]elamlar|[Nn]asıl|[Vv]ar mı|[Yy]akın|[Bb]ilgi|[İi]stiyorum|[Rr]estoran/,
            'en': /\b(hello|hi|thanks|thank|the|and|for|are|with|have|this|will|you|that|but|not|what|all|were|they|we|where|near|how|good|please|help|info|information|saw|them|i|me|my|see|yes|no|ok|okay|need|want|english|restaurant|restaurants|hotel|hotels|pool|pools|spa|room|rooms|staying|stay)\b/i,
            'de': /\b(hallo|guten|und|der|die|das|ist|ein|eine|für|mit|auf|ich|sie|es|wir|ihr|wo|wie|in der nähe|krankenhaus|restaurant|danke|bitte|hilfe|welchem|hotel|wohnen)\b/i,
            'ru': /[а-яё]|[А-ЯЁ]|\b(привет|где|как|рядом|ресторан|больница|аптека|музей|пляж|спасибо|пожалуйста|помощь)\b/i
        };

        // Check for specific language indicators with weights
        let scores = { tr: 0, en: 0, de: 0, ru: 0 };
        
        for (const [lang, pattern] of Object.entries(patterns)) {
            const matches = text.match(pattern);
            if (matches) {
                scores[lang] = matches.length;
            }
        }
        
        // Special boost for very clear English indicators
        const clearEnglishWords = /\b(need|information|english|restaurant|hello|please|want|staying|hotel)\b/i;
        if (clearEnglishWords.test(text)) {
            scores['en'] += 3; // Strong boost for clear English
        }
        
        // Special boost for clear Turkish indicators  
        const clearTurkishWords = /\b(bilgi|istiyorum|restoran|nerede|nasıl|hakkında)\b/i;
        if (clearTurkishWords.test(text)) {
            scores['tr'] += 3; // Strong boost for clear Turkish
        }

        // Find language with highest score
        const detectedLang = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
        
        console.log(`🔍 Fallback detection scores:`, scores);
        console.log(`🔍 Detected language (fallback): ${detectedLang}`);
        
        // Return detected language if score > 0, otherwise default to English
        return scores[detectedLang] > 0 ? detectedLang : 'en';
    }

    // Analyze sentiment (bonus feature)
    async analyzeSentiment(text) {
        try {
            const requestData = {
                document: {
                    type: 'PLAIN_TEXT',
                    content: text
                },
                encodingType: 'UTF8'
            };

            const response = await axios.post(
                `${this.baseUrl}/documents:analyzeSentiment?key=${this.apiKey}`,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 5000
                }
            );

            if (response.data && response.data.documentSentiment) {
                const sentiment = response.data.documentSentiment;
                return {
                    score: sentiment.score, // -1 to 1 (negative to positive)
                    magnitude: sentiment.magnitude // 0 to infinity (emotional intensity)
                };
            }
            
            return null;
            
        } catch (error) {
            console.warn('⚠️ Sentiment analysis error:', error.message);
            return null;
        }
    }
}

module.exports = new NaturalLanguageService(); 