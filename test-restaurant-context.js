const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testRestaurantContext() {
    const sessionId = 'test-restaurant-context-' + Date.now();
    
    console.log('🔍 Testing restaurant context issue');
    console.log('===================================');
    
    try {
        // Test with explicit hotel and restaurant
        console.log('\n📤 Testing: "Asma Restoran menüsü" with explicit hotel');
        
        const response = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'Asma Restoran menüsü',
            session_id: sessionId,
            history: [],
            hotel: 'zeugma' // Explicitly set hotel
        });
        
        console.log('✅ Response:');
        console.log('Success:', response.data.success);
        console.log('Response length:', response.data.response.length);
        console.log('Response (first 200 chars):', response.data.response.substring(0, 200));
        console.log('Response (last 200 chars):', response.data.response.substring(response.data.response.length - 200));
        
        // Check if response contains menu items
        const hasMenuItems = response.data.response.toLowerCase().includes('menü') || 
                           response.data.response.toLowerCase().includes('menu') ||
                           response.data.response.toLowerCase().includes('çorba') ||
                           response.data.response.toLowerCase().includes('salata') ||
                           response.data.response.toLowerCase().includes('burger') ||
                           response.data.response.toLowerCase().includes('pizza');
        
        console.log('Contains menu items:', hasMenuItems);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testRestaurantContext(); 