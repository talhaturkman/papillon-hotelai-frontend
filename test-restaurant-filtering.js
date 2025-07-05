const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

// Test the normalizeText function
function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s]/g, '').trim();
}

async function testRestaurantFiltering() {
    console.log('🔍 Testing restaurant filtering logic');
    console.log('====================================');
    
    // Test normalizeText function
    console.log('\n📝 Testing normalizeText function:');
    console.log('"Bloom_Lounge" ->', normalizeText("Bloom_Lounge"));
    console.log('"bloom lounge" ->', normalizeText("bloom lounge"));
    console.log('"Bloom Lounge" ->', normalizeText("Bloom Lounge"));
    console.log('"bloomlounge" ->', normalizeText("bloomlounge"));
    
    // Test if they match
    const normalized1 = normalizeText("Bloom_Lounge");
    const normalized2 = normalizeText("bloom lounge");
    console.log('Match:', normalized1 === normalized2);
    console.log('Includes test:', normalized1.includes(normalized2));
    console.log('Reverse includes test:', normalized2.includes(normalized1));
    
    try {
        // Test with actual API call
        console.log('\n📤 Testing with API call:');
        console.log('Question: "bloom lounge menüsü nedir"');
        
        const response = await axios.post(`${API_BASE_URL}/chat`, {
            message: 'bloom lounge menüsü nedir',
            session_id: 'test-restaurant-filtering-' + Date.now(),
            history: [],
            hotel: 'belvil'
        });
        
        console.log('✅ Response:');
        console.log('Status:', response.status);
        console.log('Response:', response.data.response);
        console.log('Hotel:', response.data.hotel);
        
        // Check if response contains menu information
        const responseText = response.data.response.toLowerCase();
        const hasMenuInfo = responseText.includes('menü') || 
                           responseText.includes('menu') || 
                           responseText.includes('yemek') || 
                           responseText.includes('food') ||
                           responseText.includes('bloom') ||
                           responseText.includes('lounge');
        
        console.log('\n📊 Analysis:');
        console.log('Contains menu info:', hasMenuInfo);
        console.log('Response length:', response.data.response.length);
        
        if (hasMenuInfo) {
            console.log('✅ SUCCESS: Menu information found');
        } else {
            console.log('❌ FAILURE: No menu information found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

// Run the test
testRestaurantFiltering(); 