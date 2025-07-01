const { GoogleGenerativeAI } = require("@google/generative-ai");
const placeService = require('./places');
const translationService = require('./translation');

class GeminiService {
    constructor() {
        this.genAI = null;
        this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
        this.apiKey = process.env.GEMINI_API_KEY;
        this.googleApi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

    async isLocationQueryAI(message, history, language = 'tr') {
        const translations = {
            'en': `You are a location detection specialist. Your only job is to determine if the user is asking for a location, address, or directions. Respond with only "yes" or "no". Do not say anything else.`,
            'de': `Sie sind ein Spezialist für die Standorterkennung. Ihre einzige Aufgabe ist es festzustellen, ob der Benutzer nach einem Ort, einer Adresse oder einer Wegbeschreibung fragt. Antworten Sie nur mit "ja" oder "nein". Sagen Sie nichts anderes.`,
            'ru': `Вы специалист по определению местоположения. Ваша единственная задача - определить, запрашивает ли пользователь местоположение, адрес или маршрут. Ответьте только "да" или "нет". Больше ничего не говорите.`,
            'tr': `Sen bir konum tespit uzmanısın. Tek görevin kullanıcının bir yer, adres veya yol tarifi isteyip istemediğini belirlemek. Sadece "evet" veya "hayır" ile cevap ver. Başka hiçbir şey söyleme.`
        };
        const systemPrompt = translations[language] || translations['en'];
        const strictConfig = {
            temperature: 0,
            maxOutputTokens: 2,
        };

        try {
            const result = await this.generateResponse(history, null, language, null, systemPrompt, strictConfig);
            const decision = result.response.trim().toLowerCase();
            console.log(`[AI Location Detection] Raw AI decision: "${decision}" for message: "${message}"`);
            return decision.includes('evet') || decision.includes('yes');
        } catch (error) {
            console.error('Error in AI location detection:', error);
            return false; // Default to false on error
        }
    }
}

module.exports = new GeminiService(); 
