const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002';

const tests = [
    {
        language: 'en',
        hotel: 'Belvil', // Fact sheet for Belvil is in German
        question: 'What activities are available for children?',
        expectedLanguage: 'English'
    },
    {
        language: 'de',
        hotel: 'Zeugma', // Fact sheets for Zeugma are in English and Turkish
        question: 'Welche Aktivitäten gibt es für Kinder?',
        expectedLanguage: 'German'
    },
    {
        language: 'ru',
        hotel: 'Belvil', // Fact sheet for Belvil is in German
        question: 'Какие развлечения доступны для детей?',
        expectedLanguage: 'Russian'
    },
    {
        language: 'tr',
        hotel: 'Zeugma', // Fact sheets for Zeugma are in English and Turkish
        question: 'Çocuklar için ne gibi aktiviteler mevcut?',
        expectedLanguage: 'Turkish'
    }
];

async function runLanguageTest() {
    console.log('🚀 Starting Multilingual AI Test...');
    console.log('====================================');

    for (const test of tests) {
        console.log(`\n🌐 Testing Language: ${test.expectedLanguage} (querying about ${test.hotel})`);
        console.log('--------------------------------------------------');
        try {
            const response = await axios.post(`${API_BASE_URL}/api/chat`, {
                // The first message sets the language context
                message: test.question,
                history: [
                    // We also specify the hotel in the history to get knowledge context
                    { role: 'user', content: `Tell me about ${test.hotel}` },
                    { role: 'assistant', content: 'Of course, how can I help?' }
                ],
                session_id: `lang-test-session-${test.language}`
            });

            console.log(`❓ Question (${test.expectedLanguage}): ${test.question}`);
            console.log(`🤖 Answer:`);
            console.log(response.data.response);
            console.log('--------------------------------------------------');

        } catch (error) {
            console.error(`❌ Error testing ${test.expectedLanguage}:`, error.response ? error.response.data : error.message);
        }
    }

    console.log('====================================');
    console.log('🏁 Language test finished.');
}

runLanguageTest(); 