const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testAquaparkFlow() {
    const sessionId = 'test-aquapark-flow-' + Date.now();
    
    console.log('🔍 Testing aquapark question flow with session context');
    console.log('==================================================');
    
    try {
        // Step 1: Ask aquapark question without hotel
        console.log('\n📤 Step 1: Asking aquapark question without hotel');
        console.log('Question: "aquaparkların adı ne"');
        
        const response1 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'aquaparkların adı ne',
            session_id: sessionId,
            history: []
        });
        
        console.log('✅ Response 1:');
        console.log('Status:', response1.status);
        console.log('Response:', response1.data.response);
        console.log('Need hotel selection:', response1.data.needHotelSelection);
        console.log('Hotel:', response1.data.hotel);
        
        // Step 2: Provide hotel name
        console.log('\n📤 Step 2: Providing hotel name');
        console.log('Message: "belvil"');
        
        const response2 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'belvil',
            session_id: sessionId,
            history: [
                { role: 'user', content: 'aquaparkların adı ne' },
                { role: 'assistant', content: response1.data.response }
            ]
        });
        
        console.log('✅ Response 2:');
        console.log('Status:', response2.status);
        console.log('Response:', response2.data.response);
        console.log('Hotel:', response2.data.hotel);
        
        // Check if the response contains aquapark information
        const responseText = response2.data.response.toLowerCase();
        const hasAquaparkInfo = responseText.includes('aquapark') || 
                               responseText.includes('su parkı') || 
                               responseText.includes('water park') ||
                               responseText.includes('belvil') ||
                               responseText.includes('papillon');
        
        console.log('\n📊 Analysis:');
        console.log('Contains aquapark info:', hasAquaparkInfo);
        console.log('Response length:', response2.data.response.length);
        
        if (hasAquaparkInfo) {
            console.log('✅ SUCCESS: Chat flow maintained, aquapark question answered properly');
        } else {
            console.log('❌ FAILURE: Chat flow broken, no aquapark information in response');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

// Run the test
testAquaparkFlow(); 