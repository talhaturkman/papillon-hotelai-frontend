const axios = require('axios');

const API_URL = 'http://localhost:5002/api/chat';

async function runTest() {
    console.log('--- Running Translation System Test ---');

    const testPayload = {
        message: "Was sind die Merkmale der Superior-Zimmer im Zeugma?", // "What are the features of the Superior rooms in Zeugma?"
        history: [],
        session_id: `test-session-translation-${Date.now()}`
    };

    try {
        console.log(`\n[TEST] Sending German question to the chat API...`);
        console.log(`> ${testPayload.message}`);

        const response = await axios.post(API_URL, testPayload);
        const { data } = response;

        if (data.success && data.response) {
            console.log(`[PASS] API returned a successful response.`);
            console.log(`> AI Response: "${data.response}"`);

            // Basic check to see if the response contains German words.
            // This isn't foolproof, but good for a basic test.
            const germanKeywords = ['und', 'sind', 'zimmer', 'mit', 'einem', 'oder'];
            const responseLower = data.response.toLowerCase();
            const containsGerman = germanKeywords.some(kw => responseLower.includes(kw));

            if (containsGerman) {
                console.log(`[PASS] Response appears to be correctly translated to German.`);
                console.log('--- Translation System Test Passed ---');
            } else {
                console.error(`[FAIL] Response does NOT appear to be in German, even though the query was.`);
                console.log('--- Translation System Test Failed ---');
            }
        } else {
            console.error('[FAIL] API did not return a successful response.');
            console.error('Response:', data);
            console.log('--- Translation System Test Failed ---');
        }
    } catch (error) {
        console.error('[FATAL] An error occurred while running the test:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        console.log('--- Translation System Test Failed ---');
        console.log('Hint: Is the server running? Run "npm start" in the "server" directory.');
    }
}

runTest(); 