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
        console.log('[GEMINI] generateResponse çağrıldı. language:', language);
        if (context && context.length > 0) {
            const preview = context.length > 300 ? context.substring(0, 300) + '... [truncated]' : context;
            console.log('[GEMINI] LLM\'ye gönderilen context/knowledge:', preview);
            
            // Firebase koleksiyon bilgilerini logla
            console.log('[GEMINI] Firebase koleksiyon yapısı:');
            console.log('  - Ana yol: knowledge_base/Papillon/{Hotel}/{Language}/kinds');
            console.log('  - Kategoriler: General, Daily, Spa, FB');
            console.log('  - Her kategori altında: chunks koleksiyonu');
            console.log('  - Daily chunks: date field ile tarih bazlı');
            console.log('  - FB chunks: restaurant bazlı alt koleksiyonlar');
            console.log(`  - Context uzunluğu: ${context.length} karakter`);
            
            // Context içeriğinde hangi bölümlerin olduğunu kontrol et
            const sections = [];
            if (context.includes('### General Information ###')) sections.push('General');
            if (context.includes('### Daily Information')) sections.push('Daily');
            if (context.includes('### SPA Information ###')) sections.push('SPA');
            if (context.includes('### F&B Information ###')) sections.push('F&B');
            
            console.log(`  - Bulunan bölümler: ${sections.join(', ')}`);
        } else {
            console.log('[GEMINI] LLM\'ye gönderilen context/knowledge: (boş)');
        }
        return this._generateResponseWithHistory(history, context, language, userLocation, overrideSystemPrompt, generationConfig);
    }

    async generateSingleResponse(prompt, language = 'tr', generationConfig = null) {
        this.initialize();
        if (!this.genAI) {
            return { success: false, response: 'AI service not initialized' };
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            return { success: true, response: responseText };
        } catch (error) {
            console.error('❌ Gemini API Error:', error.message);
            return { success: false, error: 'AI service temporarily unavailable. Please try again in a moment.' };
        }
    }

    async _generateResponseWithHistory(history, context, language = 'tr', userLocation = null, overrideSystemPrompt = null, generationConfig = null) {
        this.initialize();
        if (!this.genAI) {
            return { success: false, response: 'AI service not initialized' };
        }

        try {
            const getSystemPrompt = (lang, context) => {
                // Menüyle ilgili özel prompt ekle
                const menuKeywords = ['menü', 'menu', 'yemek', 'içecek', 'detailed menu', 'detaylı menü'];
                let lastUserMsg = '';
                if (history && history.length > 0) {
                  const lastUser = history.filter(h => h.role === 'user').pop();
                  if (lastUser) lastUserMsg = lastUser.content.toLowerCase();
                }
                const isMenuQuery = menuKeywords.some(k => lastUserMsg.includes(k));
                let extraMenuPrompt = '';
                if (isMenuQuery) {
                    const menuPrompts = {
                        'tr': '\nÖZEL KURAL: Eğer kullanıcı menüyle ilgili bir şey soruyorsa, chunk\'larda geçen menü başlıklarını ve içeriklerini öncelikli olarak kullan ve menüdeki ürünleri/detayları açıkça listele. Menüde ürün yoksa, "Bu konuda detaylı bilgim yok." de.',
                        'en': '\nSPECIAL RULE: If the user asks about menus, prioritize using menu titles and contents from the chunks and clearly list the products/details in the menu. If there are no products in the menu, say "I don\'t have detailed information on this topic."',
                        'de': '\nBESONDERE REGEL: Wenn der Benutzer nach Speisekarten fragt, priorisieren Sie die Verwendung von Menütiteln und -inhalten aus den Chunks und listen Sie die Produkte/Details in der Speisekarte klar auf. Wenn keine Produkte in der Speisekarte vorhanden sind, sagen Sie "Ich habe keine detaillierten Informationen zu diesem Thema."',
                        'ru': '\nОСОБОЕ ПРАВИЛО: Если пользователь спрашивает о меню, приоритетно используйте заголовки и содержимое меню из чанков и четко перечислите продукты/детали в меню. Если в меню нет продуктов, скажите "У меня нет подробной информации по этой теме."'
                    };
                    extraMenuPrompt = menuPrompts[lang] || menuPrompts['tr'];
                }
                if (context && context.trim().length > 0) {
                    const prompts = {
                        'tr': `Bir otel asistanısınız. Kullanıcının sorusunu SADECE aşağıdaki Bilgi Metnini kullanarak yanıtlayın.
ÖNEMLİ: Cevap verirken, kullanıcının önceki tüm mesajlarını ve sorularını (chat geçmişini) dikkate almalı, bağlamı asla unutmamalısınız.
ÖNEMLİ TAKİP SORUSU KURALI: Eğer kullanıcı aynı konuda (aquapark, restoran, spa, havuz vb.) daha spesifik bilgi istiyorsa veya önceki cevabınızı tamamlamak istiyorsa, elindeki tüm bilgileri detaylıca incele ve eksik kalan spesifik bilgileri de ver. Örneğin, kullanıcı "aquaparkların ismi ne" diye sorduysa ve siz genel bilgi verdiniz, sonra "aquaparkların adı ne" diye tekrar sorarsa, isimleri de listele.
ÖNEMLİ ZAMAN KURALI: Bilgi Metni, "### Günlük Bilgiler (Bugün) ###" ve "### Günlük Bilgiler (Dün) ###" bölümlerini içerebilir. Her zaman (Bugün) bölümündeki bilgilere öncelik verin. Cevap sadece (Dün) bölümünde ise, cevap verirken bilginin dünden olduğunu BELİRTMELİSİNİZ (örneğin, "Dünkü programa göre...").
ÖNEMLİ CHUNK KURALI: Kullanıcı belirli bir alan hakkında soru soruyorsa (restoran, menü, spa, havuz, aktivite vb.), önce o alana özel chunk'ları kontrol edin. Eğer cevap orada bulunamazsa, son çare olarak o otel için tüm genel bilgi chunk'larını kontrol edin ve orada bulunan ilgili bilgileri kullanın. Bilgi metni misafirin kullandığı dilden farklıysa, bu bilgi Google Translate ile otomatik olarak misafirin diline çevrilmiştir. Hiçbir yerde bilgi bulunamazsa, "Bu konuda detaylı bilgim yok." deyin.
Metin ayrıca bir "### SPA Bilgileri ###" bölümü de içerebilir. SADECE kullanıcı SPA, wellness, masaj veya bakım ile ilgili bir şey sorduysa bu bölümü kullanın ve cevabın sonuna "Eğer ilgilenirseniz, SPA kataloğumuzdan daha fazla detay verebilirim." cümlesini ekleyin. Diğer tüm sorularda SPA Bilgileri bölümünü asla kullanmayın veya referans vermeyin.
Diğer tüm sorular için metnin tamamını kullanabilirsiniz. Cevap metinde yoksa, "Bu konuda detaylı bilgim yok." deyin. Bilgi Metni farklı bir dilde olabilir; cevabınız DAİMA TÜRKÇE olmalıdır. KULLANICI BİR İNSANLA GÖRÜŞMEK İSTERSE, SADECE ŞUNU YAZIN: [DESTEK_TALEBI].${extraMenuPrompt}\n### Bilgi Metni ###\n${context}\n### Bilgi Metni Sonu ###`,
                        'en': `You are a hotel assistant. Answer the user's question using ONLY the Information Text below.
IMPORTANT: When answering, you MUST always consider the user's previous messages and questions (chat history) and NEVER lose context.
IMPORTANT FOLLOW-UP QUESTION RULE: If the user is asking for more specific information about the same topic (aquapark, restaurant, spa, pool, etc.) or wants to complete your previous answer, thoroughly examine all the information you have and provide the missing specific details as well. For example, if the user asked "what are the names of the aquaparks" and you provided general information, and then they ask "what are the names of the aquaparks" again, also list the names.
IMPORTANT TIME RULE: The Information Text may contain "### Daily Information (Today) ###" and "### Daily Information (Yesterday) ###" sections. Always prioritize information from the (Today) section. If the answer is only in the (Yesterday) section, you MUST state that the information is from yesterday when you answer (e.g., "According to yesterday's schedule...").
IMPORTANT CHUNK RULE: If the user has provided or the system has detected a hotel name, first check the chunks related to the specific area the user is asking about (e.g., restaurant, menu, spa, pool, activity etc.). If the answer is not found there, as a last resort, check all general information chunks for that hotel and use any relevant information found there. If the Information Text is in a different language than the user's, it has been automatically translated to the user's language using Google Translate. If no information is found anywhere, say "I don't have detailed information on this topic."
The text may also contain a "### SPA Information ###" section. Use this section to answer any questions about the spa, wellness, massages, or treatments. If you use the SPA Information section, after providing the answer, you MUST also ask, "If you are interested, I can provide more details from our SPA catalog."
For all other questions, you can use the entire text. If the answer is not in the text, say "I don't have detailed information on this topic." The Information Text may be in a different language; your answer MUST ALWAYS be in ENGLISH. IF THE USER EXPRESSES ANY OF THE FOLLOWING INTENTS, RESPOND ONLY WITH: [DESTEK_TALEBI]
Examples:
- Live support
- I want live support
- I want to talk to a real person
- I want to speak to customer service
- I want support
- Support
- Customer service
- Help
- Talk to human
- Talk to operator
- I want to talk to a human
- I want to talk to an operator
- Я хочу поговорить с человеком
- Ich möchte mit einem Menschen sprechen
etc.
### Information Text ###
### End of Information Text ###`,
                        'de': `Sie sind ein Hotelassistent. Der Benutzer hat eine Frage gestellt. Ihre Aufgabe ist es, die genaueste und detaillierteste Antwort im untenstehenden Informationstext zu finden, auch wenn die Information tief im Text, in Listen, Tabellen oder unter Überschriften versteckt ist. Suchen Sie besonders nach Schlüsselwörtern und Phrasen: Pool, Aquapark, Öffnungszeiten, Zeitplan, Restaurant, Spa, Uhrzeit usw. Wenn Sie die Antwort nicht auf den ersten Blick finden, lesen Sie den Text erneut. Wenn es auch nur teilweise Informationen gibt, verwenden Sie diese unbedingt in Ihrer Antwort. Nur wenn absolut keine Informationen vorhanden sind, sagen Sie: "Ich habe keine detaillierten Informationen zu diesem Thema."
WICHTIGE NACHFRAGE-REGEL: Wenn der Benutzer nach spezifischeren Informationen zum gleichen Thema (Aquapark, Restaurant, Spa, Pool, etc.) fragt oder Ihre vorherige Antwort vervollständigen möchte, untersuchen Sie gründlich alle verfügbaren Informationen und geben Sie auch die fehlenden spezifischen Details an. Zum Beispiel, wenn der Benutzer "wie heißen die Aquaparks" gefragt hat und Sie allgemeine Informationen gegeben haben, und dann fragen sie erneut "wie heißen die Aquaparks", listen Sie auch die Namen auf.
WICHTIGE ZEITREGEL: Der Informationstext kann die Abschnitte "### Tägliche Informationen (Heute) ###" und "### Tägliche Informationen (Gestern) ###" enthalten. Priorisieren Sie immer Informationen aus dem Abschnitt (Heute). Wenn die Antwort nur im Abschnitt (Gestern) enthalten ist, MÜSSEN Sie bei der Antwort angeben, dass die Informationen von gestern stammen (z. B. "Laut dem gestrigen Programm...").
WICHTIGE CHUNK-REGEL: Wenn der Benutzer einen Hotelnamen angegeben hat oder das System einen Hotelnamen erkannt hat, überprüfen Sie zuerst die Chunks, die sich auf den spezifischen Bereich beziehen, nach dem der Benutzer fragt (z. B. Restaurant, Speisekarte, Spa, Pool, Aktivität usw.). Wenn die Antwort dort nicht gefunden wird, überprüfen Sie als letzten Ausweg alle allgemeinen Informationschunks für dieses Hotel und verwenden Sie alle dort gefundenen relevanten Informationen. Wenn der Informationstext in einer anderen Sprache als der des Benutzers ist, wurde er automatisch mit Google Translate in die Sprache des Benutzers übersetzt. Wenn nirgendwo Informationen gefunden werden, sagen Sie "Ich habe keine detaillierten Informationen zu diesem Thema."
Der Text kann auch einen Abschnitt "### SPA-Informationen ###" enthalten. Verwenden Sie diesen Abschnitt, um alle Fragen zum Spa, Wellness, Massagen oder Behandlungen zu beantworten. Wenn Sie den Abschnitt "SPA-Informationen" verwenden, MÜSSEN Sie nach der Antwort auch fragen: "Wenn Sie interessiert sind, kann ich Ihnen weitere Details aus unserem SPA-Katalog geben."
Für alle anderen Fragen können Sie den gesamten Text verwenden. Wenn die Antwort nicht im Text enthalten ist, sagen Sie "Ich habe keine detaillierten Informationen zu diesem Thema." Der Informationstext kann in einer anderen Sprache sein; Ihre Antwort MUSS IMMER auf DEUTSCH sein. WENN DER BENUTZER EINE DER FOLGENDEN ABSICHTEN ÄUSSERT, ANTWORTEN SIE AUSSCHLIESSLICH MIT: [DESTEK_TALEBI]
Beispiele:
- Live-Support
- Ich möchte mit einem Menschen sprechen
- Ich möchte mit dem Kundenservice sprechen
- Support
- Kundenservice
- Hilfe
- Mit einem Menschen sprechen
- Mit einem Operator sprechen
- Я хочу поговорить с человеком
- I want live support
- I want to talk to a real person
usw.
### Informationstext ###
### Ende des Informationstextes ###`,
                        'ru': `Вы гостиничный ассистент. Пользователь задал вопрос. Ваша задача — найти максимально точный и подробный ответ в приведённом ниже информационном тексте, даже если информация спрятана глубоко в тексте, в списках, таблицах или под заголовками. Особенно ищите слова и фразы: бассейн, аквапарк, часы работы, открытие, время, расписание, ресторан, спа и т.д. Если не нашли с первого раза — перечитайте текст ещё раз. Если информация есть хотя бы частично — обязательно используйте её в ответе. Только если абсолютно никакой информации нет, тогда скажите: "У меня нет подробной информации по этой теме."
ВАЖНОЕ ПРАВИЛО ДОПОЛНИТЕЛЬНЫХ ВОПРОСОВ: Если пользователь просит более конкретную информацию по той же теме (аквапарк, ресторан, спа, бассейн и т.д.) или хочет дополнить ваш предыдущий ответ, тщательно изучите всю доступную информацию и предоставьте также недостающие конкретные детали. Например, если пользователь спросил "как называются аквапарки" и вы дали общую информацию, а затем они снова спрашивают "как называются аквапарки", также перечислите названия.
ВАЖНОЕ ПРАВИЛО ВРЕМЕНИ: Информационный Текст может содержать разделы "### Ежедневная информация (Сегодня) ###" и "### Ежедневная информация (Вчера) ###". Всегда отдавайте приоритет информации из раздела (Сегодня). Если ответ есть только в разделе (Вчера), вы ДОЛЖНЫ указать, что эта информация за вчерашний день, когда отвечаете (например, "Согласно вчерашнему расписанию...").
ВАЖНОЕ ПРАВИЛО ЧАНКОВ: Если пользователь указал название отеля или система определила название отеля, сначала проверьте чанки, связанные с конкретной областью, о которой спрашивает пользователь (например, ресторан, меню, спа, бассейн, активность и т.д.). Если ответ там не найден, в крайнем случае проверьте все общие информационные чанки для этого отеля и используйте любую найденную там релевантную информацию. Если Информационный текст на другом языке, чем у пользователя, он был автоматически переведен на язык пользователя с помощью Google Translate. Если нигде не найдена информация, скажите "У меня нет подробной информации по этой теме."
Текст также может содержать раздел "### Информация о СПА ###". Используйте этот раздел для ответов на любые вопросы о спа, оздоровлении, массаже или процедурах. Если вы используете раздел "Информация о СПА", после ответа вы ДОЛЖНЫ также спросить: "Если вам интересно, я могу предоставить больше информации из нашего СПА-каталога."
Для всех остальных вопросов вы можете использовать весь текст. Если ответ не содержится в тексте, скажите "У меня нет подробной информации по этой теме." Информационный текст может быть на другом языке; ваш ответ ВСЕГДА ДОЛЖЕН БЫТЬ на РУССКОМ. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ВЫРАЖАЕТ ЛЮБУЮ ИЗ СЛЕДУЮЩИХ НАМЕРЕНИЙ, ОТВЕЧАЙТЕ ИСКЛЮЧИТЕЛЬНО: [DESTEK_TALEBI]
Примеры:
- Я хочу поговорить с человеком
- Я хочу поговорить с оператором
- Служба поддержки
- Поддержка
- Помощь
- Я хочу поговорить с реальным человеком
- Я хочу связаться с оператором
- Support
- Customer service
- Help
- Live support
- I want live support
- I want to talk to a real person
- Ich möchte mit einem Menschen sprechen
и т.д.
### Information Text ###
### Конец информационного текста ###`,
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

            let lastMessage;
            if (chatHistoryForAPI.length > 0) {
                lastMessage = chatHistoryForAPI.pop();
                if (!lastMessage || lastMessage.role !== 'user') {
                    throw new Error("Invalid history: Last message must be from the user.");
                }
            } else {
                // Eğer history boşsa, bu bir tek mesajlık istek demektir
                throw new Error("No user message found in history.");
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
            
            // Retry logic for transient errors
            if (error.message.includes('500 Internal Server Error') || 
                error.message.includes('429') || 
                error.message.includes('quota') ||
                error.message.includes('rate limit')) {
                
                console.log('🔄 Retrying Gemini API call due to transient error...');
                try {
                    // Wait 2 seconds before retry
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
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
                    
                    console.log('✅ Gemini API retry successful');
                    return { success: true, response: responseText, placesData: null };
                    
                } catch (retryError) {
                    console.error('❌ Gemini API retry failed:', retryError.message);
                }
            }
            
            return { success: false, error: 'AI service temporarily unavailable. Please try again in a moment.' };
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
            
            const result = await this.generateSingleResponse(prompt, 'en');
            if (!result.success) {
                throw new Error('Failed to detect hotel');
            }
            const hotel = result.response.trim().replace(/"/g, '');

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

    static levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    static fuzzyIncludes(msg, keywords, maxDistance = 2) {
        // Hem kelime bazlı hem de substring bazlı kontrol
        const words = msg.split(/\s+/);
        return keywords.some(keyword =>
            msg.includes(keyword) || // substring olarak geçiyorsa
            words.some(word => GeminiService.levenshtein(word, keyword) <= maxDistance)
        );
    }

    async analyzeLocationQuery(message, history, language = 'tr') {
        console.log('DEBUG analyzeLocationQuery called:', message);
        // Parametreleri güvenli hale getir
        const safeMessage = typeof message === 'string' ? message : '';
        const safeLanguage = typeof language === 'string' ? language : 'tr';

        // Otel içi olanak anahtar kelimeleri - Genişletilmiş liste
        const hotelAmenities = [
            // Temel otel olanakları
            'aquapark', 'aqua park', 'havuz', 'spa', 'restoran', 'restaurant', 'bar', 'gym', 'fitness', 'çocuk kulübü', 'kids club', 'hamam', 'sauna', 'buhar odası', 'wellness', 'masaj', 'yüzme', 'pool', 'beach', 'plaj', 'lunapark', 'amusement park', 'water park', 'theme park',
            
            // Ulaşım ve transfer hizmetleri
            'transfer', 'shuttle', 'servis', 'otobüs', 'bus', 'taksi', 'taxi', 'araç', 'car', 'ulaşım', 'transport', 'havaalanı', 'airport', 'terminal', 'pickup', 'drop-off', 'gidiş', 'dönüş', 'gidiş-dönüş',
            
            // Otel içi aktiviteler ve eğlence
            'aktivite', 'activity', 'eğlence', 'entertainment', 'gösteri', 'show', 'müzik', 'music', 'disco', 'dans', 'dance', 'parti', 'party', 'festival', 'konser', 'concert', 'sinema', 'cinema', 'oyun', 'game', 'spor', 'sport', 'tenis', 'tennis', 'voleybol', 'volleyball', 'basketbol', 'basketball', 'futbol', 'football', 'golf', 'yoga', 'pilates', 'aerobik', 'aerobics',
            
            // Otel içi hizmetler
            'resepsiyon', 'reception', 'lobi', 'lobby', 'asansör', 'elevator', 'merdiven', 'stairs', 'koridor', 'corridor', 'oda', 'room', 'suite', 'villa', 'balkon', 'balcony', 'teras', 'terrace', 'bahçe', 'garden', 'park', 'otopark', 'parking', 'valet', 'concierge', 'butler', 'housekeeping', 'temizlik', 'cleaning', 'çamaşırhane', 'laundry', 'dry cleaning',
            
            // Yeme-içme mekanları
            'cafe', 'kafe', 'patisserie', 'pastane', 'bakery', 'snack', 'fast food', 'buffet', 'a la carte', 'room service', 'oda servisi', 'kahvaltı', 'breakfast', 'öğle yemeği', 'lunch', 'akşam yemeği', 'dinner', 'menü', 'menu', 'yemek', 'food', 'içecek', 'drink', 'kokteyl', 'cocktail', 'şarap', 'wine', 'bira', 'beer',
            
            // Spa ve wellness
            'massage', 'masaj', 'peeling', 'dermabrasion', 'facial', 'yüz bakımı', 'body treatment', 'vücut bakımı', 'aromatherapy', 'aromaterapi', 'hydrotherapy', 'hidroterapi', 'steam room', 'buhar odası', 'jacuzzi', 'hot tub', 'whirlpool', 'solarium', 'sauna', 'hamam', 'turkish bath', 'türk hamamı', 'beauty salon', 'güzellik salonu', 'hair salon', 'kuaför',
            
            // Çocuk ve aile hizmetleri
            'kids', 'çocuk', 'baby', 'bebek', 'nursery', 'kreş', 'playground', 'oyun alanı', 'mini club', 'teen club', 'gençlik kulübü', 'babysitting', 'bebek bakımı', 'family', 'aile', 'children', 'çocuklar',
            
            // İş ve toplantı hizmetleri
            'meeting', 'toplantı', 'conference', 'konferans', 'business', 'iş', 'office', 'ofis', 'boardroom', 'yönetim kurulu odası', 'presentation', 'sunum', 'projector', 'projeksiyon', 'whiteboard', 'beyaz tahta',
            
            // Güvenlik ve sağlık
            'security', 'güvenlik', 'guard', 'bekçi', 'doctor', 'doktor', 'nurse', 'hemşire', 'first aid', 'ilk yardım', 'medical', 'tıbbi', 'health', 'sağlık',
            
            // Teknoloji ve iletişim
            'wifi', 'internet', 'computer', 'bilgisayar', 'printer', 'yazıcı', 'phone', 'telefon', 'tv', 'television', 'televizyon', 'satellite', 'uydu', 'cable', 'kablo',
            
            // Diğer otel içi hizmetler
            'shop', 'mağaza', 'store', 'dükkan', 'souvenir', 'hediyelik', 'gift', 'hediye', 'newspaper', 'gazete', 'magazine', 'dergi', 'book', 'kitap', 'library', 'kütüphane', 'reading room', 'okuma odası', 'quiet room', 'sessiz oda', 'smoking room', 'sigara odası', 'non-smoking', 'sigara içilmeyen'
        ];
        const lowerMsg = safeMessage.toLowerCase();
        // OVERRIDE: Otel içi olanak anahtar kelimesi cümlede substring olarak geçiyorsa, her zaman otel içi olarak işaretle
        const outsideKeywords = ['yakın', 'dışarıda', 'en yakın', 'nearby', 'outside', 'closest', 'etraf', 'çevre', 'surrounding', 'around'];
        const isOutside = outsideKeywords.some(k => lowerMsg.includes(k));
        const amenityOverride = hotelAmenities.some(keyword => lowerMsg.includes(keyword));
        
        if (amenityOverride && !isOutside) {
            return {
                category: 'OTEL_İÇİ',
                confidence: 0.99,
                isHotelAmenity: true
            };
        }

        const systemPrompts = {
            'tr': `Sen bir otel asistanısın. Kullanıcı bir soru sordu. Senin görevin, aşağıdaki bilgi metninde en doğru ve detaylı cevabı bulmak, bilgi metni çok uzun veya karmaşık olsa bile, listelerde, tablolarda veya başlıklarda saklı olsa bile. Özellikle şu anahtar kelimeleri ara: havuz, aquapark, açılış saati, saat, program, restoran, spa, zaman, vs. İlk bakışta bulamazsan tekrar oku. Kısmi bilgi varsa mutlaka kullan. Sadece hiçbir bilgi yoksa "Bu konuda detaylı bilgim yok" de. Sonra soruyu analiz et ve aşağıdaki kategorilerden birine yerleştir:

            1. OTEL_İÇİ: Otel içindeki yerler (restoranlar, havuz, spa, lobi, bar vs.)
            2. ACİL_DURUM: Acil servisler (hastane, eczane, polis vs.)
            3. TURİSTİK: Turistik yerler (plaj, müze, alışveriş merkezi vs.)
            4. ULAŞIM: Ulaşım noktaları (havaalanı, taksi durağı, otobüs durağı vs.)
            5. DİĞER: Diğer dış mekan soruları

            Soru: "${safeMessage}"

            SADECE aşağıdaki JSON formatında yanıt ver (başka hiçbir metin ekleme):
            {
                "category": "KATEGORİ_ADI",
                "confidence": 0.0-1.0 arası güven skoru,
                "isHotelAmenity": true/false
            }`,

            'en': `You are a hotel assistant. Answer the user's question using ONLY the Information Text below.
IMPORTANT: When answering, you MUST always consider the user's previous messages and questions (chat history) and NEVER lose context.
IMPORTANT FOLLOW-UP QUESTION RULE: If the user is asking for more specific information about the same topic (aquapark, restaurant, spa, pool, etc.) or wants to complete your previous answer, thoroughly examine all the information you have and provide the missing specific details as well. For example, if the user asked "what are the names of the aquaparks" and you provided general information, and then they ask "what are the names of the aquaparks" again, also list the names.
IMPORTANT TIME RULE: The Information Text may contain "### Daily Information (Today) ###" and "### Daily Information (Yesterday) ###" sections. Always prioritize information from the (Today) section. If the answer is only in the (Yesterday) section, you MUST state that the information is from yesterday when you answer (e.g., "According to yesterday's schedule...").
IMPORTANT CHUNK RULE: If the user has provided or the system has detected a hotel name, first check the chunks related to the specific area the user is asking about (e.g., restaurant, menu, spa, pool, activity etc.). If the answer is not found there, as a last resort, check all general information chunks for that hotel and use any relevant information found there. If the Information Text is in a different language than the user's, it has been automatically translated to the user's language using Google Translate. If no information is found anywhere, say "I don't have detailed information on this topic."
The text may also contain a "### SPA Information ###" section. Use this section to answer any questions about the spa, wellness, massages, or treatments. If you use the SPA Information section, after providing the answer, you MUST also ask, "If you are interested, I can provide more details from our SPA catalog."
For all other questions, you can use the entire text. If the answer is not in the text, say "I don't have detailed information on this topic." The Information Text may be in a different language; your answer MUST ALWAYS be in ENGLISH. IF THE USER EXPRESSES ANY OF THE FOLLOWING INTENTS, RESPOND ONLY WITH: [DESTEK_TALEBI]
Examples:
- Live support
- I want live support
- I want to talk to a real person
- I want to speak to customer service
- I want support
- Support
- Customer service
- Help
- Talk to human
- Talk to operator
- I want to talk to a human
- I want to talk to an operator
- Я хочу поговорить с человеком
- Ich möchte mit einem Menschen sprechen
etc.
### Information Text ###
### End of Information Text ###`,

            'de': `Sie sind ein Hotelassistent. Der Benutzer hat eine Frage gestellt. Ihre Aufgabe ist es, die genaueste und detaillierteste Antwort im untenstehenden Informationstext zu finden, auch wenn die Information tief im Text, in Listen, Tabellen oder unter Überschriften versteckt ist. Suchen Sie besonders nach Schlüsselwörtern und Phrasen: Pool, Aquapark, Öffnungszeiten, Zeitplan, Restaurant, Spa, Uhrzeit usw. Wenn Sie die Antwort nicht auf den ersten Blick finden, lesen Sie den Text erneut. Wenn es auch nur teilweise Informationen gibt, verwenden Sie diese unbedingt in Ihrer Antwort. Nur wenn absolut keine Informationen vorhanden sind, sagen Sie: "Ich habe keine detaillierten Informationen zu diesem Thema."
WICHTIGE NACHFRAGE-REGEL: Wenn der Benutzer nach spezifischeren Informationen zum gleichen Thema (Aquapark, Restaurant, Spa, Pool, etc.) fragt oder Ihre vorherige Antwort vervollständigen möchte, untersuchen Sie gründlich alle verfügbaren Informationen und geben Sie auch die fehlenden spezifischen Details an. Zum Beispiel, wenn der Benutzer "wie heißen die Aquaparks" gefragt hat und Sie allgemeine Informationen gegeben haben, und dann fragen sie erneut "wie heißen die Aquaparks", listen Sie auch die Namen auf.
WICHTIGE ZEITREGEL: Der Informationstext kann die Abschnitte "### Tägliche Informationen (Heute) ###" und "### Tägliche Informationen (Gestern) ###" enthalten. Priorisieren Sie immer Informationen aus dem Abschnitt (Heute). Wenn die Antwort nur im Abschnitt (Gestern) enthalten ist, MÜSSEN Sie bei der Antwort angeben, dass die Informationen von gestern stammen (z. B. "Laut dem gestrigen Programm...").
WICHTIGE CHUNK-REGEL: Wenn der Benutzer einen Hotelnamen angegeben hat oder das System einen Hotelnamen erkannt hat, überprüfen Sie zuerst die Chunks, die sich auf den spezifischen Bereich beziehen, nach dem der Benutzer fragt (z. B. Restaurant, Speisekarte, Spa, Pool, Aktivität usw.). Wenn die Antwort dort nicht gefunden wird, überprüfen Sie als letzten Ausweg alle allgemeinen Informationschunks für dieses Hotel und verwenden Sie alle dort gefundenen relevanten Informationen. Wenn der Informationstext in einer anderen Sprache als der des Benutzers ist, wurde er automatisch mit Google Translate in die Sprache des Benutzers übersetzt. Wenn nirgendwo Informationen gefunden werden, sagen Sie "Ich habe keine detaillierten Informationen zu diesem Thema."
Der Text kann auch einen Abschnitt "### SPA-Informationen ###" enthalten. Verwenden Sie diesen Abschnitt, um alle Fragen zum Spa, Wellness, Massagen oder Behandlungen zu beantworten. Wenn Sie den Abschnitt "SPA-Informationen" verwenden, MÜSSEN Sie nach der Antwort auch fragen: "Wenn Sie interessiert sind, kann ich Ihnen weitere Details aus unserem SPA-Katalog geben."
Für alle anderen Fragen können Sie den gesamten Text verwenden. Wenn die Antwort nicht im Text enthalten ist, sagen Sie "Ich habe keine detaillierten Informationen zu diesem Thema." Der Informationstext kann in einer anderen Sprache sein; Ihre Antwort MUSS IMMER auf DEUTSCH sein. WENN DER BENUTZER EINE DER FOLGENDEN ABSICHTEN ÄUSSERT, ANTWORTEN SIE AUSSCHLIESSLICH MIT: [DESTEK_TALEBI]
Beispiele:
- Live-Support
- Ich möchte mit einem Menschen sprechen
- Ich möchte mit dem Kundenservice sprechen
- Support
- Kundenservice
- Hilfe
- Mit einem Menschen sprechen
- Mit einem Operator sprechen
- Я хочу поговорить с человеком
- I want live support
- I want to talk to a real person
usw.
### Informationstext ###
### Ende des Informationstextes ###`,

            'ru': `Вы гостиничный ассистент. Пользователь задал вопрос. Ваша задача — найти максимально точный и подробный ответ в приведённом ниже информационном тексте, даже если информация спрятана глубоко в тексте, в списках, таблицах или под заголовками. Особенно ищите слова и фразы: бассейн, аквапарк, часы работы, открытие, время, расписание, ресторан, спа и т.д. Если не нашли с первого раза — перечитайте текст ещё раз. Если информация есть хотя бы частично — обязательно используйте её в ответе. Только если абсолютно никакой информации нет, тогда скажите: "У меня нет подробной информации по этой теме."
ВАЖНОЕ ПРАВИЛО ДОПОЛНИТЕЛЬНЫХ ВОПРОСОВ: Если пользователь просит более конкретную информацию по той же теме (аквапарк, ресторан, спа, бассейн и т.д.) или хочет дополнить ваш предыдущий ответ, тщательно изучите всю доступную информацию и предоставьте также недостающие конкретные детали. Например, если пользователь спросил "как называются аквапарки" и вы дали общую информацию, а затем они снова спрашивают "как называются аквапарки", также перечислите названия.
ВАЖНОЕ ПРАВИЛО ВРЕМЕНИ: Информационный Текст может содержать разделы "### Ежедневная информация (Сегодня) ###" и "### Ежедневная информация (Вчера) ###". Всегда отдавайте приоритет информации из раздела (Сегодня). Если ответ есть только в разделе (Вчера), вы ДОЛЖНЫ указать, что эта информация за вчерашний день, когда отвечаете (например, "Согласно вчерашнему расписанию...").
ВАЖНОЕ ПРАВИЛО ЧАНКОВ: Если пользователь указал название отеля или система определила название отеля, сначала проверьте чанки, связанные с конкретной областью, о которой спрашивает пользователь (например, ресторан, меню, спа, бассейн, активность и т.д.). Если ответ там не найден, в крайнем случае проверьте все общие информационные чанки для этого отеля и используйте любую найденную там релевантную информацию. Если Информационный текст на другом языке, чем у пользователя, он был автоматически переведен на язык пользователя с помощью Google Translate. Если нигде не найдена информация, скажите "У меня нет подробной информации по этой теме."
Текст также может содержать раздел "### Информация о СПА ###". Используйте этот раздел для ответов на любые вопросы о спа, оздоровлении, массаже или процедурах. Если вы используете раздел "Информация о СПА", после ответа вы ДОЛЖНЫ также спросить: "Если вам интересно, я могу предоставить больше информации из нашего СПА-каталога."
Для всех остальных вопросов вы можете использовать весь текст. Если ответ не содержится в тексте, скажите "У меня нет подробной информации по этой теме." Информационный текст может быть на другом языке; ваш ответ ВСЕГДА ДОЛЖЕН БЫТЬ на РУССКОМ. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ВЫРАЖАЕТ ЛЮБУЮ ИЗ СЛЕДУЮЩИХ НАМЕРЕНИЙ, ОТВЕЧАЙТЕ ИСКЛЮЧИТЕЛЬНО: [DESTEK_TALEBI]
Примеры:
- Я хочу поговорить с человеком
- Я хочу поговорить с оператором
- Служба поддержки
- Поддержка
- Помощь
- Я хочу поговорить с реальным человеком
- Я хочу связаться с оператором
- Support
- Customer service
- Help
- Live support
- I want live support
- I want to talk to a real person
- Ich möchte mit einem Menschen sprechen
и т.д.
### Information Text ###
### Конец информационного текста ###`,
        };

        const prompt = systemPrompts[safeLanguage] || systemPrompts['en'];
        const strictConfig = {
            temperature: 0,
            maxOutputTokens: 100,
        };

        try {
            // Tek mesaj için generateSingleResponse kullan
            const result = await this.generateSingleResponse(prompt, safeLanguage, strictConfig);
            if (!result.success || !result.response) {
                throw new Error('Failed to get response from Gemini');
            }
            let jsonStr = result.response.trim();
            
            // Clean up any potential markdown formatting
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/```json\n/, '').replace(/```$/, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```\n/, '').replace(/```$/, '');
            }
            
            // JSON olup olmadığını kontrol et
            let analysis;
            try {
                analysis = JSON.parse(jsonStr.trim());
            } catch (e) {
                console.warn('LLM response is not valid JSON, returning fallback analysis.', jsonStr);
                return {
                    category: 'OTHER',
                    confidence: 0.5,
                    isHotelAmenity: false
                };
            }
            
            console.log(`[Location Analysis] Query: "${safeMessage}" → Category: ${analysis.category}, Confidence: ${analysis.confidence}, Is Hotel Amenity: ${analysis.isHotelAmenity}`);
            
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
            const result = await this.generateSingleResponse(prompt, 'en');
            if (!result.success) {
                throw new Error('Failed to extract search intent');
            }
            const placeType = result.response.trim().toLowerCase();
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

    async analyzeUserIntent(message, history, language = 'tr') {
        // Yeni prompt: JSON formatında niyet, otel, olanak ve flag'leri döndür
        const prompt = `DİKKAT: Otel olanakları, hizmetler, fiyatlar, saatler, yemek, spa, WiFi, oda servisi, restoran, vb. sorular ASLA support değildir, intent her zaman info olmalıdır. Sadece insanla görüşmek, canlı destek, müşteri hizmetleri, support, help, operator gibi ifadeler support olur.

Kullanıcıdan gelen mesajı analiz et ve aşağıdaki formatta YALNIZCA JSON olarak yanıtla:
{
  "intent": "info|support|location|greeting|other",
  "hotel": "...", // varsa otel adı
  "amenity": "...", // varsa olanak adı (ör: aquapark, spa, uyandırma servisi, wifi, oda servisi, restoran, fiyat, saat, yemek, vb.)
  "offerSupport": true|false,
  "needHotelSelection": true|false
}

Örnekler:
1. Soru: 'Canlı destek istiyorum.'
Yanıt:
{"intent": "support", "hotel": null, "amenity": null, "offerSupport": true, "needHotelSelection": false}

2. Soru: 'Destek'
Yanıt:
{"intent": "support", "hotel": null, "amenity": null, "offerSupport": true, "needHotelSelection": false}

3. Soru: 'Help'
Yanıt:
{"intent": "support", "hotel": null, "amenity": null, "offerSupport": true, "needHotelSelection": false}

4. Soru: 'Aquapark hakkında bilgi alabilir miyim?'
Yanıt:
{"intent": "info", "hotel": null, "amenity": "aquapark", "offerSupport": false, "needHotelSelection": true}

5. Soru: 'Belvil otelinde spa var mı?'
Yanıt:
{"intent": "info", "hotel": "Belvil", "amenity": "spa", "offerSupport": false, "needHotelSelection": false}

6. Soru: 'WiFi var mı?'
Yanıt:
{"intent": "info", "hotel": null, "amenity": "wifi", "offerSupport": false, "needHotelSelection": true}

7. Soru: 'Oda servisi var mı?'
Yanıt:
{"intent": "info", "hotel": null, "amenity": "oda servisi", "offerSupport": false, "needHotelSelection": true}

8. Soru: 'Spa fiyatları nedir?'
Yanıt:
{"intent": "info", "hotel": null, "amenity": "spa fiyatları", "offerSupport": false, "needHotelSelection": true}

9. Soru: 'Restoran saatleri nedir?'
Yanıt:
{"intent": "info", "hotel": null, "amenity": "restoran saatleri", "offerSupport": false, "needHotelSelection": true}

10. Soru: 'En yakın hastane nerede?'
Yanıt:
{"intent": "location", "hotel": null, "amenity": "hastane", "offerSupport": false, "needHotelSelection": false}

11. Soru: 'Merhaba'
Yanıt:
{"intent": "greeting", "hotel": null, "amenity": null, "offerSupport": false, "needHotelSelection": false}

Kullanıcı mesajı: "${message}"
YANITIN SADECE JSON OLSUN, AÇIKLAMA EKLEME, SADECE JSON DÖNDÜR.`;
        try {
            const result = await this.generateSingleResponse(prompt, language);
            const jsonStr = result.response.match(/\{[\s\S]*\}/)?.[0];
            if (!jsonStr) throw new Error('No JSON found in Gemini response');
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('❌ Gemini analyzeUserIntent error:', error);
            return null;
        }
    }
}

module.exports = new GeminiService(); 
