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

// LOOP KORUMASI: Analiz işlemini kilitlemek için
let isAnalyzing = false;
let lastAnalysisTime = null;
const analysisCooldown = 30 * 1000; // 30 saniye bekleme süresi

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

    // First, check if it's just a hotel name (fuzzy matching dahil)
    const hotelNames = ['belvil', 'zeugma', 'ayscha'];
    const textLower = textForGemini.toLowerCase().trim();
    // Fuzzy otel adı eşleşmesi (Levenshtein mesafesi <=2)
    function levenshtein(a, b) {
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
    let isHotelName = false;
    for (const hotel of hotelNames) {
        const dist = levenshtein(textLower, hotel);
        if (dist <= 2) {
            isHotelName = true;
            break;
        }
    }
    // Eğer otel adı ise, çeviri ve Gemini'ye gönderme, direkt true dön
    if (isHotelName) {
        return true;
    }

    // Gemini prompt
    const prompt = `Analyze if this text is a genuine question or inquiry that needs a response. Consider the context and intent carefully.

Text: "${textForGemini}"

Rules:
1. Return "true" if the text is a question, inquiry, or any message that could require a response or information, regardless of whether it is a greeting, thanks, or closing.
2. Return "true" for any sentence that asks for information, confirmation, details, or even general interaction.
3. Return "false" only if the text is completely empty or meaningless.

Important: Return ONLY "true" or "false", no other text or formatting.`;

    try {
        console.log(`[isQuestion] Text sent to Gemini: "${textForGemini}"`);
        // Tek mesaj için özel fonksiyon kullan
        const result = await geminiService.generateSingleResponse(prompt, 'en');
        console.log('==== GEMINI isQuestion RAW RESPONSE ====');
        console.log('Prompt:', prompt);
        console.log('Gemini Response:', result.response);
        console.log('========================================');
        if (!result.success) throw new Error(result.error || 'Failed to get AI response');
        const cleanResponse = result.response.trim().toLowerCase();
        const isQuestion = cleanResponse.includes('true') || cleanResponse.includes('yes') || cleanResponse.includes('question');
        console.log(`[isQuestion] Final decision for "${textForGemini}": ${isQuestion}`);
        return isQuestion;
    } catch (error) {
        console.error('❌ AI Question Detection failed:', error);
        // Enhanced fallback detection
        const text_lower = textForGemini.toLowerCase().trim();
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

// Optimized categorization with embedding in one call
async function categorizeQuestionWithEmbedding(text) {
    const prompt = `Analyze the following question/inquiry and provide both categorization and semantic embedding information.

Text: "${text}"

Return a JSON object with these properties:
- category: one of: location, time, availability, transport, price, facility, general, entertainment
- facility: one of: bathroom, shop, restaurant, pool, beach, spa, gym, entertainment, medical, transport, or null if not about a specific facility
- intent: brief description of the user's intent
- semantic_keywords: array of 5-10 key semantic words that represent this question's meaning
- embedding_context: brief context description for embedding generation

Important: Return ONLY the JSON object, no markdown formatting or code blocks. Do not use 'facility' for hotel names (Belvil, Zeugma, Ayscha).`;

    try {
        // Tek AI çağrısı ile hem kategorizasyon hem embedding context al
        const result = await geminiService.generateSingleResponse(prompt, 'en');
        if (!result.success) throw new Error(result.error || 'Failed to get AI response');
        
        // Clean the response of any markdown formatting
        const cleanJson = result.response
            .replace(/```json\n?/g, '')  // Remove ```json
            .replace(/```\n?/g, '')      // Remove closing ```
            .trim();                     // Remove extra whitespace
        
        try {
            const parsed = JSON.parse(cleanJson);
            console.log(`🤖 AI Categorization + Embedding Context for "${text}":`, parsed);
            
            // Şimdi embedding'i al (optimized context ile)
            const embeddingContext = parsed.embedding_context || text;
            const embedding = await getEmbedding(embeddingContext);
            
            return {
                ...parsed,
                embedding: embedding,
                originalText: text
            };
        } catch (jsonError) {
            console.error('❌ Failed to parse JSON response:', cleanJson);
            throw jsonError;
        }
    } catch (error) {
        console.error('❌ AI Categorization + Embedding failed:', error);
        // Return default categorization if AI fails
        return { 
            category: 'general', 
            facility: null, 
            intent: null,
            semantic_keywords: [],
            embedding_context: text,
            embedding: null,
            originalText: text
        };
    }
}

// Legacy function for backward compatibility
async function categorizeQuestion(text) {
    const result = await categorizeQuestionWithEmbedding(text);
    return {
        category: result.category,
        facility: result.facility,
        intent: result.intent
    };
}

async function analyzeQuestions(forceRefresh = false) {
    try {
        console.log(`🔍 Analyzing questions (force refresh: ${forceRefresh})`);
        
        // LOOP KORUMASI: Eğer analiz zaten çalışıyorsa bekle
        if (isAnalyzing) {
            console.log('⚠️ Analysis already in progress, skipping...');
            return questionCache || { success: true, questions: [], lastUpdated: new Date().toISOString() };
        }
        
        // LOOP KORUMASI: Çok sık çağrılıyorsa bekle
        if (lastAnalysisTime && (Date.now() - lastAnalysisTime) < analysisCooldown) {
            console.log('⚠️ Analysis called too frequently, using cache...');
            return questionCache || { success: true, questions: [], lastUpdated: new Date().toISOString() };
        }
        
        // Analiz işlemini kilitle
        isAnalyzing = true;
        lastAnalysisTime = Date.now();
        
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

        // LOOP SORUNUNU ÇÖZ: Sadece işlenmemiş soruları işle
        const unprocessedQuestions = realQuestions.filter(q => 
            !q.preprocessed || 
            !q.analyzedAt || 
            !q.categorization || 
            !q.embedding
        );
        
        const alreadyProcessedQuestions = realQuestions.filter(q => 
            q.preprocessed && 
            q.analyzedAt && 
            q.categorization && 
            q.embedding
        );
        
        console.log(`🔄 Found ${unprocessedQuestions.length} unprocessed questions out of ${realQuestions.length} total`);
        console.log(`✅ Found ${alreadyProcessedQuestions.length} already processed questions`);

        // Process questions - sadece işlenmemiş olanları işle
        const processedQuestions = [];
        
        // Önce zaten işlenmiş soruları ekle
        for (const q of alreadyProcessedQuestions) {
            const questionData = {
                ...q,
                message: q.message || q.text || '', // Ensure message exists
                detectedHotel: q.detectedHotel || q.hotel || 'Unknown',
                language: q.detectedLanguage || q.language || 'unknown',
                timestamp: q.createdAt || q.timestamp || new Date().toISOString(),
                category: q.category || 'general',
                facility: q.facility || null,
                categorization: q.categorization,
                embedding: q.embedding
            };
            processedQuestions.push(questionData);
        }
        
        // Sonra işlenmemiş soruları işle
        for (const q of unprocessedQuestions) {
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

                // Sadece işlenmemiş sorular için kategorizasyon ve embedding yap
                try {
                    console.log(`🔄 Processing new question with embedding: "${q.message}"`);
                    const categorizationWithEmbedding = await categorizeQuestionWithEmbedding(q.message);
                    
                    // Hem kategorizasyon hem embedding bilgilerini kaydet
                    questionData.categorization = {
                        category: categorizationWithEmbedding.category,
                        facility: categorizationWithEmbedding.facility,
                        intent: categorizationWithEmbedding.intent
                    };
                    questionData.category = categorizationWithEmbedding.category;
                    questionData.facility = categorizationWithEmbedding.facility;
                    questionData.embedding = categorizationWithEmbedding.embedding;
                    questionData.semantic_keywords = categorizationWithEmbedding.semantic_keywords;
                    
                    // Update the question in Firebase with categorization, embedding and processed flags
                    await firebaseService.updateQuestionAnalytics(q.id, {
                        categorization: questionData.categorization,
                        category: categorizationWithEmbedding.category,
                        facility: categorizationWithEmbedding.facility,
                        embedding: categorizationWithEmbedding.embedding,
                        semantic_keywords: categorizationWithEmbedding.semantic_keywords,
                        preprocessed: true,
                        analyzedAt: new Date().toISOString()
                    });
                    
                    console.log(`✅ Successfully processed and marked question: "${q.message}"`);
                } catch (error) {
                    console.error('❌ Error processing question with embedding:', error);
                    // Varsayılan değerlerle devam et
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
    } finally {
        // LOOP KORUMASI: Analiz işlemini serbest bırak
        isAnalyzing = false;
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
        // Her soru için embedding kontrolü (optimized - zaten varsa kullan)
        const questionsWithEmbeddings = await Promise.all(
            questions.map(async (q) => {
                const text = q.message || q.text || '';
                if (!text.trim()) return null;
                
                try {
                    let embedding;
                    
                    // Eğer embedding zaten varsa kullan (optimized)
                    if (q.embedding && Array.isArray(q.embedding)) {
                        console.log(`✅ Using existing embedding for: "${text}"`);
                        embedding = q.embedding;
                    } else {
                        // Yoksa yeni embedding al (fallback)
                        console.log(`🔄 Generating new embedding for: "${text}"`);
                        embedding = await getEmbeddingWithTranslation(text, q.language || 'unknown');
                    }
                    
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
    categorizeQuestionWithEmbedding,
    invalidateCache,
    analyticsEvents,
    groupSimilarQuestions,
    updateTopQuestionsCache,
    getTopQuestionsCache
};
