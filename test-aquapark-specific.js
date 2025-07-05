const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testAquaparkSpecific() {
    const sessionId = 'test-aquapark-specific-' + Date.now();
    
    console.log('🔍 Testing specific aquapark question flow');
    console.log('==========================================');
    
    try {
        // Step 1: Ask specific aquapark question without hotel
        console.log('\n📤 Step 1: Asking specific aquapark question');
        console.log('Question: "zeugma otelin aquaparklarının ismi ne"');
        
        const response1 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'zeugma otelin aquaparklarının ismi ne',
            session_id: sessionId,
            history: []
        });
        
        console.log('✅ Response 1:');
        console.log('Status:', response1.status);
        console.log('Response:', response1.data.response);
        console.log('Hotel:', response1.data.hotel);
        
        // Step 2: Ask follow-up question
        console.log('\n📤 Step 2: Asking follow-up question');
        console.log('Question: "emin misin daha dikkatli bak"');
        
        const response2 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'emin misin daha dikkatli bak',
            session_id: sessionId,
            history: [
                { role: 'user', content: 'zeugma otelin aquaparklarının ismi ne' },
                { role: 'assistant', content: response1.data.response }
            ]
        });
        
        console.log('✅ Response 2:');
        console.log('Status:', response2.status);
        console.log('Response:', response2.data.response);
        console.log('Hotel:', response2.data.hotel);
        
        // Step 3: Ask again for aquapark names
        console.log('\n📤 Step 3: Asking again for aquapark names');
        console.log('Question: "aquaparkların adı ne"');
        
        const response3 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'aquaparkların adı ne',
            session_id: sessionId,
            history: [
                { role: 'user', content: 'zeugma otelin aquaparklarının ismi ne' },
                { role: 'assistant', content: response1.data.response },
                { role: 'user', content: 'emin misin daha dikkatli bak' },
                { role: 'assistant', content: response2.data.response }
            ]
        });
        
        console.log('✅ Response 3:');
        console.log('Status:', response3.status);
        console.log('Response:', response3.data.response);
        console.log('Hotel:', response3.data.hotel);
        
        // Check if the responses contain specific aquapark information
        const response1Text = response1.data.response.toLowerCase();
        const response2Text = response2.data.response.toLowerCase();
        const response3Text = response3.data.response.toLowerCase();
        
        const hasAquaparkInfo = response1Text.includes('aquapark') || 
                               response1Text.includes('su parkı') || 
                               response1Text.includes('water park') ||
                               response2Text.includes('aquapark') || 
                               response2Text.includes('su parkı') || 
                               response2Text.includes('water park') ||
                               response3Text.includes('aquapark') || 
                               response3Text.includes('su parkı') || 
                               response3Text.includes('water park');
        
        console.log('\n📊 Analysis:');
        console.log('Contains aquapark info:', hasAquaparkInfo);
        console.log('Response 1 length:', response1.data.response.length);
        console.log('Response 2 length:', response2.data.response.length);
        console.log('Response 3 length:', response3.data.response.length);
        
        if (hasAquaparkInfo) {
            console.log('✅ SUCCESS: Aquapark information found in responses');
        } else {
            console.log('❌ FAILURE: No aquapark information in responses');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

// Run the test
testAquaparkSpecific(); 