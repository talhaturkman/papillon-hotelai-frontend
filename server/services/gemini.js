const { GoogleGenerativeAI } = require("@google/generative-ai");
const placeService = require('./places');
const translationService = require('./translation');

class GeminiService {
    constructor() {
        this.genAI = null;
        this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
        this.apiKey = process.env.GEMINI_API_KEY;
        this.googleApi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Keywords in different languages
        this.keywords = {
            hospital: ['hastane', 'hospital', 'krankenhaus', 'больница'],
            pharmacy: ['eczane', 'pharmacy', 'apotheke', 'аптека'],
            beach: ['plaj', 'beach', 'strand', 'пляж'],
            museum: ['müze', 'museum', 'museum', 'музей'],
            taxi: ['taksi', 'taxi', 'taxi', 'такси'],
            airport: ['havaalanı', 'airport', 'flughafen', 'аэропорт'],
            amusement_park: ['lunapark', 'amusement park', 'theme park', 'vergnügungspark', 'парк развлечений'],
            aquarium: ['akvaryum', 'aquarium', 'aquarium', 'аквариум'],
            zoo: ['hayvanat bahçesi', 'zoo', 'tiergarten', 'зоопарк'],
            shopping_mall: ['avm', 'alışveriş merkezi', 'shopping mall', 'shopping center', 'einkaufszentrum', 'торговый центр'],
            restaurant: ['restoran', 'restaurant', 'restaurant', 'ресторан'],
            cafe: ['kafe', 'cafe', 'café', 'кафе'],
            bar: ['bar', 'bar', 'bar', 'бар']
        };

        // Google Places types mapping
        this.placeTypes = {
            'amusement_park': 'amusement_park',
            'aquarium': 'aquarium',
            'zoo': 'zoo',
            'shopping_mall': 'shopping_mall',
            'restaurant': 'restaurant',
            'cafe': 'cafe',
            'bar': 'bar',
            'beach': 'natural_feature',
            'museum': 'museum',
            'hospital': 'hospital',
            'pharmacy': 'pharmacy',
            'taxi': 'taxi_stand',
            'airport': 'airport'
        };
    }
        
    initialize() {
        if (!this.apiKey) {
            console.error('❌ GEMINI_API_KEY not found in environment variables. Gemini service is disabled.');
            return;
        }
        if (this.genAI) return;

        try {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            console.log(`✅ Gemini AI SDK initialized successfully for model: ${this.model}`);
        } catch (error) {
            console.error('❌ Failed to initialize GoogleGenerativeAI:', error);
            this.genAI = null;
        }
    }

    async generateResponse(history, context, language = 'tr', userLocation = null, overrideSystemPrompt = null, generationConfig = null) {
        this.initialize();
        if (!this.genAI) {
            return { success: false, response: 'AI service not initialized' };
        }

        try {
            const getSystemPrompt = (lang, context) => {
                if (context && context.trim().length > 0) {
                    const prompts = {
                        'tr': `Sen bir otel asistanısın. Kullanıcının sorusunu SADECE ve SADECE aşağıdaki Bilgi Metni'ni kullanarak yanıtla.
ÖNEMLİ ZAMAN KURALI: Bilgi Metni "### Daily Information (Today) ###" ve "### Daily Information (Yesterday) ###" bölümleri içerebilir. Her zaman "(Today)" bölümündeki bilgilere öncelik ver. Eğer cevap sadece "(Yesterday)" bölümünde varsa, cevabı verirken bu bilginin dünkü olduğunu MUTLAKA belirt (örn: "Dünkü programa göre...").
Diğer tüm sorular için metnin tamamını kullanabilirsin. Cevap metinde yoksa, "Bu konuda detaylı bilgim bulunmuyor." de. Bilgi Metni farklı bir dilde olabilir, yanıtı oluştururken mutlaka TÜRKÇE'ye çevir. KULLANICI BİR İNSAN İLE GÖRÜŞMEK İSTERSE, SADECE ŞUNU YAZ: [DESTEK_TALEBI]. ### Bilgi Metni ###\n${context}\n### Bilgi Metni Sonu ###`,
                        'en': `You are a hotel assistant. Answer the user's question using ONLY the Information Text below.
IMPORTANT TIME RULE: The Information Text may contain "### Daily Information (Today) ###" and "### Daily Information (Yesterday) ###" sections. Always prioritize information from the (Today) section. If the answer is only in the (Yesterday) section, you MUST state that the information is from yesterday when you answer (e.g., "According to yesterday's schedule...").
The text may also contain a "### SPA Information ###" section. Use this section to answer any questions about the spa, wellness, massages, or treatments. If you use the SPA Information section, after providing the answer, you MUST also ask, "If you are interested, I can provide more details from our SPA catalog."
For all other questions, you can use the entire text. If the answer is not in the text, say "I don't have detailed information on this topic." The Information Text may be in a different language; you must translate it to ENGLISH. IF THE USER WANTS TO SPEAK TO A HUMAN, RESPOND ONLY WITH: [DESTEK_TALEBI]. ### Information Text ###
${context}
### End of Information Text ###`,
                        'de': `Sie sind ein Hotelassistent. Beantworten Sie die Frage des Benutzers NUR mit dem unten stehenden Informationstext.
WICHTIGE ZEITREGEL: Der Informationstext kann die Abschnitte "### Tägliche Informationen (Heute) ###" und "### Tägliche Informationen (Gestern) ###" enthalten. Priorisieren Sie immer Informationen aus dem Abschnitt (Heute). Wenn die Antwort nur im Abschnitt (Gestern) enthalten ist, MÜSSEN Sie bei der Antwort angeben, dass die Informationen von gestern stammen (z. B. "Laut dem gestrigen Programm...").
Der Text kann auch einen Abschnitt "### SPA-Informationen ###" enthalten. Verwenden Sie diesen Abschnitt, um alle Fragen zum Spa, Wellness, Massagen oder Behandlungen zu beantworten. Wenn Sie den Abschnitt "SPA-Informationen" verwenden, MÜSSEN Sie nach der Antwort auch fragen: "Wenn Sie interessiert sind, kann ich Ihnen weitere Details aus unserem SPA-Katalog geben."
Für alle anderen Fragen können Sie den gesamten Text verwenden. Wenn die Antwort nicht im Text enthalten ist, sagen Sie "Ich habe keine detaillierten Informationen zu diesem Thema." Der Informationstext kann in einer anderen Sprache sein; Ihre Antwort MUSS IMMER auf DEUTSCH sein. WENN DER BENUTZER MIT EINEM MENSCHEN SPRECHEN MÖCHTE, ANTWORTEN SIE AUSSCHLIESSLICH MIT: [DESTEK_TALEBI]. ### Informationstext ###
${context}
### Ende des Informationstextes ###`,
                        'ru': `Вы гостиничный ассистент. Отвечайте на вопрос пользователя, используя ТОЛЬКО приведенный ниже Информационный Текст.
ВАЖНОЕ ПРАВИЛО ВРЕМЕНИ: Информационный Текст может содержать разделы "### Ежедневная информация (Сегодня) ###" и "### Ежедневная информация (Вчера) ###". Всегда отдавайте приоритет информации из раздела (Сегодня). Если ответ есть только в разделе (Вчера), вы ДОЛЖНЫ указать, что эта информация за вчерашний день, когда отвечаете (например, "Согласно вчерашнему расписанию...").
Текст также может содержать раздел "### Информация о СПА ###". Используйте этот раздел для ответов на любые вопросы о спа, оздоровлении, массаже или процедурах. Если вы используете раздел "Информация о СПА", после ответа вы ДОЛЖНЫ также спросить: "Если вам интересно, я могу предоставить больше информации из нашего СПА-каталога."
Для всех остальных вопросов вы можете использовать весь текст. Если ответ не содержится в тексте, скажите "У меня нет подробной информации по этой теме." Информационный текст может быть на другом языке; ваш ответ ВСЕГДА ДОЛЖЕН БЫТЬ на РУССКОМ. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ХОЧЕТ ПОГОВОРИТЬ С ЧЕЛОВЕКОМ, ОТВЕЧАЙТЕ ИСКЛЮЧИТЕЛЬНО: [DESTEK_TALEBI]. ### Информационный текст ###
${context}
### Конец информационного текста ###`,
                        'tr': `Bir otel asistanısınız. Kullanıcının sorusunu SADECE aşağıdaki Bilgi Metnini kullanarak yanıtlayın.
ÖNEMLİ ZAMAN KURALI: Bilgi Metni, "### Günlük Bilgiler (Bugün) ###" ve "### Günlük Bilgiler (Dün) ###" bölümlerini içerebilir. Her zaman (Bugün) bölümündeki bilgilere öncelik verin. Cevap sadece (Dün) bölümünde ise, cevap verirken bilginin dünden olduğunu BELİRTMELİSİNİZ (örneğin, "Dünkü programa göre...").
Metin ayrıca bir "### SPA Bilgileri ###" bölümü de içerebilir. Spa, wellness, masajlar veya bakımlar hakkındaki tüm soruları yanıtlamak için bu bölümü kullanın. "SPA Bilgileri" bölümünü kullanırsanız, cevabı verdikten sonra MUTLAKA "Eğer ilgilenirseniz, SPA kataloğumuzdan daha fazla detay verebilirim." diye sormalısınız.
Diğer tüm sorular için metnin tamamını kullanabilirsiniz. Cevap metinde yoksa, "Bu konuda detaylı bilgim yok." deyin. Bilgi Metni farklı bir dilde olabilir; cevabınız DAİMA TÜRKÇE olmalıdır. KULLANICI BİR İNSANLA GÖRÜŞMEK İSTERSE, SADECE ŞUNU YAZIN: [DESTEK_TALEBI]. ### Bilgi Metni ###
${context}
### Bilgi Metni Sonu ###`,
                    };
                    return prompts[lang] || prompts['tr'];
                }
                const generalPrompts = {
                    'tr': `Sen Papillon Hotels'in yapay zeka asistanısın. Papillon Hotels'un 3 oteli var: Belvil, Zeugma ve Ayscha. Eğer kullanıcı otel-spesifik bir soru sorarsa ve hangi otelden bahsettiğini belirtmezse, ona hangi otelde konakladığını sor. ÖNEMLİ: Eğer otel aktiviteleri, saatleri veya restoran detayları gibi spesifik bilgiler istenirse ve sana bu bilgiyi içeren bir Bilgi Metni verilmediyse, bu bilgiye sahip olmadığını belirtmelisin. Cevap uydurma. KULLANICI BİR İNSAN İLE GÖRÜŞMEK İSTERSE, SADECE ŞUNU YAZ: [DESTEK_TALEBI].`,
                    'en': `You are the AI assistant for Papillon Hotels. Papillon Hotels has 3 properties: Belvil, Zeugma and Ayscha. If the user asks a hotel-specific question and does not specify which hotel, ask them. IMPORTANT: If asked for specific details like hotel activities, hours, or restaurant details, and you have not been provided an Information Text with that answer, you MUST state you do not have that information. Do not invent answers. IF THE USER WANTS TO SPEAK TO A HUMAN, RESPOND ONLY WITH: [DESTEK_TALEBI].`,
                    'de': `Sie sind der KI-Assistent für Papillon Hotels. Papillon Hotels hat 3 Häuser: Belvil, Zeugma und Ayscha. Wenn der Gast eine hotelspezifische Frage stellt und nicht angibt, von welchem Hotel er spricht, fragen Sie ihn. WICHTIG: Wenn nach spezifischen Details wie Hotelaktivitäten, Öffnungszeiten oder Restaurantdetails gefragt wird und Ihnen kein Informationstext mit der Antwort zur Verfügung gestellt wurde, MÜSSEN Sie angeben, dass Sie diese Informationen nicht haben. Erfinden Sie keine Antworten. WENN DER BENUTZER MIT EINEM MENSCHEN SPRECHEN MÖCHTE, ANTWORTEN SIE AUSSCHLIESSLICH MIT: [DESTEK_TALEBI].`,
                    'ru': `Вы — AI-ассистент отелей Papillon. В сети Papillon 3 отеля: Belvil, Zeugma и Ayscha. Если гость задает вопрос, касающийся конкретного отеля, и не уточняет, о каком отеле идет речь, спросите его. ВАЖНО: Если вас спрашивают о конкретных деталях, таких как мероприятия в отеле, часы работы или детали ресторана, и вам не был предоставлен Информационный Текст с этим ответом, вы ДОЛЖНЫ заявить, что у вас нет этой информации. Не выдумывайте ответы. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ХОЧЕТ ПОГОВОРИТЬ С ЧЕЛОВЕКОМ, ОТВЕЧАЙТЕ ТОЛЬКО: [DESTEK_TALEBI].`
                };
                return generalPrompts[lang] || generalPrompts['tr'];
            };

            const model = this.genAI.getGenerativeModel({ model: this.model });
            
            const chatHistoryForAPI = history.map(h => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }]
            }));

            const lastMessage = chatHistoryForAPI.pop();
            if (!lastMessage || lastMessage.role !== 'user') {
                throw new Error("Invalid history: Last message must be from the user.");
            }

            const chat = model.startChat({
                history: chatHistoryForAPI,
                generationConfig: generationConfig || {
                    temperature: 0.7,
                    maxOutputTokens: 1000,
                },
                systemInstruction: {
                    parts: [{ text: overrideSystemPrompt || getSystemPrompt(language, context) }]
                },
            });
            
            const result = await chat.sendMessage(lastMessage.parts[0].text);
            const responseText = result.response.text();

            let placesData = null;
            if (responseText.includes('[YER_BUL]')) {
                 if (!userLocation) {
                    responseText = "Konumunuzu bulmam için izin vermeniz gerekiyor. İzni verdikten sonra tekrar deneyebilirsiniz.";
                } else {
                    placesData = await placeService.findNearbyPlaces(lastMessage.parts[0].text, userLocation);
                    if (placesData && placesData.length > 0) {
                        const followUpPrompt = `Kullanıcı yakındaki yerleri sordu ve ben de şunları buldum: ${JSON.stringify(placesData)}. Bu bilgiyi kullanarak kullanıcıya doğal bir dilde cevap ver. Cevabın ${language} dilinde olmalı. [YER_BUL] etiketini kullanma.`;
                        const followUpResult = await chat.sendMessage(followUpPrompt);
                        responseText = followUpResult.response.text();
                    } else {
                         const followUpPrompt = `Kullanıcı yakındaki yerleri sordu ama bir sonuç bulamadım. Kullanıcıya aradığı kriterlere uygun bir yer bulamadığını söyle. Cevabın ${language} dilinde olmalı.`;
                        const followUpResult = await chat.sendMessage(followUpPrompt);
                        responseText = followUpResult.response.text();
                    }
                }
            }

            return { success: true, response: responseText, placesData };

        } catch (error) {
            console.error('❌ Gemini API Error:', error.message);
            return { success: false, error: 'AI service temporarily unavailable.' };
        }
    }

    async detectLanguage(message, history) {
        // First, attempt to detect the language of the current message
        const currentDetection = await translationService.detectLanguage(message);
        console.log(`[Language Detection] Current message ('${message}') detected as: ${currentDetection.language} with confidence ${currentDetection.confidence}`);

        const supportedLangs = ['tr', 'en', 'de', 'ru'];

        // If detection is confident and for a supported language, use it.
        // Confidence threshold is set to 0.5, short words have low confidence.
        if (supportedLangs.includes(currentDetection.language) && currentDetection.confidence > 0.5) {
            console.log(`[Language Detection] Using current detection: ${currentDetection.language}`);
            return currentDetection.language;
        }

        console.log(`[Language Detection] Current detection is unsupported or has low confidence. Checking history.`);

        // If not, iterate backwards through history to find the last user message with a supported language
        if (history && history.length > 0) {
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].role === 'user') {
                    const pastMessage = history[i].content;
                    const pastDetection = await translationService.detectLanguage(pastMessage);
                    if (supportedLangs.includes(pastDetection.language)) {
                        console.log(`[Language Detection] Found last supported language in history: ${pastDetection.language}. Reverting to it.`);
                        return pastDetection.language;
                    }
                }
            }
        }

        // If no supported language is found in history, default to Turkish
        console.log(`[Language Detection] No supported language found in history. Defaulting to 'tr'.`);
        return 'tr';
    }

    async detectHotelWithAI(message, history) {
        this.initialize();
        if (!this.genAI) return this.extractHotelName(message); 

        try {
            const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
            const prompt = `Analyze the following conversation and identify which of the three Papillon hotels is being discussed: "Belvil", "Zeugma", or "Ayscha". Respond with only the hotel name. If no specific hotel is mentioned, respond with "None".\n\nConversation:\n${historyText}\nuser: ${message}\n\nHotel:`;
            
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const result = await model.generateContent(prompt);
            const hotel = result.response.text().trim().replace(/"/g, '');

            if (['Belvil', 'Zeugma', 'Ayscha'].includes(hotel)) {
                console.log(`✅ Gemini detected hotel: ${hotel}`);
                return hotel;
            }
            return null;

        } catch (error) {
            console.error('❌ AI Hotel Detection Error, falling back to regex:', error.message);
            return this.extractHotelName(message);
        }
    }

    extractHotelName(text) {
        if (text.toLowerCase().includes('belvil')) return 'Belvil';
        if (text.toLowerCase().includes('zeugma')) return 'Zeugma';
        if (text.toLowerCase().includes('ayscha')) return 'Ayscha';
        return null;
    }

    async analyzeLocationQuery(message, history, language = 'tr') {
        const systemPrompts = {
            'tr': `Sen bir otel asistanısın ve konum sorularını analiz ediyorsun. Soruyu analiz et ve şu kategorilerden birine yerleştir:

            1. OTEL_İÇİ: Otel içindeki yerler (restoranlar, havuz, spa, lobi, bar vs.)
            2. ACİL_DURUM: Acil servisler (hastane, eczane, polis vs.)
            3. TURİSTİK: Turistik yerler (plaj, müze, alışveriş merkezi vs.)
            4. ULAŞIM: Ulaşım noktaları (havaalanı, taksi durağı, otobüs durağı vs.)
            5. DİĞER: Diğer dış mekan soruları

            Soru: "${message}"

            SADECE aşağıdaki JSON formatında yanıt ver (başka hiçbir metin ekleme):
            {
                "category": "KATEGORİ_ADI",
                "confidence": 0.0-1.0 arası güven skoru,
                "isHotelAmenity": true/false
            }`,

            'en': `You are a hotel assistant analyzing location questions. Analyze the question and categorize it into one of these categories:

            1. HOTEL_INTERNAL: Places inside hotel (restaurants, pool, spa, lobby, bar etc.)
            2. EMERGENCY: Emergency services (hospital, pharmacy, police etc.)
            3. TOURIST: Tourist spots (beach, museum, shopping mall etc.)
            4. TRANSPORT: Transportation points (airport, taxi stand, bus stop etc.)
            5. OTHER: Other external location questions

            Question: "${message}"

            Respond ONLY with the following JSON format (do not add any other text):
            {
                "category": "CATEGORY_NAME",
                "confidence": confidence score between 0.0-1.0,
                "isHotelAmenity": true/false
            }`
        };

        const prompt = systemPrompts[language] || systemPrompts['en'];
        const strictConfig = {
            temperature: 0,
            maxOutputTokens: 100,
        };

        try {
            const result = await this.generateResponse(history, null, language, null, prompt, strictConfig);
            let jsonStr = result.response.trim();
            
            // Clean up any potential markdown formatting
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/```json\n/, '').replace(/```$/, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```\n/, '').replace(/```$/, '');
            }
            
            const analysis = JSON.parse(jsonStr.trim());
            
            console.log(`[Location Analysis] Query: "${message}" → Category: ${analysis.category}, Confidence: ${analysis.confidence}, Is Hotel Amenity: ${analysis.isHotelAmenity}`);
            
            return analysis;
        } catch (error) {
            console.error('Error in location query analysis:', error);
            return {
                category: 'OTHER',
                confidence: 0.5,
                isHotelAmenity: false
            };
        }
    }

    async extractSearchIntent(query, language) {
        const prompt = `Analyze this location query and determine what type of place the user is looking for.
Query: "${query}"

Return ONLY ONE of these exact place types that best matches the query intent:
- amusement_park (for theme parks, fun parks, entertainment centers)
- aquarium
- zoo
- shopping_mall (for malls, shopping centers)
- restaurant
- cafe
- bar
- beach
- museum
- hospital
- pharmacy
- taxi
- airport
- tourist_attraction (default for general tourist spots)
- point_of_interest (default if none of the above match)

Response:`;

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const result = await model.generateContent(prompt);
            const placeType = result.response.text().trim().toLowerCase();
            console.log(`🎯 Gemini extracted search intent: ${placeType}`);
            return placeType;
        } catch (error) {
            console.error('❌ Error extracting search intent:', error);
            return 'point_of_interest';
        }
    }

    getSearchTerm(query, category, language) {
        const lowerQuery = query.toLowerCase();
        
        // First try to extract intent using keywords
        for (const [key, translations] of Object.entries(this.keywords)) {
            if (translations.some(k => lowerQuery.includes(k))) {
                return this.placeTypes[key] || key;
            }
        }

        // If no keyword match, use category-based defaults
        switch (category) {
            case 'ACİL_DURUM':
                return 'hospital';  // default for emergency
            case 'TURİSTİK':
                return 'tourist_attraction';
            case 'ULAŞIM':
                return 'transit_station';
            default:
                return 'point_of_interest';
        }
    }

    async generateLocationResponse(query, analysis, userLocation, hotelContext, language = 'tr') {
        const placeService = require('./places');
        
        if (analysis.isHotelAmenity) {
            // For hotel amenities, use the knowledge base
            const firebaseService = require('./firebase');
            const knowledge = await firebaseService.searchKnowledge(hotelContext, language);
            
            if (knowledge.success) {
                const prompt = `You are a hotel assistant. Using ONLY the following hotel information, answer where the guest can find "${query}". If the information is not in the text, say you don't have that specific information.

                Hotel Information:
                ${knowledge.content}

                Question: Where is ${query}?`;

                const result = await this.generateResponse([], prompt, language);
                return result;
            }
        }

        // For external locations
        const priorityConfig = {
            'EMERGENCY': { radius: 5000, limit: 3 },
            'TOURIST': { radius: 15000, limit: 5 },
            'TRANSPORT': { radius: 10000, limit: 3 },
            'OTHER': { radius: 10000, limit: 5 }
        };

        // First try keyword-based search
        let searchTerm = this.getSearchTerm(query, analysis.category, language);
        
        // If no specific match found, use Gemini to extract intent
        if (searchTerm === 'point_of_interest' || searchTerm === 'tourist_attraction') {
            searchTerm = await this.extractSearchIntent(query, language);
        }
        
        console.log(`🔍 Search term for "${query}" (${language}): ${searchTerm}`);

        const config = priorityConfig[analysis.category] || priorityConfig.OTHER;
        const hotelLocation = placeService.getHotelLocation(hotelContext);
        
        try {
            const places = await placeService.searchNearbyPlaces(searchTerm, hotelLocation, config.radius, language);
            console.log('📍 Found places:', places);
            
            // If no results found with specific type, fallback to tourist_attraction
            if ((!places || places.length === 0) && searchTerm !== 'tourist_attraction') {
                console.log('⚠️ No results found, falling back to tourist_attraction');
                const fallbackPlaces = await placeService.searchNearbyPlaces('tourist_attraction', hotelLocation, config.radius, language);
                if (fallbackPlaces && fallbackPlaces.length > 0) {
                    places = fallbackPlaces;
                }
            }
            
            const formattedPlaces = placeService.formatPlacesForAI(places, hotelLocation, language);
            console.log('📍 Formatted places:', formattedPlaces);

            // Create the map data structure expected by the frontend
            const mapData = {
                list: formattedPlaces.list || [],
                searchQuery: searchTerm,
                searchLocation: {
                    lat: hotelLocation.lat,
                    lng: hotelLocation.lng,
                    address: hotelLocation.address
                }
            };

            return {
                success: true,
                response: formattedPlaces.text,
                placesData: mapData
            };
        } catch (error) {
            console.error('❌ Error getting places:', error);
            const errorMessages = {
                'tr': 'Üzgünüm, yakındaki yerleri ararken bir hata oluştu.',
                'en': 'Sorry, an error occurred while searching for nearby places.',
                'de': 'Entschuldigung, bei der Suche nach Orten in der Nähe ist ein Fehler aufgetreten.',
                'ru': 'Извините, произошла ошибка при поиске мест поблизости.'
            };
            return {
                success: true,
                response: errorMessages[language] || errorMessages['en'],
                placesData: null
            };
        }
    }

    // Replace old isLocationQueryAI with enhanced version
    async isLocationQueryAI(message, history, language = 'tr') {
        const analysis = await this.analyzeLocationQuery(message, history, language);
        return !analysis.isHotelAmenity && analysis.confidence > 0.6;
    }

    async isHotelFacilityQuery(message, history, language = 'tr') {
        const prompt = `You are helping to determine if a user's question is about hotel facilities or about external locations.

Question: "${message}"

Is this question asking about facilities, services, or locations WITHIN the hotel (like restaurants, pools, spa, etc.) rather than external places?

Consider:
1. If they mention "hotel", "restaurant", "facility", or similar words
2. If they're asking about opening hours, locations, or services within the hotel
3. Context from previous messages if any

Please respond with just "true" if it's about hotel facilities, or "false" if it's about external locations.`;

        try {
            const response = await this.model.generateContent(prompt);
            const result = response.response.text().toLowerCase().includes('true');
            console.log(`🏨 Hotel facility check for "${message}" → ${result}`);
            return result;
        } catch (error) {
            console.error('❌ Hotel facility check error:', error);
            return false;
        }
    }
}

module.exports = new GeminiService(); 
