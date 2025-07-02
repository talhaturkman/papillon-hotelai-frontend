const geminiService = require('./gemini');
const firebaseService = require('./firebase');

let questionCache = null;
let lastCacheTime = null;
const cacheValidityPeriod = 5 * 60 * 1000; // 5 minutes

async function isQuestion(text) {
    if (!text) {
        console.log('❌ Empty text');
        return false;
    }

    // First, check if it's just a hotel name
    const hotelNames = ['belvil', 'zeugma', 'ayscha'];
    const textLower = text.toLowerCase().trim();
    
    // If it's just a hotel name or hotel name + "otelde", it's not a question
    if (hotelNames.some(hotel => 
        textLower === hotel || 
        textLower === `${hotel} otelde` ||
        textLower === `${hotel} otel` ||
        textLower === `${hotel} hotel`
    )) {
        console.log(`❌ Skipping hotel name: "${text}"`);
        return false;
    }

    const prompt = `Analyze if this text is a genuine question or inquiry that needs a response. Consider the context and intent carefully.

Text: "${text}"

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
        const result = await geminiService.generateResponse([{ role: 'user', content: prompt }], '', 'en');
        if (!result.success) throw new Error(result.error || 'Failed to get AI response');
        
        const cleanResponse = result.response.trim().toLowerCase();
        const isQuestion = cleanResponse === 'true';
        console.log(`🤖 AI Question Detection for "${text}": ${isQuestion}`);
        return isQuestion;
    } catch (error) {
        console.error('❌ AI Question Detection failed:', error);
        // Enhanced fallback detection
        const text_lower = text.toLowerCase().trim();
        
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
        const hasQuestionMark = text.includes('?');
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
        const result = await geminiService.generateResponse([{ role: 'user', content: prompt }], '', 'en');
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

        console.log('🔄 Generating fresh analytics...');

        // Get all questions from Firebase
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
            return { success: false, error: 'Invalid questions data' };
        }

        if (!loggedQuestions.length) {
            return { success: true, questions: [], lastUpdated: new Date().toISOString() };
        }

        // Group questions by session to maintain context
        const questionsBySession = {};
        loggedQuestions.forEach(q => {
            if (!q) return; // Skip null/undefined questions
            const sessionId = q.sessionId || 'default';
            if (!questionsBySession[sessionId]) {
                questionsBySession[sessionId] = [];
            }
            questionsBySession[sessionId].push(q);
        });

        // Process questions session by session
        const processedQuestions = [];
        for (const sessionQuestions of Object.values(questionsBySession)) {
            // Sort by timestamp
            sessionQuestions.sort((a, b) => {
                const aTime = a.timestamp || a.createdAt || new Date(0);
                const bTime = b.timestamp || b.createdAt || new Date(0);
                return new Date(aTime) - new Date(bTime);
            });
            
            // Track hotel context for the session
            let sessionHotel = null;
            for (const q of sessionQuestions) {
                if (!q || !q.message) {
                    console.log('⚠️ Skipping invalid question:', q);
                    continue;
                }

                // Update session hotel if detected
                if (q.detectedHotel) {
                    sessionHotel = q.detectedHotel;
                }

                // Skip non-questions based on pre-processed flag
                if (q.preprocessed && !q.isQuestion) {
                    console.log('⚠️ Skipping non-question:', q.message);
                    continue;
                }

                // Use pre-processed categorization if available
                const questionData = {
                    ...q,
                    message: q.message || q.text || '', // Ensure message exists
                    detectedHotel: q.detectedHotel || sessionHotel,
                    language: q.detectedLanguage || q.language || 'unknown',
                    timestamp: q.createdAt || q.timestamp || new Date().toISOString()
                };

                if (!q.preprocessed) {
                    try {
                        // Only for old questions that weren't pre-processed
                        const isQuestion = await isQuestion(questionData.message);
                        if (!isQuestion) {
                            console.log('⚠️ Skipping non-question after AI check:', questionData.message);
                            continue;
                        }
                        
                        const categorization = await categorizeQuestion(questionData.message);
                        questionData.categorization = categorization;
                        questionData.category = categorization.category;
                        questionData.facility = categorization.facility;
                        
                        // Update the question in Firebase with categorization
                        await firebaseService.updateQuestionAnalytics(q.id, {
                            isQuestion: true,
                            categorization,
                            preprocessed: true
                        });
                    } catch (error) {
                        console.error('❌ Error processing question:', error);
                        continue;
                    }
                }

                processedQuestions.push(questionData);
            }
        }

        console.log(`✅ Processed ${processedQuestions.length} valid questions`);
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

async function groupSimilarQuestions(questions) {
    console.log('🔍 Starting groupSimilarQuestions with', questions.length, 'questions');
    console.log('📝 Sample question:', JSON.stringify(questions[0], null, 2));
    
    if (!questions.length) return [];

    // First, normalize and deduplicate questions
    const uniqueQuestions = questions.reduce((acc, curr, index) => {
        // Debug logging for the first few items
        if (index < 3) {
            console.log(`📌 Processing question ${index}:`, JSON.stringify(curr, null, 2));
        }

        // Skip invalid questions
        if (!curr) {
            console.log('⚠️ Skipping undefined question');
            return acc;
        }

        const text = curr.message || curr.text || ''; // Handle both message and text fields
        if (!text.trim()) {
            console.log('⚠️ Skipping empty message');
            return acc;
        }
        
        const key = `${text.toLowerCase()}_${curr.hotel || 'Unknown'}_${curr.language || 'unknown'}`;
        
        if (!acc[key]) {
            acc[key] = {
                ...curr,
                text: text, // Ensure text field exists
                count: 1,
                originalText: text, // Keep original text for display
                language: curr.language || 'unknown',
                category: curr.category || 'general',
                facility: curr.facility || null,
                timestamp: curr.timestamp || new Date().toISOString()
            };
        } else {
            acc[key].count++;
            // Update timestamp if newer
            const timestamp = curr.timestamp || new Date().toISOString();
            if (timestamp > acc[key].timestamp) {
                acc[key].timestamp = timestamp;
                acc[key].originalText = text;
            }
        }
        return acc;
    }, {});

    // Convert back to array
    const normalizedQuestions = Object.values(uniqueQuestions);
    console.log('✅ Normalized', normalizedQuestions.length, 'unique questions');
    console.log('📝 Sample normalized question:', JSON.stringify(normalizedQuestions[0], null, 2));
    
    // Sort by timestamp to prioritize newer questions
    normalizedQuestions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const prompt = `Analyze these questions and group them by similar intent/meaning. Each question should only be counted once in its exact form.

Questions to analyze:
${normalizedQuestions.map(q => `- Text: "${q.originalText}", Count: ${q.count}, Language: ${q.language || 'unknown'}, Hotel: ${q.hotel || 'Unknown'}, Category: ${q.category || 'general'}, Facility: ${q.facility || 'none'}`).join('\n')}

Rules for grouping:
1. Each unique question text should only be counted ONCE
2. Questions with the same meaning in different languages should be grouped together
3. Similar complaints/questions about different hotels should be separate groups
4. Keep exact counts - do not inflate numbers
5. Use the most recent question as the representative question
6. Maintain original language and hotel information

Return a JSON array where each group has:
- question: The representative question text (most recent version)
- count: EXACT number of times this question type was asked
- category: The most appropriate category
- facility: Specific facility if relevant
- hotels: Array of mentioned hotels (only valid hotels: "Belvil", "Zeugma", "Ayscha")
- languages: Array of languages used
- percentage: Percentage of total questions (rounded to nearest whole number)

Important: Return ONLY the JSON array, no other text. Ensure counts are exact and not inflated.`;

    try {
        console.log('🤖 Sending prompt to Gemini...');
        const result = await geminiService.generateResponse([{ role: 'user', content: prompt }], '', 'en');
        if (!result.success) throw new Error(result.error || 'Failed to get AI response');
        
        // Clean and parse the response
        const cleanJson = result.response
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        
        try {
            console.log('🔄 Parsing Gemini response...');
            const groups = JSON.parse(cleanJson);
            console.log('✅ Successfully parsed', groups.length, 'groups');
            
            // Validate and clean each group
            const validGroups = groups
                .filter(group => {
                    // Must have a valid question
                    if (!group.question || typeof group.question !== 'string') {
                        console.log('⚠️ Skipping invalid group - missing question');
                        return false;
                    }
                    
                    // Validate count is reasonable
                    if (!group.count || group.count > normalizedQuestions.length) {
                        console.log('⚠️ Skipping invalid group - invalid count');
                        return false;
                    }
                    
                    return true;
                })
                .map(group => ({
                    ...group,
                    // Ensure hotels array is valid
                    hotels: (group.hotels || [])
                        .filter(hotel => ["Belvil", "Zeugma", "Ayscha"].includes(hotel))
                        .filter((hotel, index, self) => self.indexOf(hotel) === index),
                    // Recalculate percentage based on total questions
                    percentage: Math.round((group.count / questions.length) * 100)
                }));

            console.log('✅ Validated', validGroups.length, 'groups');

            // Double check total counts don't exceed input
            const totalGroupedCount = validGroups.reduce((sum, group) => sum + group.count, 0);
            if (totalGroupedCount > questions.length) {
                console.warn(`⚠️ Warning: Grouped count (${totalGroupedCount}) exceeds total questions (${questions.length}). Using fallback grouping.`);
                return fallbackGrouping(normalizedQuestions);
            }
            
            // Sort by count and then by most recent
            return validGroups.sort((a, b) => b.count - a.count);
        } catch (jsonError) {
            console.error('❌ Failed to parse AI grouping response:', jsonError);
            return fallbackGrouping(normalizedQuestions);
        }
    } catch (error) {
        console.error('❌ AI Grouping failed:', error);
        return fallbackGrouping(normalizedQuestions);
    }
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

    // Create groups based on exact text matches first
    const groups = {};
    
    normalizedQuestions.forEach((q, index) => {
        if (!q) {
            console.log(`⚠️ Skipping invalid question at index ${index}`);
            return;
        }

        // Get text from either message or text field
        const text = q.message || q.text || '';
        if (!text.trim()) {
            console.log(`⚠️ Skipping empty message at index ${index}`);
            return;
        }

        const key = `${text.toLowerCase()}_${q.hotel || 'Unknown'}`;
        
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
}

module.exports = {
    analyzeQuestions,
    clearCache,
    isQuestion,
    categorizeQuestion
};
