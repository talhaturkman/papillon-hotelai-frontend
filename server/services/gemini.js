const axios = require('axios');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
        
        console.log(`��� Gemini API initialized: ${this.model} (ULTRA-MINIMAL)`);
        if (!this.apiKey) {
            console.error('❌ GEMINI_API_KEY not found in environment variables');
        } else {
            console.log(`��� API Key loaded: ${this.apiKey.substring(0, 10)}...`);
        }
    }

    async generateResponse(messages, knowledgeContext = null, detectedLanguage = 'tr') {
        try {
            // Simple system prompt
            const systemPrompt = `Sen Papillon Hotels'in yapay zeka asistanısın. Papillon Hotels'un 3 oteli var: Belvil, Zeugma ve Ayscha. 

SADECE TÜRKÇE YANIT VER! Kısa ve net yanıtlar ver.

Eğer otel-spesifik soru sorulursa ve otel belirtilmemişse şunu sor: "Bu bilgiyi size doğru şekilde verebilmem için hangi Papillon otelinde konaklamaktasınız? Belvil, Zeugma yoksa Ayscha?"`;
            
            console.log(`��� Using minimal system prompt for Gemini (ULTRA-MINIMAL)`);
            
            // Ultra minimal conversation history
            let conversationHistory = [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }]
                },
                {
                    role: "model", 
                    parts: [{ text: "Anladım! Papillon Hotels asistanı olarak yardımcı olmaya hazırım." }]
                }
            ];

            // Add only the last user message
            if (messages && messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                conversationHistory.push({
                    role: lastMessage.role === 'user' ? 'user' : 'model',
                    parts: [{ text: lastMessage.content }]
                });
            }

            // ABSOLUTELY MINIMAL CONFIGURATION - Only required fields
            const requestData = {
                contents: conversationHistory,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 512
                }
            };

            const response = await axios.post(
                `${this.apiUrl}?key=${this.apiKey}`,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.candidates && response.data.candidates[0]) {
                const aiResponse = response.data.candidates[0].content.parts[0].text;
                console.log(`✅ Gemini API Success (ULTRA-MINIMAL): Response length ${aiResponse.length} chars`);
                return {
                    success: true,
                    response: aiResponse
                };
            } else {
                console.error('❌ Gemini API: Unexpected response format');
                console.error('Response data:', JSON.stringify(response.data, null, 2));
                throw new Error('Unexpected response format from Gemini API');
            }

        } catch (error) {
            console.error('❌ Gemini API Error Details:');
            console.error('Error message:', error.message);
            console.error('Error code:', error.code);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            }
            return {
                success: false,
                error: 'AI service temporarily unavailable. Please try again.'
            };
        }
    }

    // Detect language from user message
    detectLanguage(text) {
        const patterns = {
            'tr': /[çğıöşüÇĞIİÖŞÜ]|[Bb]ir|[Dd]e|[Vv]e|[İi]ç[İi]n|[Hh]akkında|[Nn]erede/,
            'en': /\b(the|and|for|are|with|have|this|will|you|that|but|not|what|all|were|they|we)\b/i,
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                return lang;
            }
        }

        return 'en'; // Default to English
    }

    // Extract hotel name from user message
    extractHotelName(text) {
        const hotels = ['belvil', 'zeugma', 'ayscha'];
        const textLower = text.toLowerCase();
        
        for (const hotel of hotels) {
            if (textLower.includes(hotel)) {
                return hotel.charAt(0).toUpperCase() + hotel.slice(1);
            }
        }
        
        return null;
    }

    // Check if user is asking about location/map
    isLocationQuery(text) {
        const locationKeywords = {
            'tr': ['nerede', 'nasıl gidilir', 'uzaklık', 'yakın', 'hastane', 'eczane', 'market', 'restoran', 'atm'],
            'en': ['where', 'how to get', 'distance', 'near', 'nearby', 'hospital', 'pharmacy', 'store', 'restaurant', 'atm']
        };

        const textLower = text.toLowerCase();
        
        for (const keywords of Object.values(locationKeywords)) {
            if (keywords.some(keyword => textLower.includes(keyword))) {
                return true;
            }
        }
        
        return false;
    }
}

module.exports = new GeminiService();
