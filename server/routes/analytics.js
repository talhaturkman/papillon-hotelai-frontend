const express = require('express');
const router = express.Router();
const firebaseService = require('../services/firebase');
const geminiService = require('../services/gemini');
const admin = require('firebase-admin');

// Get top 5 most asked questions with caching
router.get('/top-questions', async (req, res) => {
    try {
        // Check if fresh analysis needed (bypass cache if recent chat activity)
        const shouldBypassCache = req.query.force === 'true';
        const cacheKey = 'analytics_top_questions';
        
        // Check for recent chat activity (last 5 minutes) to auto-invalidate cache
        let needsFreshAnalysis = shouldBypassCache;
        if (!needsFreshAnalysis) {
            try {
                const recentChats = await firebaseService.db.collection('chatlog')
                    .where('createdAt', '>=', new Date(Date.now() - 5 * 60 * 1000)) // Last 5 minutes
                    .get();
                
                if (recentChats.size > 0) {
                    console.log(`🔄 Found ${recentChats.size} recent chats, invalidating cache for real-time update`);
                    needsFreshAnalysis = true;
                }
            } catch (error) {
                console.warn('⚠️ Could not check recent chat activity:', error.message);
            }
        }
        
        // Try to get cached results first (if no recent activity)
        if (!needsFreshAnalysis) {
            try {
                const cacheDoc = await firebaseService.db.collection('analytics_cache').doc(cacheKey).get();
                if (cacheDoc.exists) {
                    const cacheData = cacheDoc.data();
                    const cacheAge = Date.now() - cacheData.timestamp;
                    const maxCacheAge = 60 * 60 * 1000; // 1 hour
                    
                    if (cacheAge < maxCacheAge) {
                        console.log(`📊 Using cached analytics (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                        return res.json({
                            success: true,
                            questions: cacheData.questions,
                            lastUpdated: new Date(cacheData.timestamp).toISOString(),
                            fromCache: true
                        });
                    } else {
                        console.log('⏰ Cache expired, generating fresh analysis');
                        needsFreshAnalysis = true;
                    }
                }
            } catch (error) {
                console.warn('⚠️ Cache check failed:', error.message);
                needsFreshAnalysis = true;
            }
        }

        // Generate fresh analysis
        console.log('🔄 Generating fresh analytics analysis...');
        const startTime = Date.now();
        
        // Step 2: Get all chat logs from Firebase using existing getChatHistory
        const chatLogs = await firebaseService.getChatHistory(null, 1000); // Get up to 1000 logs
        console.log(`📊 Retrieved ${chatLogs.length} chat logs`);
        
        if (chatLogs.length === 0) {
            return res.json({
                success: true,
                questions: [],
                analysisDate: new Date().toLocaleString('tr-TR'),
                message: 'Henüz analiz edilecek sohbet bulunamadı'
            });
        }
        
        // Step 3: Extract questions using AI
        const questions = await extractQuestionsWithAI(chatLogs);
        console.log(`❓ Extracted ${questions.length} questions`);
        
        // Step 4: Group similar questions and count frequencies
        const groupedQuestions = await groupSimilarQuestions(questions);
        console.log(`🔗 Grouped into ${groupedQuestions.length} question groups`);
        
        // Step 5: Get top 5 most frequent with proper categorization
        const topQuestions = groupedQuestions
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((item, index) => ({
                question: item.questionText || item.question,
                count: item.count,
                percentage: ((item.count / questions.length) * 100).toFixed(1),
                category: item.category || 'Genel',
                languages: item.languages || [item.language || 'unknown'],
                hotels: item.hotels || ['Unknown']
            }));
            
        console.log(`🏆 Top 5 questions identified`);
        
        // Step 6: Cache the results
        const analysisResults = {
            questions: topQuestions,
            analysisDate: new Date().toLocaleString('tr-TR'),
            totalLogs: chatLogs.length,
            totalQuestions: questions.length,
            timestamp: Date.now()
        };
        
        await cacheAnalysisResults(analysisResults);
        
        res.json({
            success: true,
            ...analysisResults,
            cached: false
        });
        
    } catch (error) {
        console.error('❌ Analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Analiz verileri alınamadı',
            message: error.message
        });
    }
});

// Cache management functions
async function getCachedAnalysis() {
    try {
        await firebaseService.ensureInitialized();
        const db = admin.firestore();
        const cacheDoc = await db.collection('analytics_cache').doc('top_questions').get();
        
        if (cacheDoc.exists) {
            const data = cacheDoc.data();
            const cacheAge = Date.now() - data.timestamp;
            const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
            
            if (cacheAge < oneHour) {
                console.log(`📦 Using cache (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                return data;
            } else {
                console.log(`⏰ Cache expired (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
            }
        }
        return null;
    } catch (error) {
        console.warn('⚠️ Cache check failed:', error.message);
        return null;
    }
}

async function cacheAnalysisResults(results) {
    try {
        await firebaseService.ensureInitialized();
        const db = admin.firestore();
        await db.collection('analytics_cache').doc('top_questions').set(results);
        console.log('💾 Analysis results cached');
    } catch (error) {
        console.warn('⚠️ Cache save failed:', error.message);
    }
}

// Clear analytics cache endpoint
router.delete('/clear-cache', async (req, res) => {
    try {
        await firebaseService.ensureInitialized();
        const db = admin.firestore();
        
        // Delete the cache document
        await db.collection('analytics_cache').doc('top_questions').delete();
        console.log('🧹 Analytics cache cleared successfully');
        
        res.json({
            success: true,
            message: 'Analytics cache başarıyla temizlendi'
        });
    } catch (error) {
        console.error('❌ Cache clear error:', error);
        res.status(500).json({
            success: false,
            error: 'Cache temizlenirken hata oluştu',
            message: error.message
        });
    }
});

// Extract actual questions from chat logs using AI
async function extractQuestionsWithAI(chatLogs) {
    const questions = [];
    
    // Process in batches of 15 for efficiency (reduced batch size for better accuracy)
    const batchSize = 15;
    for (let i = 0; i < chatLogs.length; i += batchSize) {
        const batch = chatLogs.slice(i, i + batchSize);
        
        console.log(`🔍 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chatLogs.length/batchSize)}`);
        
        // Prepare batch data with metadata
        const batchData = batch.map((log, index) => ({
            index: i + index,
            message: log.userMessage || log.message || log.question || 'No message',
            hotel: log.hotel || log.detectedHotel || 'Unknown',
            language: log.language || log.detectedLanguage || 'unknown',
            sessionId: log.sessionId || 'unknown'
        }));
        
        const prompt = `Analyze these user messages and extract ONLY the actual questions with their metadata.

CRITICAL RULES:
- Only extract messages that are questions (asking for information)
- Ignore greetings, statements, confirmations, thank you messages
- PRESERVE the original language of each question - DO NOT translate or change the text
- Remove only personal details, keep the core question exactly as written
- If hotel is not explicitly mentioned in the message, mark as "Unknown"
- Detect language accurately from the original text

Data to analyze:
${batchData.map(item => 
    `Message ${item.index}: "${item.message}" | Detected Hotel: ${item.hotel} | Detected Language: ${item.language}`
).join('\n')}

Respond with a JSON array of extracted questions. Example:
[
  {
    "question": "what are the pool opening hours?",
    "detectedLanguage": "en",
    "relatedHotel": "Unknown",
    "category": "Facilities",
    "originalIndex": 5
  },
  {
    "question": "kahvaltı saat kaçta?",
    "detectedLanguage": "tr", 
    "relatedHotel": "Unknown",
    "category": "Dining",
    "originalIndex": 12
  },
  {
    "question": "zeugma oteli restoran saatleri nedir?",
    "detectedLanguage": "tr", 
    "relatedHotel": "Zeugma",
    "category": "Dining",
    "originalIndex": 15
  }
]

IMPORTANT: 
- Keep questions in their ORIGINAL language
- Only mark hotel as specific name if explicitly mentioned in the question
- If no hotel mentioned in question, use "Unknown" regardless of detected metadata`;

        try {
            const result = await geminiService.generateResponse([{role: 'user', content: prompt}], null, 'en');
            
            if (result.success) {
                const cleanResponse = result.response.replace(/```json|```/g, '').trim();
                const extractedQuestions = JSON.parse(cleanResponse);
                
                // Add metadata to each question
                extractedQuestions.forEach(q => {
                    const originalLog = batchData.find(item => item.index === q.originalIndex);
                    questions.push({
                        questionText: q.question,
                        detectedLanguage: q.detectedLanguage || 'unknown',
                        // AI'ın hotel detection kararına saygı duy - override etme
                        relatedHotel: q.relatedHotel || 'Unknown',
                        category: q.category || 'Genel',
                        originalBatch: Math.floor(i/batchSize) + 1,
                        sessionId: originalLog ? originalLog.sessionId : 'unknown'
                    });
                });
            }
        } catch (error) {
            console.warn(`⚠️ Failed to process batch ${Math.floor(i/batchSize) + 1}:`, error.message);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 750)); // Increased delay
    }
    
    return questions;
}

// Group similar questions using AI
async function groupSimilarQuestions(questions) {
    if (questions.length === 0) return [];
    
    console.log(`🔗 Grouping ${questions.length} questions by similarity...`);
    
    // Prepare questions with metadata for better analysis
    const questionData = questions.map((q, i) => ({
        id: i,
        text: q.questionText,
        language: q.detectedLanguage,
        hotel: q.relatedHotel,
        category: q.category
    }));
    
    const prompt = `Group these questions by similarity and intent. Questions asking the same thing should be grouped together, regardless of language.

Questions with metadata:
${questionData.map((q, i) => 
    `${i+1}. "${q.text}" | Language: ${q.language} | Hotel: ${q.hotel} | Category: ${q.category}`
).join('\n')}

Respond with JSON showing groups of similar questions:
[
  {
    "questionText": "what are the pool opening hours?",
    "count": 3,
    "category": "Facilities",
    "languages": ["en", "tr"],
    "hotels": ["Unknown", "Zeugma"],
    "similarQuestions": [
      "what are the pool opening hours?",
      "havuz saatleri nedir?",
      "when does pool open?"
    ]
  }
]

CRITICAL RULES:
- Group questions with same intent even if different languages
- Use the MOST FREQUENTLY ASKED version as representative text (keep original language)
- DO NOT translate or clean up question text - keep them exactly as users wrote
- Count total occurrences in the group
- List all languages found in the group
- List all hotels mentioned in the group
- Assign appropriate categories (Facilities, Dining, Location, Services, etc.)`;

    try {
        const result = await geminiService.generateResponse([{role: 'user', content: prompt}], null, 'en');
        
        if (result.success) {
            const cleanResponse = result.response.replace(/```json|```/g, '').trim();
            const groupedQuestions = JSON.parse(cleanResponse);
            
            // Validate and enhance the results
            return groupedQuestions.map(group => ({
                questionText: group.questionText,
                count: group.count || 1,
                category: group.category || 'Genel',
                languages: Array.isArray(group.languages) ? group.languages : [group.language || 'unknown'],
                hotels: Array.isArray(group.hotels) ? group.hotels : [group.hotel || 'Unknown'],
                similarQuestions: group.similarQuestions || [group.questionText]
            }));
        }
    } catch (error) {
        console.error('❌ Failed to group questions:', error);
        
        // Fallback: create groups based on exact text matches
        const questionCounts = {};
        const questionMetadata = {};
        
        questions.forEach(q => {
            const key = q.questionText.toLowerCase().trim();
            questionCounts[key] = (questionCounts[key] || 0) + 1;
            
            if (!questionMetadata[key]) {
                questionMetadata[key] = {
                    languages: new Set(),
                    hotels: new Set(),
                    categories: new Set()
                };
            }
            
            questionMetadata[key].languages.add(q.detectedLanguage);
            questionMetadata[key].hotels.add(q.relatedHotel);
            questionMetadata[key].categories.add(q.category);
        });
        
        return Object.entries(questionCounts)
            .map(([question, count]) => {
                const meta = questionMetadata[question];
                return {
                questionText: question,
                count: count,
                    category: Array.from(meta.categories)[0] || 'Genel',
                    languages: Array.from(meta.languages),
                    hotels: Array.from(meta.hotels)
                };
            });
    }
}

module.exports = router;
