const geminiService = require('./gemini');
const firebaseService = require('./firebase');
const translationService = require('./translation');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

let questionCache = null;
let lastCacheTime = null;
const cacheValidityPeriod = 2 * 60 * 1000; // 2 minutes - daha hızlı güncelleme için

// Cache invalidation için event emitter
const EventEmitter = require('events');
const analyticsEvents = new EventEmitter();

// Top Questions için gerçek zamanlı cache
let topQuestionsCache = [];
let topQuestionsLastUpdate = null;

// Yeni soru geldiğinde cache'i temizle
function invalidateCacheOnNewQuestion() {
    console.log('🔄 Cache invalidated due to new question');
    questionCache = null;
    lastCacheTime = null;
    // Event emit et
    analyticsEvents.emit('cacheInvalidated');
}

// Cache durumunu kontrol et
function shouldInvalidateCache() {
    // Cache yoksa veya süresi geçmişse
    if (!questionCache || (Date.now() - lastCacheTime) >= cacheValidityPeriod) {
        return true;
    }
    
    // Yeni soru geldiğinde cache'i temizle
    return false;
}

async function isQuestion(text, language) {
    if (!text) {
        console.log('❌ Empty text');
        return false;
    }

    let textForGemini = text;
    let detectedLang = language;

    // Detect language if not provided
    if (!detectedLang) {
        const detection = await translationService.detectLanguage(text);
        detectedLang = detection.language;
        console.log(`[isQuestion] Detected language: ${detectedLang}`);
    }

    console.log(`[isQuestion] Original: "${text}"`);
    // Translate if not English
    if (detectedLang !== 'en') {
        try {
            const translation = await translationService.translateText(text, 'en');
            textForGemini = translation;
            console.log(`[isQuestion] Translated to English: "${textForGemini}"`);
        } catch (err) {
            console.error('❌ Translation failed:', err);
        }
    }

    // First, check if it's just a hotel name
    const hotelNames = ['belvil', 'zeugma', 'ayscha'];
    const textLower = textForGemini.toLowerCase().trim();
    
    // If it's just a hotel name or hotel name + "otelde", it's not a question
    if (hotelNames.some(hotel => 
        textLower === hotel || 
        textLower === `${hotel} otelde` ||
        textLower === `${hotel} otel` ||
        textLower === `${hotel} hotel`
    )) {
        console.log(`❌ Skipping hotel name: "${textForGemini}"`);
        return false;
    }

    // Gemini prompt
    const prompt = `Analyze if this text is a genuine question or inquiry that needs a response. Consider the context and intent carefully.

Text: "${textForGemini}"

Rules:
1. Return "true" ONLY if the text is a genuine question or inquiry that needs a response
2. Return "false" for:
   - Simple greetings (hello, hi, etc.)
   - Single words or hotel names (belvil, zeugma, ayscha)
   - Hotel names with "otel/hotel/otelde" suffix
   - Statements or exclamations
   - Thank you messages
   - Goodbyes
   - Location names without a question
   - Any text that doesn't seek information or require a response

Important: Return ONLY "true" or "false", no other text or formatting.`;

    try {
        console.log(`[isQuestion] Text sent to Gemini: "${textForGemini}"`);
        // Tek mesaj için özel fonksiyon kullan
        const result = await geminiService.generateSingleResponse(prompt, 'en');
        console.log(`[isQuestion] Gemini raw response:`, result.response);
        if (!result.success) throw new Error(result.error || 'Failed to get AI response');
        const cleanResponse = result.response.trim().toLowerCase();
        const isQuestion = cleanResponse.includes('true') || cleanResponse.includes('yes') || cleanResponse.includes('question');
        console.log(`[isQuestion] Final decision for "${textForGemini}": ${isQuestion}`);
        return isQuestion;
    } catch (error) {
        console.error('❌ AI Question Detection failed:', error);
        // Enhanced fallback detection
        const text_lower = textForGemini.toLowerCase().trim();
        
        // Filter out common non-questions
        const greetings = ['merhaba', 'hello', 'hi', 'hallo', 'привет', 'selam'];
        const thanks = ['thank', 'thanks', 'teşekkür', 'danke', 'спасибо'];
        const goodbyes = ['goodbye', 'bye', 'güle güle', 'auf wiedersehen', 'до свидания'];
        const hotels = ['belvil', 'zeugma', 'ayscha'];
        
        // Check for standalone hotel names or hotel + otel/hotel/otelde
        if (hotels.some(h => text_lower === h || text_lower === `${h} otel` || text_lower === `${h} hotel` || text_lower === `${h} otelde`)) {
            return false;
        }
        
        // Filter out simple greetings (only if they're short)
        if (greetings.some(g => text_lower.includes(g)) && text_lower.split(' ').length < 3) {
            return false;
        }
        
        // Filter out thanks and goodbyes
        if (thanks.some(t => text_lower.includes(t)) || goodbyes.some(g => text_lower.includes(g))) {
            return false;
        }
        
        // Check for question indicators
        const hasQuestionMark = textForGemini.includes('?');
        const hasQuestionWord = text_lower.includes('mi') || 
                              text_lower.includes('mu') || 
                              text_lower.includes('mı') || 
                              text_lower.includes('ne') ||
                              text_lower.includes('nasıl') ||
                              text_lower.includes('nerede') ||
                              text_lower.includes('hangi') ||
                              text_lower.includes('kim') ||
                              text_lower.includes('neden');
        
        // Must have either a question mark or a question word
        return hasQuestionMark || hasQuestionWord;
    }
}

async function categorizeQuestion(text) {
    const prompt = `Analyze the following question/inquiry and categorize it. Consider the intent, context, and any mentioned facilities or services.

Text: "${text}"

Return a JSON object with these properties:
- category: one of: location, time, availability, transport, price, facility, general, entertainment
- facility: one of: bathroom, shop, restaurant, pool, beach, spa, gym, entertainment, medical, transport, or null if not about a specific facility
- intent: brief description of the user's intent

Important: Return ONLY the JSON object, no markdown formatting or code blocks. Do not use 'facility' for hotel names (Belvil, Zeugma, Ayscha).`;

    try {
        // Tek mesaj için özel fonksiyon kullan
        const result = await geminiService.generateSingleResponse(prompt, 'en');
        if (!result.success) throw new Error(result.error || 'Failed to get AI response');
        
        // Clean the response of any markdown formatting
        const cleanJson = result.response
            .replace(/```json\n?/g, '')  // Remove ```json
            .replace(/```\n?/g, '')      // Remove closing ```
            .trim();                     // Remove extra whitespace
        
        try {
            const parsed = JSON.parse(cleanJson);
            console.log(`🤖 AI Categorization for "${text}":`, parsed);
            return parsed;
        } catch (jsonError) {
            console.error('❌ Failed to parse JSON response:', cleanJson);
            throw jsonError;
        }
    } catch (error) {
        console.error('❌ AI Categorization failed:', error);
        // Return default categorization if AI fails
        return { category: 'general', facility: null, intent: null };
    }
}

async function analyzeQuestions(forceRefresh = false) {
    try {
        console.log(`🔍 Analyzing questions (force refresh: ${forceRefresh})`);
        
        // Get the latest question count and updates
        let recentQuestions, recentUpdates;
        try {
            recentQuestions = await firebaseService.getRecentQuestions(5);
            recentUpdates = await firebaseService.getRecentHotelUpdates(5);
            console.log(`📊 Recent questions: ${recentQuestions?.size || 0}, Recent hotel updates: ${recentUpdates?.size || 0}`);
        } catch (error) {
            console.error('❌ Error getting recent data:', error);
            recentQuestions = { size: 0 };
            recentUpdates = { size: 0 };
        }

        // Check cache and invalidate if there are new questions or updates
        if (!forceRefresh && questionCache && (Date.now() - lastCacheTime) < cacheValidityPeriod) {
            if (recentQuestions.size > 0 || recentUpdates.size > 0) {
                console.log('🔄 New activity detected, invalidating cache...');
                forceRefresh = true;
            } else {
                console.log('📦 Using cached analytics results');
                return questionCache;
            }
        }

        // Cache invalidation kontrolü
        if (shouldInvalidateCache()) {
            console.log('🔄 Cache invalidated, generating fresh analytics...');
            forceRefresh = true;
        }

        console.log('🔄 Generating fresh analytics...');

        // Get all questions from Firebase - SADECE GERÇEK SORULAR
        let loggedQuestions;
        try {
            loggedQuestions = await firebaseService.getAllQuestions(2000);
            console.log(`📥 Retrieved ${loggedQuestions.length} questions from Firebase`);
        } catch (error) {
            console.error('❌ Error getting questions from Firebase:', error);
            throw error;
        }
        
        if (!loggedQuestions || !Array.isArray(loggedQuestions)) {
            console.error('❌ Invalid questions data:', loggedQuestions);
            throw new Error('Invalid questions data from Firebase');
        }

        // SADECE GERÇEK SORULARI FİLTRELE (isQuestion: true)
        const realQuestions = loggedQuestions.filter(q => q.isQuestion === true);
        console.log(`✅ Filtered ${realQuestions.length} real questions out of ${loggedQuestions.length} total`);

        if (realQuestions.length === 0) {
            console.log('📭 No real questions found, returning empty result');
            return { success: true, questions: [], lastUpdated: new Date().toISOString() };
        }

        // Process questions - artık sadece gerçek soruları işle
        const processedQuestions = [];
        for (const q of realQuestions) {
            try {
                // Skip invalid questions
                if (!q.message || !q.message.trim()) {
                    console.log('⚠️ Skipping empty question');
                    continue;
                }

                // Use pre-processed categorization if available
                const questionData = {
                    ...q,
                    message: q.message || q.text || '', // Ensure message exists
                    detectedHotel: q.detectedHotel || q.hotel || 'Unknown',
                    language: q.detectedLanguage || q.language || 'unknown',
                    timestamp: q.createdAt || q.timestamp || new Date().toISOString(),
                    category: q.category || 'general',
                    facility: q.facility || null
                };

                // Eğer categorization yoksa, şimdi yap
                if (!q.categorization && q.preprocessed) {
                    try {
                        console.log(`🔄 Re-categorizing question: "${q.message}"`);
                        const categorization = await categorizeQuestion(q.message);
                        questionData.categorization = categorization;
                        questionData.category = categorization.category;
                        questionData.facility = categorization.facility;
                        
                        // Update the question in Firebase with categorization
                        await firebaseService.updateQuestionAnalytics(q.id, {
                            categorization,
                            category: categorization.category,
                            facility: categorization.facility
                        });
                    } catch (error) {
                        console.error('❌ Error re-categorizing question:', error);
                        // Varsayılan değerlerle devam et
                    }
                } else if (q.categorization) {
                    questionData.categorization = q.categorization;
                }

                processedQuestions.push(questionData);
            } catch (error) {
                console.error('❌ Error processing question:', error);
                continue;
            }
        }

        console.log(`✅ Processed ${processedQuestions.length} valid real questions`);
        if (processedQuestions.length === 0) {
            return { success: true, questions: [], lastUpdated: new Date().toISOString() };
        }

        // Group similar questions using pre-processed categorizations
        let groupedQuestions;
        try {
            groupedQuestions = await groupSimilarQuestions(processedQuestions);
            console.log(`✅ Grouped into ${groupedQuestions.length} question groups`);
        } catch (error) {
            console.error('❌ Error grouping questions:', error);
            throw error;
        }

        // Cache the results
        questionCache = {
            success: true,
            questions: groupedQuestions,
            lastUpdated: new Date().toISOString()
        };
        lastCacheTime = Date.now();

        return questionCache;

    } catch (error) {
        console.error('❌ Error analyzing questions:', error);
        return { success: false, error: error.message };
    }
}

// NLP tabanlı ön gruplama fonksiyonu
function nlpPreClusterQuestions(questions, similarityThreshold = 0.8) {
    // Küçük harfe çevir, noktalama temizle, tokenize et
    const clean = (text) => tokenizer.tokenize(
        (text || '').toLowerCase().replace(/[.,!?;:()\[\]{}"'`]/g, '')
    ).join(' ');

    // Her sorunun temizlenmiş halini ve orijinalini tut
    const processed = questions.map(q => ({
        ...q,
        _clean: clean(q.message || q.text || '')
    }));

    const groups = [];
    processed.forEach((q, idx) => {
        let found = false;
        for (const group of groups) {
            // Cosine similarity ile benzerlik kontrolü
            const sim = natural.JaroWinklerDistance(q._clean, group[0]._clean);
            if (sim >= similarityThreshold) {
                group.push(q);
                found = true;
                break;
            }
        }
        if (!found) {
            groups.push([q]);
        }
    });
    // Grupları orijinal formatta döndür
    return groups.map(g => g.map(q => {
        const { _clean, ...rest } = q;
        return rest;
    }));
}

async function groupSimilarQuestions(questions) {
    console.log('🔍 Starting groupSimilarQuestions with', questions.length, 'questions');
    // NLP ile ön gruplama
    const nlpGroups = nlpPreClusterQuestions(questions, 0.85);
    console.log('🧠 NLP ön gruplama sonucu:', nlpGroups.length, 'grup');
    let allGroups = [];
    for (let i = 0; i < nlpGroups.length; i++) {
        const group = nlpGroups[i];
        if (group.length === 0) continue;
        // Normalizasyon ve deduplikasyon
        const uniqueQuestions = group.reduce((acc, curr) => {
            const text = curr.message || curr.text || '';
            if (!text.trim()) return acc;
            const key = `${text.toLowerCase()}_${curr.hotel || 'Unknown'}_${curr.language || 'unknown'}`;
            if (!acc[key]) {
                acc[key] = {
                    ...curr,
                    text: text,
                    count: 1,
                    originalText: text,
                    language: curr.language || 'unknown',
                    category: curr.category || 'general',
                    facility: curr.facility || null,
                    timestamp: curr.timestamp || new Date().toISOString()
                };
            } else {
                acc[key].count++;
                const timestamp = curr.timestamp || new Date().toISOString();
                if (timestamp > acc[key].timestamp) {
                    acc[key].timestamp = timestamp;
                    acc[key].originalText = text;
                }
            }
            return acc;
        }, {});
        const normalizedQuestions = Object.values(uniqueQuestions);
        // Gemini promptu ve AI kontrolü
        const prompt = `Analyze these questions and group them by similar intent/meaning. Each question should only be counted once in its exact form.\n\nQuestions to analyze:\n${normalizedQuestions.map(q => `- Text: "${q.originalText}", Count: ${q.count}, Language: ${q.language || 'unknown'}, Hotel: ${q.hotel || 'Unknown'}, Category: ${q.category || 'general'}, Facility: ${q.facility || 'none'}`).join('\\n')}\n\nRules for grouping:\n1. Each unique question text should only be counted ONCE\n2. Questions with the same meaning in different languages should be grouped together\n3. Similar complaints/questions about different hotels should be separate groups\n4. Keep exact counts - do not inflate numbers\n5. Use the most recent question as the representative question\n6. Maintain original language and hotel information\n7. **MOST IMPORTANT:** Questions from different categories (e.g. food, room, facility, pillow, restaurant, pool, etc.) MUST NEVER be grouped together. For example, "What is the main restaurant's name?" and "Are there pillows in the room?" MUST be in different groups, even if they are both questions about the hotel.\n\nReturn a JSON array where each group has:\n- question: The representative question text (most recent version)\n- count: EXACT number of times this question type was asked\n- category: The most appropriate category\n- facility: Specific facility if relevant\n- hotels: Array of mentioned hotels (only valid hotels: "Belvil", "Zeugma", "Ayscha")\n- languages: Array of languages used\n- percentage: Percentage of total questions (rounded to nearest whole number)\n\nImportant: Return ONLY the JSON array, no other text. Ensure counts are exact and not inflated.`;
        try {
            console.log(`🤖 [${i+1}/${nlpGroups.length}] Gemini'ye gönderilen grup:`, normalizedQuestions.map(q => q.originalText));
            const result = await geminiService.generateResponse([{ role: 'user', content: prompt }], '', 'en');
            if (!result.success) throw new Error(result.error || 'Failed to get AI response');
            const cleanJson = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const groups = JSON.parse(cleanJson);
            // Temsili soru seçimi: En sık geçen veya en yeni
            groups.forEach(g => {
                if (Array.isArray(g.question)) {
                    // Eğer AI birden fazla soru döndürdüyse, en sık geçen veya en yeni olanı seç
                    g.question = g.question[0];
                }
            });
            allGroups.push(...groups);
            console.log(`✅ [${i+1}/${nlpGroups.length}] Gemini'den dönen grup sayısı:`, groups.length);
        } catch (err) {
            console.error(`❌ [${i+1}/${nlpGroups.length}] Gemini gruplama hatası:`, err);
            // Hata olursa fallback ile gruplama
            const fallback = fallbackGrouping(normalizedQuestions);
            allGroups.push(...fallback);
        }
    }
    // Son olarak, tüm grupları kategori ve otel bazında tekrar birleştir (gerekirse)
    // (Burada istersen daha ileri birleştirme yapılabilir)
    console.log('🎯 Toplam grup sayısı:', allGroups.length);
    return allGroups;
}

function fallbackGrouping(normalizedQuestions) {
    console.log('⚠️ Using fallback grouping for', normalizedQuestions.length, 'questions');
    
    if (!normalizedQuestions || !Array.isArray(normalizedQuestions)) {
        console.error('❌ Invalid input to fallbackGrouping:', normalizedQuestions);
        return [];
    }

    if (normalizedQuestions.length === 0) {
        console.log('⚠️ No questions to group');
        return [];
    }

    // Create groups based on exact text, hotel, and category
    const groups = {};
    normalizedQuestions.forEach((q, index) => {
        if (!q) {
            console.log(`⚠️ Skipping invalid question at index ${index}`);
            return;
        }
        const text = q.message || q.text || '';
        if (!text.trim()) {
            console.log(`⚠️ Skipping empty message at index ${index}`);
            return;
        }
        // Kategori ve otel ile anahtar oluştur
        const key = `${text.toLowerCase()}_${q.hotel || 'Unknown'}_${q.category || 'general'}`;
        if (!groups[key]) {
            groups[key] = {
                question: text,
                count: q.count || 1,
                category: q.category || 'general',
                facility: q.facility || null,
                hotels: q.hotel ? [q.hotel] : [],
                languages: [q.language || 'unknown'],
                timestamp: q.timestamp || new Date().toISOString()
            };
        } else {
            groups[key].count += q.count || 1;
            if (q.hotel && !groups[key].hotels.includes(q.hotel)) {
                groups[key].hotels.push(q.hotel);
            }
            if (q.language && !groups[key].languages.includes(q.language)) {
                groups[key].languages.push(q.language);
            }
            // Keep the most recent timestamp
            const timestamp = q.timestamp || new Date().toISOString();
            if (timestamp > groups[key].timestamp) {
                groups[key].timestamp = timestamp;
                groups[key].question = text;
            }
        }
    });

    // Convert to array and calculate percentages
    const totalQuestions = normalizedQuestions.reduce((sum, q) => sum + (q.count || 1), 0);
    
    const result = Object.values(groups)
        .map(g => ({
            ...g,
            percentage: Math.round((g.count / totalQuestions) * 100),
            hotels: g.hotels
                .filter(hotel => ["Belvil", "Zeugma", "Ayscha"].includes(hotel))
                .filter((hotel, index, self) => self.indexOf(hotel) === index)
        }))
        .sort((a, b) => b.count - a.count || new Date(b.timestamp) - new Date(a.timestamp));

    console.log(`✅ Fallback grouping created ${result.length} groups`);
    return result;
}

function clearCache() {
    questionCache = null;
    lastCacheTime = null;
    console.log('🧹 Analytics cache cleared');
    // Event emit et
    analyticsEvents.emit('cacheCleared');
}

// Cache invalidation fonksiyonunu export et
function invalidateCache() {
    invalidateCacheOnNewQuestion();
}

// Yeni bir gerçek soru geldiğinde topQuestions cache'ini güncelle
function updateTopQuestionsCache(newQuestion) {
    // Sadece gerçek sorular işlenir
    if (!newQuestion.isQuestion) return;
    // Aynı grupta var mı kontrol et (kategori, otel, dil, metin benzerliği)
    const idx = topQuestionsCache.findIndex(q =>
        q.category === newQuestion.category &&
        q.hotel === newQuestion.hotel &&
        q.language === newQuestion.language &&
        q.question.toLowerCase() === (newQuestion.message || newQuestion.text || '').toLowerCase()
    );
    if (idx !== -1) {
        // Grup zaten varsa sayaç artır
        topQuestionsCache[idx].count++;
        topQuestionsCache[idx].percentage = 0; // Sonradan güncellenecek
    } else {
        // Yeni grup ekle
        topQuestionsCache.push({
            question: newQuestion.message || newQuestion.text,
            count: 1,
            category: newQuestion.category,
            facility: newQuestion.facility,
            hotels: [newQuestion.hotel],
            languages: [newQuestion.language],
            percentage: 0
        });
    }
    // Yüzdeleri güncelle
    const total = topQuestionsCache.reduce((sum, q) => sum + q.count, 0);
    topQuestionsCache.forEach(q => q.percentage = Math.round((q.count / total) * 100));
    topQuestionsLastUpdate = new Date().toISOString();
}

// Top Questions cache'ini dönen fonksiyon
function getTopQuestionsCache() {
    // En çok sorulandan başla, ilk 10'u döndür
    return {
        success: true,
        questions: topQuestionsCache.sort((a, b) => b.count - a.count).slice(0, 10),
        lastUpdated: topQuestionsLastUpdate
    };
}

module.exports = {
    analyzeQuestions,
    clearCache,
    isQuestion,
    categorizeQuestion,
    invalidateCache,
    analyticsEvents,
    groupSimilarQuestions,
    updateTopQuestionsCache,
    getTopQuestionsCache
};
