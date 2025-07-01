const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002';
const hotel = 'Belvil'; // We know the daily info is in Turkish for this hotel

const tests = [
    {
        lang: 'en',
        question: `What activity is there at 17:00 at ${hotel}?`,
        expected: 'football'
    },
    {
        lang: 'de',
        question: `Welche Aktivität gibt es um 17:00 Uhr im Hotel ${hotel}?`,
        expected: 'Fußball'
    },
    {
        lang: 'ru',
        question: `Какое мероприятие проводится в отеле ${hotel} в 17:00?`,
        expected: 'футбол'
    },
    {
        lang: 'tr',
        question: `${hotel}'de saat 17:00'de hangi aktivite var?`,
        expected: 'futbol'
    }
];

async function runDailyInfoTest() {
    console.log('🚀 Starting Cross-Language Daily Information Test...');
    console.log('=====================================================');
    let allTestsPassed = true;

    for (const test of tests) {
        console.log(`\n🌐 Testing Language: ${test.lang.toUpperCase()}`);
        console.log('--------------------------');
        try {
            const response = await axios.post(`${API_BASE_URL}/api/chat`, {
                message: test.question,
                history: [], 
                session_id: `daily-info-test-${test.lang}`
            });

            const aiResponse = response.data.response.toLowerCase();
            const pass = aiResponse.includes(test.expected);
            
            if (!pass) {
                allTestsPassed = false;
            }

            console.log(`❓ Question: ${test.question}`);
            console.log(`🤖 Answer: ${response.data.response}`);
            console.log(`✅ Result: ${pass ? 'PASSED' : 'FAILED'}`);
            console.log('--------------------------');

        } catch (error) {
            allTestsPassed = false;
            console.error(`❌ Error testing ${test.lang}:`, error.response ? error.response.data : error.message);
        }
    }

    console.log('\n=====================================================');
    if (allTestsPassed) {
        console.log('🎉 All cross-language daily info tests passed successfully!');
    } else {
        console.log('🔥 One or more tests failed. Please review the logs.');
    }
    console.log('=====================================================');
}

runDailyInfoTest(); 