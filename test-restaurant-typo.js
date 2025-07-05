const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testRestaurantTypo() {
    const sessionId = 'test-restaurant-typo-' + Date.now();
    
    console.log('🔍 Testing restaurant typo issue');
    console.log('================================');
    
    try {
        // Test with typo "restourant"
        console.log('\n📤 Testing: "asma restourantın menüsünü at"');
        
        const response1 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'asma restourantın menüsünü at',
            session_id: sessionId,
            history: [],
            hotel: 'zeugma'
        });
        
        console.log('✅ Response 1 (with typo):');
        console.log('Success:', response1.data.success);
        console.log('Response:', response1.data.response);
        
        // Test with correct spelling
        console.log('\n📤 Testing: "asma restoranın menüsünü at"');
        
        const response2 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'asma restoranın menüsünü at',
            session_id: sessionId,
            history: [],
            hotel: 'zeugma'
        });
        
        console.log('✅ Response 2 (correct spelling):');
        console.log('Success:', response2.data.success);
        console.log('Response:', response2.data.response);
        
        // Test with just "asma"
        console.log('\n📤 Testing: "asma menüsü"');
        
        const response3 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'asma menüsü',
            session_id: sessionId,
            history: [],
            hotel: 'zeugma'
        });
        
        console.log('✅ Response 3 (just asma):');
        console.log('Success:', response3.data.success);
        console.log('Response:', response3.data.response);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testRestaurantTypo(); 