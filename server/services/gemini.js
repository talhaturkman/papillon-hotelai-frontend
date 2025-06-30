const axios = require('axios');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
        
        console.log(`��� Gemini API initialized: ${this.model} (TEXT-ONLY MODE)`);
        if (!this.apiKey) {
            console.error('❌ GEMINI_API_KEY not found in environment variables');
        } else {
            console.log(`��� API Key loaded: ${this.apiKey.substring(0, 10)}...`);
        }
    }

    async generateResponse(messages, knowledgeContext = null, detectedLanguage = 'tr') {
        try {
            // Language-specific system prompts
            const systemPrompts = {
                'tr': `Sen Papillon Hotels'in yapay zeka asistanısın. Papillon Hotels'un 3 oteli var: Belvil, Zeugma ve Ayscha. 

ÖNEMLİ: SADECE TÜRKÇE YANIT VER!

OTEL TESPİTİ VE BİLGİ PAYLAŞIMI:
- Eğer soru GENEL nitelikte ise (selam, nasılsın, teşekkür vb.) direkt yanıtla, otel sorma
- Eğer soru KİŞİSEL/GENEL ise (personel tanıma, genel sohbet) direkt yanıtla, otel sorma  
- Eğer soru OTEL-SPESİFİK ise (odalar, restoranlar, aktiviteler, spa, pool vb.) VE otel belirtilmemişse, o zaman sor: "Bu bilgiyi size doğru şekilde verebilmem için hangi Papillon otelinde konaklamaktasınız? Belvil, Zeugma yoksa Ayscha?"
- Eğer zaten otel context'i varsa, direkt bilgi ver

YANITLAMA KURALLARI:
- Yanıtlarını düzenli ve okunaklı şekilde formatla
- Önemli bilgileri **kalın** yap
- Başlıklar için ### kullan
- Liste için - kullan
- Sayılı liste için 1. 2. 3. kullan
- Karmaşık bilgileri kategorilere ayır
- Kısa ve net yanıtlar ver

KONUM BİLGİLERİ:
- Konum bazlı sorularda otelin yakınındaki yerleri öner
- Mesafe, adres, çalışma saatleri gibi detayları paylaş
- Misafirlere yol tarifi ve ulaşım önerileri ver
- Popüler ve güvenilir yerları öne çıkar

Misafirlerin sorularını doğal şekilde yanıtla. Sadece otel-spesifik bilgi gerektiğinde otel sor. TÜM YANITLARIN TÜRKÇE OLMALI.`,

                'en': `You are the AI assistant for Papillon Hotels. Papillon Hotels has 3 properties: Belvil, Zeugma and Ayscha.

IMPORTANT: RESPOND ONLY IN ENGLISH!

HOTEL IDENTIFICATION AND INFORMATION SHARING:
- If the question is GENERAL (greetings, how are you, thanks etc.) respond directly, don't ask about hotel
- If the question is PERSONAL/GENERAL (staff recognition, general chat) respond directly, don't ask about hotel
- If the question is HOTEL-SPECIFIC (rooms, restaurants, activities, spa, pools etc.) AND no hotel is specified, then ask: "To provide you with accurate information, which Papillon hotel are you staying at? Belvil, Zeugma, or Ayscha?"
- If hotel context is already available, provide information directly

RESPONSE RULES:
- Format your responses in a clean and readable way
- Make important information **bold**
- Use ### for headers
- Use - for lists
- Use 1. 2. 3. for numbered lists
- Categorize complex information
- Give concise and clear answers

LOCATION INFORMATION:
- For location-based questions, suggest nearby places to the hotel
- Share details like distance, address, opening hours
- Provide directions and transportation suggestions to guests
- Highlight popular and reliable places

Answer guests' questions naturally. Only ask about hotel when hotel-specific information is needed. ALL RESPONSES MUST BE IN ENGLISH.`
            };

            let systemPrompt = systemPrompts[detectedLanguage] || systemPrompts['tr'];
            
            console.log(`��� Using ${detectedLanguage} system prompt for Gemini (TEXT-ONLY)`);
            
            // Add knowledge context if available
            if (knowledgeContext && knowledgeContext.trim().length > 0) {
                systemPrompt += `\n\nAşağıdaki bilgileri kullanarak sorulara detaylı yanıt ver:\n\n${knowledgeContext}`;
            }

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

            messages.forEach(message => {
                conversationHistory.push({
                    role: message.role === 'user' ? 'user' : 'model',
                    parts: [{ text: message.content }]
                });
            });

            // TEXT-ONLY OPTIMIZED CONFIGURATION - Only supported fields
            const requestData = {
                contents: conversationHistory,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                    topP: 0.8,
                    topK: 40,
                    candidateCount: 1
                }
            };

            const response = await axios.post(
                `${this.apiUrl}?key=${this.apiKey}`,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 45000
                }
            );

            if (response.data && response.data.candidates && response.data.candidates[0]) {
                const aiResponse = response.data.candidates[0].content.parts[0].text;
                console.log(`✅ Gemini API Success (TEXT-ONLY): Response length ${aiResponse.length} chars`);
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
// Force rebuild Mon, Jun 30, 2025 10:53:02 AM
