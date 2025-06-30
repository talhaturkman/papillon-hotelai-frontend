const axios = require('axios');
const naturalLanguageService = require('./naturalLanguage'); // Import the service

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
        
        console.log(`��� Gemini API initialized: ${this.model}`);
        if (!this.apiKey) {
            console.error('❌ GEMINI_API_KEY not found in environment variables');
        } else {
            console.log(`��� API Key loaded: ${this.apiKey.substring(0, 10)}...`);
        }
    }

    async generateResponse(messages, knowledgeContext = null, detectedLanguage = 'tr') {
        try {
            let finalSystemPrompt;

            if (knowledgeContext && knowledgeContext.trim().length > 0) {
                // Scenario 1: We HAVE knowledge context. Force the AI to use it and only it.
                const contextPrompts = {
                    'tr': `Sen bir otel asistanısın. Kullanıcının sorusunu SADECE ve SADECE aşağıdaki Bilgi Metni'ni kullanarak yanıtla. Bu metnin dışına asla çıkma. Eğer cevap metinde yoksa, "Bu konuda detaylı bilgim bulunmuyor." de. Kullanıcıya ASLA hangi otelde olduğunu sorma, çünkü sana verilen bilgi zaten doğru otele aittir. Yanıtın mutlaka TÜRKÇE olmalı.

### Bilgi Metni ###
${knowledgeContext}
### Bilgi Metni Sonu ###`,
                    'en': `You are a hotel assistant. Answer the user's question using ONLY the Information Text below. Never go outside of this text. If the answer is not in the text, say "I don't have detailed information on this topic." NEVER ask the user which hotel they are at, because the information provided is for the correct hotel. Your response must be in ENGLISH.

### Information Text ###
${knowledgeContext}
### End of Information Text ###`,
                    'de': `Sie sind ein Hotelassistent. Beantworten Sie die Frage des Benutzers NUR mit dem unten stehenden Informationstext. Verlassen Sie diesen Text niemals. Wenn die Antwort nicht im Text enthalten ist, sagen Sie "Ich habe keine detaillierten Informationen zu diesem Thema." Fragen Sie den Benutzer NIEMALS, in welchem Hotel er sich befindet, da die bereitgestellten Informationen für das richtige Hotel gelten. Ihre Antwort muss auf DEUTSCH sein.

### Informationstext ###
${knowledgeContext}
### Ende des Informationstextes ###`,
                    'ru': `Вы гостиничный ассистент. Отвечайте на вопрос пользователя, используя ТОЛЬКО приведенный ниже Информационный Текст. Никогда не выходите за рамки этого текста. Если ответа в тексте нет, скажите "У меня нет подробной информации по этому вопросу." НИКОГДА не спрашивайте пользователя, в каком отеле он находится, так как предоставленная информация относится к правильному отелю. Ваш ответ должен быть на РУССКОМ языке.

### Информационный Текст ###
${knowledgeContext}
### Конец Информационного Текста ###`
                };
                finalSystemPrompt = contextPrompts[detectedLanguage] || contextPrompts['tr'];
            } else {
                // Scenario 2: We have NO knowledge context. Use the general prompt that is allowed to ask questions.
                const generalPrompts = {
                    'tr': `Sen Papillon Hotels'in yapay zeka asistanısın. Papillon Hotels'un 3 oteli var: Belvil, Zeugma ve Ayscha. Eğer kullanıcı otel-spesifik bir soru sorarsa (oda, restoran, aktivite vb.) ve hangi otelden bahsettiğini belirtmezse, ona hangi otelde konakladığını sor: "Size daha doğru bilgi verebilmem için hangi Papillon otelinde konakladığınızı öğrenebilir miyim: Belvil, Zeugma veya Ayscha?" Diğer durumlarda soruları doğrudan yanıtla. Yanıtların her zaman TÜRKÇE olmalı.`,
                    'en': `You are the AI assistant for Papillon Hotels. Papillon Hotels has 3 properties: Belvil, Zeugma and Ayscha. If the user asks a hotel-specific question (e.g., about rooms, restaurants, activities) and does not specify which hotel they are talking about, ask them which hotel they are staying at: "To provide you with more accurate information, could you please let me know which Papillon hotel you are staying at: Belvil, Zeugma, or Ayscha?" Otherwise, answer the questions directly. Your responses must always be in ENGLISH.`,
                    'de': `Sie sind der KI-Assistent für Papillon Hotels. Papillon Hotels hat 3 Häuser: Belvil, Zeugma und Ayscha. Wenn der Gast eine hotelspezifische Frage stellt (z. B. zu Zimmern, Restaurants, Aktivitäten) und nicht angibt, von welchem Hotel er spricht, fragen Sie ihn, in welchem Hotel er übernachtet: "Um Ihnen genauere Informationen geben zu können, könnten Sie mir bitte mitteilen, in welchem Papillon Hotel Sie übernachten: Belvil, Zeugma oder Ayscha?" Andernfalls beantworten Sie die Fragen direkt. Ihre Antworten müssen immer auf DEUTSCH sein.`,
                    'ru': `Вы — AI-ассистент отелей Papillon. В сети Papillon 3 отеля: Belvil, Zeugma и Ayscha. Если гость задает вопрос, касающийся конкретного отеля (например, о номерах, ресторанах, мероприятиях), и не уточняет, о каком отеле идет речь, спросите его, в каком отеле он остановился: "Чтобы предоставить вам более точную информацию, не могли бы вы сообщить, в каком отеле Papillon вы остановились: Belvil, Zeugma или Ayscha?" В противном случае отвечайте на вопросы напрямую. Ваши ответы всегда должны быть на РУССКОМ языке.`
                };
                finalSystemPrompt = generalPrompts[detectedLanguage] || generalPrompts['tr'];
            }

            // Language-specific initial model responses can be simplified or removed
            const initialResponse = {
                'tr': "Anladım, dinliyorum.",
                'en': "Understood, I'm listening.",
                'de': "Verstanden, ich höre zu.",
                'ru': "Понял, я слушаю."
            };

            let conversationHistory = [
                {
                    role: "user",
                    parts: [{ text: finalSystemPrompt }]
                },
                {
                    role: "model", 
                    parts: [{ text: initialResponse[detectedLanguage] || initialResponse['tr'] }]
                }
            ];

            messages.forEach(message => {
                conversationHistory.push({
                    role: message.role === 'user' ? 'user' : 'model',
                    parts: [{ text: message.content }]
                });
            });

            const requestData = {
                contents: conversationHistory,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
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
                console.log(`✅ Gemini API Success: Response length ${aiResponse.length} chars`);
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

    // This method will now delegate to the NaturalLanguageService
    async detectLanguage(text, chatHistory = []) {
        // Use the more advanced detection method
        return await naturalLanguageService.detectLanguage(text);
    }

    // New AI-powered hotel detection
    async detectHotelWithAI(message, chatHistory = []) {
        try {
            const history = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
            const prompt = `You are an expert at identifying hotel names in a conversation. Your task is to find which of the three Papillon hotels is being discussed: "Belvil", "Zeugma", or "Ayscha".

The user might mention the hotel directly, even at the beginning of a sentence (e.g., "Ayscha, tell me about..."). Look for any mention of these names, even if it seems like the user is addressing an assistant.

Respond with only a single word: the hotel name ("Belvil", "Zeugma", or "Ayscha") or "None" if no hotel is mentioned.

Conversation:
${history}
user: ${message}

Hotel:`;

            const requestData = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 10,
                }
            };
            
            console.log('��� Asking Gemini to detect hotel...');
            const response = await axios.post(
                `${this.apiUrl}?key=${this.apiKey}`,
                requestData,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000 // 10 second timeout for this simple query
                }
            );

            if (response.data && response.data.candidates && response.data.candidates[0]) {
                const hotel = response.data.candidates[0].content.parts[0].text.trim().replace(/"/g, '');
                if (['Belvil', 'Zeugma', 'Ayscha'].includes(hotel)) {
                    console.log(`��� Gemini detected hotel: ${hotel}`);
                    return hotel;
                }
            }
            console.log('��� Gemini did not detect a specific hotel.');
            return null;

        } catch (error) {
            console.error('❌ AI Hotel Detection Error:', error.message);
            // Fallback to simple extraction if AI fails
            return this.extractHotelName(message, chatHistory); 
        }
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
            'en': ['where', 'how to get', 'distance', 'near', 'nearby', 'hospital', 'pharmacy', 'store', 'restaurant', 'atm'],
            'de': ['wo', 'wie komme ich', 'entfernung', 'nah', 'krankenhaus', 'apotheke', 'geschäft', 'restaurant'],
            'ru': ['где', 'как добраться', 'расстояние', 'близко', 'больница', 'аптека', 'магазин', 'ресторан']
        };

        const textLower = text.toLowerCase();
        
        for (const keywords of Object.values(locationKeywords)) {
            if (keywords.some(keyword => textLower.includes(keyword))) {
                return true;
            }
        }
        
        return false;
    }

    // Detect if a message is a location-based query using AI
    async detectLocationQuery(message, chatHistory = [], userLanguage = 'tr') {
        try {
            const conversationContext = chatHistory.length > 0 
                ? `Previous conversation:\n${chatHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\n`
                : '';

            const prompt = `${conversationContext}User message: "${message}"

Please analyze if this user message is asking about NEARBY LOCATIONS, PLACES, or DIRECTIONS.

A location query includes:
- Questions about nearby places (restaurants, hospitals, parks, etc.)
- Asking for directions or distances
- Seeking recommendations for places to visit
- Any request that would benefit from geographic information
- Questions about "where", "nearest", "closest", "around here", etc.

Examples of LOCATION queries:
- "Where is the nearest hospital?"
- "En yakın restoran nerede?"
- "Wo ist das nächste Krankenhaus?"
- "Где ближайшая аптека?"
- "Show me amusement parks nearby"
- "Places to visit in this area"
- "How do I get to the beach?"

Examples of NON-location queries:
- "What time is breakfast?"
- "How do I make a reservation?"
- "Tell me about the hotel facilities"
- "What activities does the hotel offer?"

Respond with ONLY: "YES" or "NO"`;

            const result = await this.generateResponse([{ role: 'user', content: prompt }], null, 'en');
            
            if (result.success) {
                const answer = result.response.trim().toUpperCase();
                const isLocationQuery = answer.includes('YES');
                
                console.log(`��� AI Location Detection: "${message}" → ${isLocationQuery ? 'YES' : 'NO'}`);
                return isLocationQuery;
            } else {
                console.warn('⚠️ AI location detection failed, falling back to keyword matching');
                return false;
            }
        } catch (error) {
            console.error('❌ AI location detection error:', error);
            return false;
        }
    }
}

module.exports = new GeminiService();
