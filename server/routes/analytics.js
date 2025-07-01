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
                const recentQuestions = await firebaseService.getRecentQuestions(5); // Check last 5 mins
                
                if (recentQuestions.size > 0) {
                    console.log(`🔄 Found ${recentQuestions.size} new questions, invalidating cache for real-time update`);
                    needsFreshAnalysis = true;
                }
            } catch (error) {
                console.warn('⚠️ Could not check recent questions:', error.message);
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
        
        // Step 2: Get all logged questions from Firebase using the new efficient function
        const loggedQuestions = await firebaseService.getAllQuestions(2000); // Get up to 2000 logs
        console.log(`📊 Retrieved ${loggedQuestions.length} logged questions`);
        
        if (loggedQuestions.length === 0) {
            return res.json({
                success: true,
                questions: [],
                analysisDate: new Date().toLocaleString('tr-TR'),
                message: 'Henüz analiz edilecek sohbet bulunamadı'
            });
        }
        
        // Step 3: Group similar questions and count frequencies
        // The AI extraction step is no longer needed as we are logging clean questions.
        const questions = loggedQuestions.map(q => q.question);
        const groupedQuestions = await groupSimilarQuestions(loggedQuestions); // Pass full log with metadata
        console.log(`🔗 Grouped into ${groupedQuestions.length} question groups`);
        
        // Step 5: Get top 5 most frequent with proper categorization
        const topQuestions = groupedQuestions
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((item, index) => ({
                question: item.questionText || item.question,
                count: item.count,
                percentage: ((item.count / loggedQuestions.length) * 100).toFixed(1),
                category: item.category || 'Genel',
                languages: item.languages || ['unknown'],
                hotels: item.hotels || ['Unknown']
            }));
            
        console.log(`🏆 Top 5 questions identified`);
        
        // Step 6: Cache the results
        const analysisResults = {
            questions: topQuestions,
            analysisDate: new Date().toLocaleString('tr-TR'),
            totalLogs: loggedQuestions.length,
            totalQuestions: loggedQuestions.length,
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
    // THIS FUNCTION IS NO LONGER NEEDED AS WE ARE LOGGING QUESTIONS DIRECTLY
    // We keep it here in case we need to revert, but it should not be called.
    console.warn("extractQuestionsWithAI is deprecated and should not be called.");
    return chatLogs.map(log => ({
        question: log.userMessage || log.message || 'No message',
        hotel: log.hotel || 'Unknown',
        language: log.language || 'unknown'
    }));
}

// Group similar questions using AI
async function groupSimilarQuestions(loggedQuestions) {
    if (!loggedQuestions || loggedQuestions.length === 0) return [];
    console.log(`🔗 Grouping ${loggedQuestions.length} questions by similarity...`);

    const allGroups = [];
    const batchSize = 15; // Process 15 questions per AI call

    for (let i = 0; i < loggedQuestions.length; i += batchSize) {
        const batch = loggedQuestions.slice(i, i + batchSize);
        const batchNumber = (i / batchSize) + 1;
        const totalBatches = Math.ceil(loggedQuestions.length / batchSize);

        console.log(`🔍 Processing batch ${batchNumber}/${totalBatches}`);
        
        const prompt = `Analyze this list of user questions. Group similar questions together.

CRITICAL RULES:
- Identify the most common, representative phrasing for each group.
- Count how many times each type of question was asked.
- Consolidate different phrasings of the SAME question into one group.
- Preserve the original language.
- Extract all languages and hotels associated with the questions in each group.

Questions to analyze:
${batch.map((q, index) => `ID ${q.id}: "${q.question}" (Hotel: ${q.hotel}, Lang: ${q.language})`).join('\n')}

Respond with a JSON array of grouped questions. Example:
[
  {
    "question": "Havuz saatleri nedir?",
    "count": 3,
    "languages": ["tr"],
    "hotels": ["Belvil", "Ayscha"],
    "category": "Facilities"
  },
  {
    "question": "What are the a la carte restaurant options?",
    "count": 5,
    "languages": ["en", "de"],
    "hotels": ["Zeugma", "Ayscha", "Belvil"],
    "category": "Dining"
  }
]

Your entire response MUST be a single, valid JSON array. It must start with '[' and end with ']'. Do not include any markdown, explanations, or any other text.`;

        try {
            const aiResult = await geminiService.generateResponse([{ role: 'user', content: prompt }], null, 'en');

            if (aiResult.success && aiResult.response) {
                // Resiliently find the JSON array in the response
                const jsonMatch = aiResult.response.match(/\[[\s\S]*\]/);
                
                if (jsonMatch && jsonMatch[0]) {
                    const jsonString = jsonMatch[0];
                    const parsedGroup = JSON.parse(jsonString);
                    allGroups.push(...parsedGroup);
                } else {
                    console.warn(`⚠️ AI response for batch ${batchNumber} did not contain valid JSON.`);
                }
            } else {
                console.warn(`⚠️ AI grouping failed for batch ${batchNumber}.`);
            }
        } catch (error) {
            console.error(`❌ Error processing batch ${batchNumber}:`, error.message);
        }
    }
    
    // Final consolidation after all batches are processed
    if (allGroups.length === 0) {
        console.log('No groups were created by the AI.');
        return [];
    }

    const consolidated = {};
    allGroups.forEach(group => {
        if (!group.question) return; // Skip malformed groups
        const key = group.question.toLowerCase().trim();
        if (consolidated[key]) {
            consolidated[key].count += group.count;
            if (group.languages) {
                consolidated[key].languages = [...new Set([...consolidated[key].languages, ...group.languages])];
            }
            if (group.hotels) {
                consolidated[key].hotels = [...new Set([...consolidated[key].hotels, ...group.hotels])];
            }
        } else {
            consolidated[key] = {
                ...group,
                languages: group.languages || [],
                hotels: group.hotels || []
            };
        }
    });

    return Object.values(consolidated);
}

module.exports = router;
