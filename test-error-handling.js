const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testErrorHandling() {
    console.log('��� Testing Error Handling and System Stability...\n');

    try {
        // 1. Test normal chat functionality
        console.log('��� 1. Testing normal chat functionality...');
        const normalResponse = await axios.post(`${BASE_URL}/api/chat`, {
            message: "Merhaba, nasılsın?",
            session_id: `test-session-${Date.now()}`,
            history: []
        });
        
        if (normalResponse.data.success) {
            console.log('✅ Normal chat working');
            console.log(`Response: ${normalResponse.data.response.substring(0, 100)}...`);
        } else {
            console.log('❌ Normal chat failed:', normalResponse.data.error);
        }
        console.log('');

        // 2. Test analytics endpoint
        console.log('��� 2. Testing analytics endpoint...');
        try {
            const analyticsResponse = await axios.get(`${BASE_URL}/api/analytics/top-questions`);
            console.log('✅ Analytics endpoint working');
            console.log(`Questions count: ${analyticsResponse.data.questions?.length || 0}`);
        } catch (error) {
            console.log('❌ Analytics endpoint failed:', error.response?.data?.error || error.message);
        }
        console.log('');

        // 3. Test stats endpoint
        console.log('��� 3. Testing stats endpoint...');
        try {
            const statsResponse = await axios.get(`${BASE_URL}/api/analytics/stats`);
            console.log('✅ Stats endpoint working');
            console.log(`Total questions: ${statsResponse.data.stats?.totalQuestions || 0}`);
        } catch (error) {
            console.log('❌ Stats endpoint failed:', error.response?.data?.error || error.message);
        }
        console.log('');

        // 4. Test with empty message
        console.log('��� 4. Testing with empty message...');
        try {
            const emptyResponse = await axios.post(`${BASE_URL}/api/chat`, {
                message: "",
                session_id: `test-session-${Date.now()}`,
                history: []
            });
            console.log('❌ Empty message should have failed but didn\'t');
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('✅ Empty message properly rejected');
            } else {
                console.log('❌ Unexpected error for empty message:', error.response?.data?.error || error.message);
            }
        }
        console.log('');

        // 5. Test with very long message
        console.log('��� 5. Testing with very long message...');
        const longMessage = "Bu çok uzun bir mesaj ".repeat(100);
        try {
            const longResponse = await axios.post(`${BASE_URL}/api/chat`, {
                message: longMessage,
                session_id: `test-session-${Date.now()}`,
                history: []
            });
            
            if (longResponse.data.success) {
                console.log('✅ Long message processed successfully');
            } else {
                console.log('❌ Long message failed:', longResponse.data.error);
            }
        } catch (error) {
            console.log('❌ Long message error:', error.response?.data?.error || error.message);
        }
        console.log('');

        // 6. Test multiple rapid requests
        console.log('⚡ 6. Testing multiple rapid requests...');
        const rapidPromises = [];
        for (let i = 0; i < 3; i++) {
            rapidPromises.push(
                axios.post(`${BASE_URL}/api/chat`, {
                    message: `Test message ${i + 1}`,
                    session_id: `test-session-${Date.now()}-${i}`,
                    history: []
                }).catch(error => ({ error: true, data: error.response?.data || error.message }))
            );
        }
        
        const rapidResults = await Promise.all(rapidPromises);
        const successCount = rapidResults.filter(r => !r.error && r.data.success).length;
        console.log(`✅ ${successCount}/3 rapid requests successful`);
        console.log('');

        // 7. Test location query
        console.log('��� 7. Testing location query...');
        try {
            const locationResponse = await axios.post(`${BASE_URL}/api/chat`, {
                message: "En yakın restoran nerede?",
                session_id: `test-session-${Date.now()}`,
                history: [],
                userLocation: { lat: 36.8969, lng: 30.7133 } // Antalya coordinates
            });
            
            if (locationResponse.data.success) {
                console.log('✅ Location query processed');
                if (locationResponse.data.placesData) {
                    console.log(`Found ${locationResponse.data.placesData.list?.length || 0} places`);
                }
            } else {
                console.log('❌ Location query failed:', locationResponse.data.error);
            }
        } catch (error) {
            console.log('❌ Location query error:', error.response?.data?.error || error.message);
        }
        console.log('');

        console.log('��� Error handling test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Test'i çalıştır
testErrorHandling();
