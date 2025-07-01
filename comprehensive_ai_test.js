const axios = require('axios');

const API_URL = 'http://localhost:5002/api/chat';

// Helper function to run a test
async function runTest(testName, message, history = [], userLocation = null) {
    console.log(`\n--- Running Test: ${testName} ---`);
    console.log(`User > ${message}`);
    try {
        const response = await axios.post(API_URL, {
            message: message,
            history: history,
            userLocation: userLocation,
            session_id: `test-session-${Date.now()}`
        });

        const aiResponse = response.data.response;
        const placesData = response.data.placesData;

        console.log(`AI < ${aiResponse}`);
        if (placesData && placesData.list && placesData.list.length > 0) {
            console.log(`[Result] SUCCESS: Received ${placesData.list.length} places.`);
        } else if (placesData) {
            console.log(`[Result] INFO: Received placesData but it was empty or invalid.`);
        }

        return { success: true, response: aiResponse, placesData };
    } catch (error) {
        console.error(`[Result] FAILED: ${error.message}`);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('=== Starting Comprehensive AI Test Suite ===');

    // --- Language & Translation Tests ---
    console.log('\n\n--- Part 1: Language & Translation Tests ---');
    await runTest('L-1: Basic English', 'hello');
    await runTest('L-2: Basic Turkish', 'merhaba');
    await runTest('L-3: Turkish Typo', 'meraba');
    await runTest('L-4: Language Switching', 'where is the pool?', [{ role: 'user', content: 'merhaba' }, { role: 'assistant', content: 'Merhaba, nasıl yardımcı olabilirim?' }]);
    await runTest('L-5: Unsupported Language', 'bonjour');
    await runTest('L-6: Short/Ambiguous Word', 'ok', [{ role: 'user', content: 'Havuz nerede?' }, { role: 'assistant', content: 'Havuz lobi katındadır.' }]);

    // --- Location Performance Tests ---
    console.log('\n\n--- Part 2: Location Performance Tests ---');
    const userGpsLocation = { lat: 36.8574, lng: 31.0188 }; // A sample location in Belek
    await runTest('P-1: GPS Priority', 'en yakın eczane nerede?', [], userGpsLocation);
    await runTest('P-2: Fallback to Hotel (No GPS)', 'en yakın market nerede?');
    const hotelHistory = [{ role: 'user', content: 'Bana Belvil oteli hakkında bilgi ver' }, { role: 'assistant', content: 'Elbette, Papillon Belvil hakkında yardımcı olabilirim.' }];
    await runTest('P-3: Hotel-Specific (No GPS)', 'en yakın market nerede?', hotelHistory);
    await runTest('P-4: No Location Results', 'en yakın uzay gemisi tamircisi', [], userGpsLocation);
    
    // --- Knowledge Performance Tests ---
    console.log('\n\n--- Part 3: Knowledge Performance Tests ---');
    // Note: These tests assume the relevant documents have been uploaded in the admin panel.
    await runTest('K-1: General Info (Belvil)', 'Ala carte restoranlar ücretli mi?', hotelHistory);
    await runTest('K-2: Daily Info (Belvil)', 'Bugün akşam şovu saat kaçta?', hotelHistory);
    await runTest('K-3: SPA Info (Belvil)', '"SIMURG" Hamam bakımı nedir?', hotelHistory);
    await runTest('K-4: No Information', 'Odalarda Playstation 5 var mı?', hotelHistory);


    console.log('\n\n=== Comprehensive AI Test Suite Finished ===');
}

runAllTests();
