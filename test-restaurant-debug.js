const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testRestaurantDebug() {
    const sessionId = 'test-restaurant-debug-' + Date.now();
    
    console.log('🔍 Testing restaurant filtering debug');
    console.log('===================================');
    
    try {
        // Test with explicit restaurant name
        console.log('\n📤 Testing: "asma restoranın menüsü var mı"');
        
        const response = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'asma restoranın menüsü var mı',
            session_id: sessionId,
            history: [],
            hotel: 'zeugma' // Explicitly set hotel
        });
        
        console.log('✅ Response:');
        console.log('Success:', response.data.success);
        console.log('Response:', response.data.response);
        console.log('Hotel:', response.data.hotel);
        
        // Test with different restaurant
        console.log('\n📤 Testing: "farfalle restoranın menüsü var mı"');
        
        const response2 = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'farfalle restoranın menüsü var mı',
            session_id: sessionId,
            history: [],
            hotel: 'zeugma'
        });
        
        console.log('✅ Response 2:');
        console.log('Success:', response2.data.success);
        console.log('Response:', response2.data.response);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testRestaurantDebug(); 