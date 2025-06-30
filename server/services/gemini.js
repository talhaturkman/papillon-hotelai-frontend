const axios = require('axios');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
        
        console.log(`🤖 Gemini API initialized: ${this.model} (TEXT-ONLY MODE)`);
        if (!this.apiKey) {
            console.error('❌ GEMINI_API_KEY not found in environment variables');
        } else {
            console.log(`🔑 API Key loaded: ${this.apiKey.substring(0, 10)}...`);
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

Answer guests' questions naturally. Only ask about hotel when hotel-specific information is needed. ALL RESPONSES MUST BE IN ENGLISH.`,

                'de': `Sie sind der KI-Assistent für Papillon Hotels. Papillon Hotels hat 3 Häuser: Belvil, Zeugma und Ayscha.

WICHTIG: ANTWORTEN SIE NUR AUF DEUTSCH!

HOTEL-IDENTIFIKATION UND INFORMATIONSAUSTAUSCH:
- Bei ALLGEMEINEN Fragen (Begrüßungen, wie geht es dir, Danke usw.) direkt antworten, nicht nach Hotel fragen
- Bei PERSÖNLICHEN/ALLGEMEINEN Fragen (Personal-Erkennung, allgemeine Unterhaltung) direkt antworten, nicht nach Hotel fragen
- Bei HOTEL-SPEZIFISCHEN Fragen (Zimmer, Restaurants, Aktivitäten, Spa, Pools usw.) UND wenn kein Hotel angegeben ist, dann fragen: "Um Ihnen genaue Informationen zu geben, in welchem Papillon Hotel wohnen Sie? Belvil, Zeugma oder Ayscha?"
- Falls Hotel-Kontext bereits verfügbar ist, direkt Informationen geben

ANTWORTREGELN:
- Formatieren Sie Ihre Antworten sauber und lesbar
- Machen Sie wichtige Informationen **fett**
- Verwenden Sie ### für Überschriften
- Verwenden Sie - für Listen
- Verwenden Sie 1. 2. 3. für nummerierte Listen
- Kategorisieren Sie komplexe Informationen
- Geben Sie prägnante und klare Antworten

STANDORTINFORMATIONEN:
- Bei standortbezogenen Fragen schlagen Sie Orte in der Nähe des Hotels vor
- Teilen Sie Details wie Entfernung, Adresse, Öffnungszeiten mit
- Geben Sie Gästen Wegbeschreibungen und Transportvorschläge
- Heben Sie beliebte und zuverlässige Orte hervor

Beantworten Sie die Fragen der Gäste natürlich. Fragen Sie nur nach dem Hotel, wenn hotel-spezifische Informationen benötigt werden. ALLE ANTWORTEN MÜSSEN AUF DEUTSCH SEIN.`,

                'ru': `Вы - ИИ-ассистент отелей Papillon. У Papillon Hotels есть 3 отеля: Belvil, Zeugma и Ayscha.

ВАЖНО: ОТВЕЧАЙТЕ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ!

ОПРЕДЕЛЕНИЕ ОТЕЛЯ И ОБМЕН ИНФОРМАЦИЕЙ:
- Если вопрос ОБЩИЙ (приветствия, как дела, спасибо и т.д.) отвечайте напрямую, не спрашивайте об отеле
- Если вопрос ЛИЧНЫЙ/ОБЩИЙ (узнавание персонала, общий чат) отвечайте напрямую, не спрашивайте об отеле
- Если вопрос СПЕЦИФИЧЕН ДЛЯ ОТЕЛЯ (номера, рестораны, активности, спа, бассейны и т.д.) И отель не указан, тогда спросите: "Чтобы предоставить вам точную информацию, в каком отеле Papillon вы остановились? Belvil, Zeugma или Ayscha?"
- Если контекст отеля уже доступен, предоставьте информацию напрямую

ПРАВИЛА ОТВЕТОВ:
- Форматируйте ваши ответы четко и читабельно
- Делайте важную информацию **жирной**
- Используйте ### для заголовков
- Используйте - для списков
- Используйте 1. 2. 3. для нумерованных списков
- Категоризируйте сложную информацию
- Давайте краткие и ясные ответы

ИНФОРМАЦИЯ О МЕСТОПОЛОЖЕНИИ:
- Для вопросов о местоположении предлагайте места рядом с отелем
- Делитесь деталями как расстояние, адрес, часы работы
- Предоставляйте гостям направления и советы по транспорту
- Выделяйте популярные и надежные места

Отвечайте на вопросы гостей естественно. Спрашивайте об отеле только когда нужна специфичная для отеля информация. ВСЕ ОТВЕТЫ ДОЛЖНЫ БЫТЬ НА РУССКОМ ЯЗЫКЕ.`
            };

            let systemPrompt = systemPrompts[detectedLanguage] || systemPrompts['tr'];
            
            console.log(`🌐 Using ${detectedLanguage} system prompt for Gemini`);
            
            // Add knowledge context if available (language-specific)
            if (knowledgeContext && knowledgeContext.trim().length > 0) {
                const knowledgeInstructions = {
                    'tr': `\n\nAşağıdaki bilgileri kullanarak sorulara detaylı yanıt ver:\n\n${knowledgeContext}`,
                    'en': `\n\nUse the following information to provide detailed answers to questions:\n\n${knowledgeContext}`,
                    'de': `\n\nVerwenden Sie die folgenden Informationen, um detaillierte Antworten auf Fragen zu geben:\n\n${knowledgeContext}`,
                    'ru': `\n\nИспользуйте следующую информацию для предоставления подробных ответов на вопросы:\n\n${knowledgeContext}`
                };
                systemPrompt += knowledgeInstructions[detectedLanguage] || knowledgeInstructions['tr'];
            }

            // Language-specific initial responses
            const initialResponses = {
                'tr': "Anladım! Papillon Hotels asistanı olarak yardımcı olmaya hazırım.",
                'en': "Understood! I'm ready to help as your Papillon Hotels assistant.",
                'de': "Verstanden! Ich bin bereit, als Ihr Papillon Hotels-Assistent zu helfen.",
                'ru': "Понятно! Я готов помочь как ваш помощник Papillon Hotels."
            };

            let conversationHistory = [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }]
                },
                {
                    role: "model", 
                    parts: [{ text: initialResponses[detectedLanguage] || initialResponses['tr'] }]
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
                },
                responseMimeType: "text/plain",
                responseModality: ["TEXT"]
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

    // Detect language from user message
    detectLanguage(text) {
        const patterns = {
            'tr': /[çğıöşüÇĞIİÖŞÜ]|[Bb]ir|[Dd]e|[Vv]e|[İi]ç[İi]n|[Hh]akkında|[Nn]erede/,
            'en': /\b(the|and|for|are|with|have|this|will|you|that|but|not|what|all|were|they|we)\b/i,
            'de': /\b(und|der|die|das|ist|ein|eine|für|mit|auf|ich|sie|es|wir|ihr)\b/i,
            'ru': /[а-яё]|[А-ЯЁ]/
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
                
                console.log(`🧠 AI Location Detection: "${message}" → ${isLocationQuery ? 'YES' : 'NO'}`);
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