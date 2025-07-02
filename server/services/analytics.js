const geminiService = require('./gemini');
const firebaseService = require('./firebase');

class AnalyticsService {
    constructor() {
        this.questionCache = null;
        this.lastCacheTime = null;
        this.cacheValidityPeriod = 5 * 60 * 1000; // 5 minutes
    }

    async analyzeQuestions(forceRefresh = false) {
        try {
            // Check cache first
            if (!forceRefresh && this.questionCache && (Date.now() - this.lastCacheTime) < this.cacheValidityPeriod) {
                console.log('📦 Using cached analytics results');
                return this.questionCache;
            }

            console.log('🔄 Generating fresh analytics...');
            
            // Get all questions from Firebase
            const loggedQuestions = await firebaseService.getAllQuestions(2000);
            if (!loggedQuestions.length) {
                return { success: true, questions: [], lastUpdated: new Date().toISOString() };
            }

            // Prepare questions for analysis
            const questionsForAnalysis = loggedQuestions.map(q => ({
                id: q.id,
                text: q.message,
                hotel: q.detectedHotel || 'Unknown',
                language: q.detectedLanguage || 'unknown',
                timestamp: q.createdAt
            })).filter(q => q.text && typeof q.text === 'string' && q.text.trim() !== '');

            // Group similar questions using Gemini
            const groupedQuestions = await this.groupSimilarQuestions(questionsForAnalysis);

            // Sort by frequency and get top 6
            const topQuestions = this.processGroupedQuestions(groupedQuestions, questionsForAnalysis.length);

            const result = {
                success: true,
                questions: topQuestions,
                lastUpdated: new Date().toISOString()
            };

            // Update cache
            this.questionCache = result;
            this.lastCacheTime = Date.now();

            return result;
        } catch (error) {
            console.error('❌ Analytics error:', error);
            return { success: false, error: 'Failed to analyze questions' };
        }
    }

    async groupSimilarQuestions(questions) {
        const batchSize = 20;
        const allGroups = [];

        for (let i = 0; i < questions.length; i += batchSize) {
            const batch = questions.slice(i, i + batchSize);
            
            const prompt = `Analyze and group these user questions by similarity and intent. 

Input Format: Each question has an ID, text, hotel, and language.

Questions to analyze:
${batch.map(q => `ID ${q.id}: "${q.text}" (Hotel: ${q.hotel}, Lang: ${q.language})`).join('\n')}

CRITICAL REQUIREMENTS:
1. Group questions that ask for the same information, even if phrased differently
2. Preserve the original language of the most common version
3. Count occurrences accurately
4. Identify the clearest, most representative question for each group
5. Categorize by topic (e.g., Dining, Activities, Facilities, etc.)
6. Include all relevant hotels and languages

Output Format: A JSON array of grouped questions. Example:
[
  {
    "representativeQuestion": "What time does the pool open?",
    "category": "Facilities",
    "count": 3,
    "originalLanguage": "en",
    "languages": ["en", "tr"],
    "hotels": ["Belvil"],
    "questionIds": ["id1", "id2", "id3"],
    "variations": ["Pool opening time?", "When does the pool open?"]
  }
]

Return ONLY the JSON array, no other text.`;

            try {
                const aiResult = await geminiService.generateResponse([{ role: 'user', content: prompt }], null, 'en');
                
                if (aiResult.success && aiResult.response) {
                    const jsonMatch = aiResult.response.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const parsedGroups = JSON.parse(jsonMatch[0]);
                        allGroups.push(...parsedGroups);
                    }
                }
            } catch (error) {
                console.error('❌ Error in batch analysis:', error);
            }
        }

        return this.consolidateGroups(allGroups);
    }

    consolidateGroups(groups) {
        const consolidated = {};
        
        groups.forEach(group => {
            const key = group.representativeQuestion.toLowerCase().trim();
            
            if (consolidated[key]) {
                // Merge counts
                consolidated[key].count += group.count;
                
                // Merge languages and hotels
                consolidated[key].languages = [...new Set([...consolidated[key].languages, ...group.languages])];
                consolidated[key].hotels = [...new Set([...consolidated[key].hotels, ...group.hotels])];
                
                // Merge question IDs
                consolidated[key].questionIds = [...new Set([...consolidated[key].questionIds, ...group.questionIds])];
                
                // Merge variations
                consolidated[key].variations = [...new Set([...consolidated[key].variations, ...group.variations])];
            } else {
                consolidated[key] = {
                    ...group,
                    languages: group.languages || [],
                    hotels: group.hotels || [],
                    questionIds: group.questionIds || [],
                    variations: group.variations || []
                };
            }
        });

        return Object.values(consolidated);
    }

    processGroupedQuestions(groups, totalQuestions) {
        return groups
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
            .map(group => ({
                question: group.representativeQuestion,
                count: group.count,
                percentage: ((group.count / totalQuestions) * 100).toFixed(1),
                category: group.category || 'General',
                languages: group.languages || [],
                hotels: group.hotels || []
            }));
    }

    clearCache() {
        this.questionCache = null;
        this.lastCacheTime = null;
        return true;
    }
}

module.exports = new AnalyticsService(); 