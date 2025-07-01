const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { getKnowledge, getHotel, getSpaCatalog } = require('./firebase');
const { searchPlaces, getPlaceDetails, getPlacePhotoUrl } = require('./places');
const { LanguageServiceClient } = require('@google-cloud/language');
const translationService = require('./translation');

const languageClient = new LanguageServiceClient();
const supportedLanguages = ['tr', 'en', 'de', 'ru'];

async function detectLanguage(text, history) {
    // 1. Check for language in history first for "stickiness"
    if (history && history.length > 0) {
        const lastAiMessage = history.filter(m => m.role === 'assistant' || m.role === 'model').pop();
        if (lastAiMessage && lastAiMessage.content) {
            const langMatch = lastAiMessage.content.match(/\p{L}{4,}/gu);
            if (langMatch) {
                try {
                    const [detections] = await languageClient.detectLanguage(langMatch[0]);
                    if (detections && detections.languages && detections.languages.length > 0) {
                        const lastLang = detections.languages[0].languageCode;
                        if (supportedLanguages.includes(lastLang)) {
                            console.log(`Sticking to language from history: ${lastLang}`);
                            return lastLang;
                        }
                    }
                } catch (error) {
                    console.error('Could not detect language from history, proceeding with new detection.');
                }
            }
        }
    }

    // 2. If no history, detect from the new message
    try {
        const [detections] = await languageClient.detectLanguage(text);
        if (detections && detections.languages && detections.languages.length > 0) {
            const detectedLang = detections.languages[0].languageCode;
            if (supportedLanguages.includes(detectedLang)) {
                console.log(`Language detected from message: ${detectedLang}`);
                return detectedLang;
            }
        }
    } catch (error) {
        console.error('Error in Google language detection, falling back to default:', error);
    }
    
    // 3. Default to Turkish
    console.log('Falling back to default language: tr');
    return 'tr';
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class GeminiService {
    constructor() {
        this.model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
        });
    }

    async generateResponse(message, history, lang, hotel, knowledge) {
        const getSystemPrompt = (lang, hotel, knowledge) => {
            const getBasePrompt = () => {
                const generalPrompts = {
                    'tr': `Sen Papillon Hotels'in yapay zeka asistanısın. Papillon Hotels'un 3 oteli var: Belvil, Zeugma ve Ayscha. Eğer kullanıcı otel-spesifik bir soru sorarsa ve hangi otelden bahsettiğini belirtmezse, ona hangi otelde konakladığını sor. ÖNEMLİ: Eğer otel aktiviteleri, saatleri veya restoran detayları gibi spesifik bilgiler istenirse ve sana bu bilgiyi içeren bir Bilgi Metni verilmediyse, bu bilgiye sahip olmadığını belirtmelisin. Cevap uydurma. KULLANICI BİR İNSAN İLE GÖRÜŞMEK İSTERSE, SADECE ŞUNU YAZ: [DESTEK_TALEBI].`,
                    'en': `You are the AI assistant for Papillon Hotels. Papillon Hotels has 3 properties: Belvil, Zeugma and Ayscha. If the user asks a hotel-specific question and does not specify which hotel, ask them. IMPORTANT: If asked for specific details like hotel activities, hours, or restaurant details, and you have not been provided an Information Text with that answer, you MUST state you do not have that information. Do not invent answers. IF THE USER WANTS TO SPEAK TO A HUMAN, RESPOND ONLY WITH: [DESTEK_TALEBI].`,
                    'de': `Sie sind der KI-Assistent für Papillon Hotels. Papillon Hotels hat 3 Häuser: Belvil, Zeugma und Ayscha. Wenn der Gast eine hotelspezifische Frage stellt und nicht angibt, von welchem Hotel er spricht, fragen Sie ihn. WICHTIG: Wenn nach spezifischen Details wie Hotelaktivitäten, Öffnungszeiten oder Restaurantdetails gefragt wird und Ihnen kein Informationstext mit der Antwort zur Verfügung gestellt wurde, MÜSSEN Sie angeben, dass Sie diese Informationen nicht haben. Erfinden Sie keine Antworten. WENN DER BENUTZER MIT EINEM MENSCHEN SPRECHEN MÖCHTE, ANTWORTEN SIE AUSSCHLIESSLICH MIT: [DESTEK_TALEBI].`,
                    'ru': `Вы — AI-ассистент отелей Papillon. В сети Papillon 3 отеля: Belvil, Zeugma и Ayscha. Если гость задает вопрос, касающийся конкретного отеля, и не уточняет, о каком отеле идет речь, спросите его. ВАЖНО: Если вас спрашивают о конкретных деталях, таких как мероприятия в отеле, часы работы или детали ресторана, и вам не был предоставлен Информационный Текст с этим ответом, вы ДОЛЖНЫ заявить, что у вас нет этой информации. Не выдумывайте ответы. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ХОЧЕТ ПОГОВОРИТЬ С ЧЕЛОВЕКОМ, ОТВЕЧАЙТЕ ТОЛЬКО: [DESTEK_TALEBI].`
                };
                return generalPrompts[lang] || generalPrompts['tr'];
            };

            let prompt = getBasePrompt();
            if (hotel) {
                prompt += ` Kullanıcı şu anda ${hotel} otelindedir veya bu otelle ilgilenmektedir.`;
            }
            if (knowledge) {
                const knowledgeData = JSON.parse(knowledge);
                if (knowledgeData.general) {
                    prompt += `\n\n### Genel Bilgi Metni:\n${knowledgeData.general}\n\n`;
                }
                if (knowledgeData.daily) {
                    prompt += `\n\n### Günlük Bilgi Metni (${knowledgeData.daily.sourceDate}):\n${knowledgeData.daily.content}\n\n`;
                }
                 if (knowledgeData.spa) {
                    prompt += `\n\n### SPA Katalog Bilgisi:\n${knowledgeData.spa}\n\n`;
                }
                prompt += `\nKullanıcının sorusunu yanıtlarken yukarıdaki metinleri kullan.`;
            }
            return prompt;
        };
        
        const systemInstruction = {
            role: "system",
            content: getSystemPrompt(lang, hotel, knowledge)
        };

        const contents = [
            ...history.map(h => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }]
            })),
            { role: "user", parts: [{ text: message }] }
        ];

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        try {
            const chatSession = this.model.startChat({
                systemInstruction,
                history: contents.slice(0, -1), // History is everything except the last user message
                safetySettings
            });

            const result = await chatSession.sendMessage(message);
            return result.response.text();
        } catch (error) {
            console.error('Error generating response from Gemini:', error);
            const fallbackPrompts = {
                tr: "Üzgünüm, bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
                en: "I'm sorry, an error occurred. Please try again later.",
                de: "Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
                ru: "Извините, произошла ошибка. Пожалуйста, попробуйте позже."
            };
            return fallbackPrompts[lang] || fallbackPrompts.tr;
        }
    }
}

async function isSpaQuery(message, history, lang) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const spaKeywords = {
        'tr': ['spa', 'masaj', 'hamam', 'sauna', 'bakım', 'terapi', 'güzellik'],
        'en': ['spa', 'massage', 'hammam', 'sauna', 'treatment', 'therapy', 'beauty'],
        'de': ['spa', 'massage', 'hamam', 'sauna', 'behandlung', 'therapie', 'schönheit'],
        'ru': ['спа', 'массаж', 'хаммам', 'сауна', 'уход', 'терапия', 'красота']
    };

    const keywords = spaKeywords[lang] || spaKeywords['en'];
    const lowerCaseMessage = message.toLowerCase();

    if (keywords.some(keyword => lowerCaseMessage.includes(keyword))) {
        console.log("Found SPA keyword, classifying as SPA query.");
        return true;
    }
    
    // If no keyword, use AI for a more nuanced check
    const prompt = `Is the following user message asking about SPA, wellness, massage, or beauty treatments? Answer only with "yes" or "no".\n\nMessage: "${message}"`;
    
    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim().toLowerCase();
        console.log(`SPA query check (AI): "${message}" -> ${responseText}`);
        return responseText.includes('yes');
    } catch (error) {
        console.error("Error in isSpaQuery check:", error);
        return false; // Default to false on error
    }
}

module.exports = {
    GeminiService,
    detectLanguage,
    isSpaQuery
};
