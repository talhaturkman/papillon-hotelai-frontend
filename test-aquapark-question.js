const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testAquaparkQuestion() {
    const question = "Когда открывается аквапарк отеля Belvil?";
    
    console.log('🔍 Testing aquapark question:', question);
    console.log('=====================================');
    
    try {
        console.log('📤 Sending request to:', `${API_BASE_URL}/chat`);
        
        const requestData = {
            message: question,
            session_id: 'test-aquapark-' + Date.now(),
            history: []
        };
        
        console.log('📤 Request data:', JSON.stringify(requestData, null, 2));
        
        const response = await axios.post(`${API_BASE_URL}/chat`, requestData, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response received:');
        console.log('Status:', response.status);
        console.log('Full response data:', JSON.stringify(response.data, null, 2));
        console.log('Hotel detected:', response.data.hotel);
        console.log('Response text:', response.data.response);
        console.log('Offer support:', response.data.offerSupport);
        console.log('Need hotel selection:', response.data.needHotelSelection);
        
        // Check if response contains aquapark information
        const responseText = response.data.response.toLowerCase();
        const hasAquaparkInfo = responseText.includes('аквапарк') || 
                               responseText.includes('aquapark') || 
                               responseText.includes('10:00') || 
                               responseText.includes('12:30') || 
                               responseText.includes('14:30') || 
                               responseText.includes('18:00');
        
        console.log('\n📊 Analysis:');
        console.log('Contains aquapark info:', hasAquaparkInfo);
        console.log('Response length:', response.data.response.length);
        
        if (hasAquaparkInfo) {
            console.log('✅ SUCCESS: Aquapark information found in response');
        } else {
            console.log('❌ FAILED: No aquapark information found in response');
            console.log('💡 This might mean:');
            console.log('   1. No aquapark info in any language chunks');
            console.log('   2. LLM cannot find the info in the context');
            console.log('   3. Translation issues');
            console.log('   4. Backend not using the new knowledge chain');
            console.log('   5. Error in the new knowledge chain logic');
        }
        
    } catch (error) {
        console.error('❌ Error testing aquapark question:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            console.error('Response headers:', error.response.headers);
        }
    }
}

// Run the test
testAquaparkQuestion(); 