const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testSessionContext() {
    const sessionId = 'test-session-context-' + Date.now();
    
    console.log('🔍 Testing session context issue');
    console.log('=================================');
    
    try {
        // Step 1: Ask about all-day restaurant
        console.log('\n📤 Step 1: "tüm gün yemek veren bir restorant var mı"');
        
        const response1 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'tüm gün yemek veren bir restorant var mı',
            session_id: sessionId,
            history: []
        });
        
        console.log('✅ Response 1:');
        console.log('Success:', response1.data.success);
        console.log('Response:', response1.data.response);
        console.log('Hotel:', response1.data.hotel);
        
        // Step 2: Provide hotel name
        console.log('\n📤 Step 2: "zeugma"');
        
        const response2 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'zeugma',
            session_id: sessionId,
            history: [
                { role: 'user', content: 'tüm gün yemek veren bir restorant var mı' },
                { role: 'assistant', content: response1.data.response }
            ]
        });
        
        console.log('✅ Response 2:');
        console.log('Success:', response2.data.success);
        console.log('Response:', response2.data.response);
        
        // Step 3: Ask about menu with typo
        console.log('\n📤 Step 3: "asma restourantın menüsünü at"');
        
        const response3 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'asma restourantın menüsünü at',
            session_id: sessionId,
            history: [
                { role: 'user', content: 'tüm gün yemek veren bir restorant var mı' },
                { role: 'assistant', content: response1.data.response },
                { role: 'user', content: 'zeugma' },
                { role: 'assistant', content: response2.data.response }
            ]
        });
        
        console.log('✅ Response 3:');
        console.log('Success:', response3.data.success);
        console.log('Response:', response3.data.response);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testSessionContext(); 