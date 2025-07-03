require('dotenv').config();
const geminiService = require('./gemini');
const firebaseService = require('./firebase');
const translationService = require('./translation');
// Natural kütüphanesini kaldırıyoruz - embedding tabanlı gruplama kullanacağız
// const natural = require('natural');
// const tokenizer = new natural.WordTokenizer();
// const levenshtein = natural.LevenshteinDistance;

let questionCache = null;
let lastCacheTime = null;
const cacheValidityPeriod = 2 * 60 * 1000; // 2 minutes - daha hızlı güncelleme için

// Cache invalidation için event emitter
const EventEmitter = require('events');
const analyticsEvents = new EventEmitter();

// Top Questions için gerçek zamanlı cache
let topQuestionsCache = [];
let topQuestionsLastUpdate = null;

// Gemini Embedding 001 için embedding cache
let embeddingCache = new Map();
const embeddingCacheValidity = 24 * 60 * 60 * 1000; // 24 saat

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

// Cosine similarity hesaplama
function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
        return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Gemini Embedding 001 ile embedding alma
async function getEmbedding(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Invalid text for embedding');
    }
    
    // Debug: Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY not found in environment variables');
        console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('API') || key.includes('GEMINI')));
        throw new Error('GEMINI_API_KEY not configured');
    }
    
    // Cache kontrolü
    const cacheKey = text.toLowerCase().trim();
    const cached = embeddingCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < embeddingCacheValidity) {
        return cached.embedding;
    }
    
    try {
        console.log('🔑 Using API Key:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
        
        // Gemini Embedding API çağrısı (API key query parametresi ile)
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'models/text-embedding-004',
                    content: {
                        parts: [{ text }]
                    }
                })
            }
        );
        
        if (!response.ok) {
            throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const embedding = data.embedding.values;
        
        // Cache'e kaydet
        embeddingCache.set(cacheKey, {
            embedding: embedding,
            timestamp: Date.now()
        });
        
        return embedding;
    } catch (error) {
        console.error('❌ Embedding generation failed:', error);
        throw error;
    }
}

// Embedding'i hem orijinal dilde hem de İngilizce çevirisiyle alıp ortalamasını döndüren fonksiyon
async function getEmbeddingWithTranslation(text, language) {
    // Orijinal embedding
    const originalEmbedding = await getEmbedding(text);

    // İngilizce çeviri gerekiyorsa çevir ve embedding al
    let translatedEmbedding = originalEmbedding;
    if (language && language !== 'en') {
        try {
            const translatedText = await translationService.translateText(text, 'en');
            translatedEmbedding = await getEmbedding(translatedText);
        } catch (err) {
            console.error('Translation or embedding failed:', err);
        }
    }

    // İki embedding'in ortalamasını al
    const avgEmbedding = originalEmbedding.map((val, i) =>
        (val + (translatedEmbedding[i] || 0)) / 2
    );
    return avgEmbedding;
}

// Embedding tabanlı soru gruplama
async function groupSimilarQuestions(questions) {
    console.log('🔍 Starting embedding-based groupSimilarQuestions with', questions.length, 'questions');
    
    if (!questions || questions.length === 0) {
        return [];
    }

    try {
        // Her soru için embedding al (çeviri destekli)
        const questionsWithEmbeddings = await Promise.all(
            questions.map(async (q) => {
                const text = q.message || q.text || '';
                if (!text.trim()) return null;
                
                try {
                    const embedding = await getEmbeddingWithTranslation(text, q.language || 'unknown');
                    return {
                        ...q,
                        text: text,
                        embedding: embedding,
                        count: 1,
                        originalText: text,
                        language: q.language || 'unknown',
                        category: q.category || 'general',
                        facility: q.facility || null,
                        timestamp: q.timestamp || new Date().toISOString()
                    };
                } catch (error) {
                    console.error(`❌ Failed to get embedding for: "${text}"`, error);
                    return null;
                }
            })
        );
        
        // Null değerleri filtrele
        const validQuestions = questionsWithEmbeddings.filter(q => q !== null);
        console.log(`✅ Generated embeddings for ${validQuestions.length} questions`);
        
        if (validQuestions.length === 0) {
        return [];
    }

        // Embedding tabanlı gruplama
        const groups = [];
        const similarityThreshold = 0.7; // %70 benzerlik threshold'u (daha esnek)
        
        validQuestions.forEach((question, index) => {
            let foundGroup = null;
            
            // Mevcut gruplarla karşılaştır
            for (const group of groups) {
                const groupEmbedding = group.embedding;
                const similarity = cosineSimilarity(question.embedding, groupEmbedding);
                
                if (similarity >= similarityThreshold) {
                    foundGroup = group;
                    break;
                }
            }
            
            if (foundGroup) {
                // Mevcut gruba ekle
                foundGroup.count += question.count || 1;
                if (question.hotel && !foundGroup.hotels.includes(question.hotel)) {
                    foundGroup.hotels.push(question.hotel);
                }
                if (question.language && !foundGroup.languages.includes(question.language)) {
                    foundGroup.languages.push(question.language);
                }
                // En yeni timestamp ve metni temsilci olarak tut
                const timestamp = question.timestamp || new Date().toISOString();
                if (timestamp > foundGroup.timestamp) {
                    foundGroup.timestamp = timestamp;
                    foundGroup.question = question.text;
                }
            } else {
                // Yeni grup oluştur
                groups.push({
                    question: question.text,
                    count: question.count || 1,
                    category: question.category || 'general',
                    facility: question.facility || null,
                    hotels: question.hotel ? [question.hotel] : [],
                    languages: [question.language || 'unknown'],
                    timestamp: question.timestamp || new Date().toISOString(),
                    embedding: question.embedding // Referans için tut
                });
            }
        });
        
        // Yüzde hesapla ve sırala
        const totalQuestions = validQuestions.reduce((sum, q) => sum + (q.count || 1), 0);
        const result = groups
        .map(g => ({
            ...g,
            percentage: Math.round((g.count / totalQuestions) * 100),
                hotels: g.hotels.filter(hotel => ["Belvil", "Zeugma", "Ayscha"].includes(hotel))
                .filter((hotel, index, self) => self.indexOf(hotel) === index)
        }))
        .sort((a, b) => b.count - a.count || new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log(`✅ Embedding-based grouping created ${result.length} groups`);
        return result;
        
    } catch (error) {
        console.error('❌ Embedding-based grouping failed:', error);
        // Hata durumunda basit gruplama yap
        return questions.map(q => ({
            question: q.message || q.text || '',
            count: 1,
            category: q.category || 'general',
            facility: q.facility || null,
            hotels: q.hotel ? [q.hotel] : [],
            languages: [q.language || 'unknown'],
            timestamp: q.timestamp || new Date().toISOString(),
            percentage: Math.round((1 / questions.length) * 100)
        }));
    }
}

// Basit metin temizleme fonksiyonu (embedding için)
function cleanTextForEmbedding(text) {
    if (!text) return '';
    return text.trim();
}

// Embedding tabanlı fallback gruplama (basit)
async function fallbackGrouping(questions) {
    console.log('⚠️ Using embedding-based fallback grouping for', questions.length, 'questions');
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return [];
    }
    
    // Basit gruplama: her soruyu ayrı grup olarak ele al
    const result = questions.map(q => ({
        question: q.question || q.message || q.text || '',
        count: q.count || 1,
        category: q.category || 'general',
        facility: q.facility || null,
        hotels: q.hotel ? [q.hotel] : [],
        languages: [q.language || 'unknown'],
        timestamp: q.timestamp || new Date().toISOString(),
        percentage: Math.round((1 / questions.length) * 100)
    }));

    console.log(`✅ Fallback grouping created ${result.length} groups`);
    return result;
}

function clearCache() {
    questionCache = null;
    lastCacheTime = null;
    embeddingCache.clear(); // Embedding cache'ini de temizle
    topQuestionsCache = [];
    topQuestionsLastUpdate = null;
    console.log('🧹 Analytics and embedding cache cleared');
    // Event emit et
    analyticsEvents.emit('cacheCleared');
}

// Cache invalidation fonksiyonunu export et
function invalidateCache() {
    invalidateCacheOnNewQuestion();
}

// Yeni bir gerçek soru geldiğinde topQuestions cache'ini güncelle
function updateTopQuestionsCache(newQuestion) {
    if (!newQuestion.isQuestion) return;
    // Basit metin karşılaştırması
    const questionText = cleanTextForEmbedding(newQuestion.message || newQuestion.text || '');
    const idx = topQuestionsCache.findIndex(q =>
        q.category === newQuestion.category &&
        q.hotel === newQuestion.hotel &&
        q.language === newQuestion.language &&
        cleanTextForEmbedding(q.question) === questionText
    );
    if (idx !== -1) {
        topQuestionsCache[idx].count++;
        topQuestionsCache[idx].percentage = 0;
    } else {
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
    const total = topQuestionsCache.reduce((sum, q) => sum + q.count, 0);
    topQuestionsCache.forEach(q => q.percentage = Math.round((q.count / total) * 100));
    topQuestionsLastUpdate = new Date().toISOString();
}

// Top Questions cache'ini dönen fonksiyon (artık async)
async function getTopQuestionsCache() {
    // Eğer cache boşsa, analiz fonksiyonunu çağır ve cache'i doldur
    if (!topQuestionsCache || topQuestionsCache.length === 0) {
        try {
            const result = await analyzeQuestions(true); // force refresh
            if (result && result.success && Array.isArray(result.questions)) {
                topQuestionsCache = result.questions;
                topQuestionsLastUpdate = result.lastUpdated;
            }
        } catch (err) {
            console.error('❌ getTopQuestionsCache: analyzeQuestions failed:', err);
        }
    }
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
