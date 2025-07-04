const axios = require('axios');

async function testSimple() {
    try {
        console.log('🔍 Testing simple question...');
        
        const response = await axios.post('http://localhost:5002/api/chat', {
            message: 'Hello',
            session_id: 'test-simple-' + Date.now(),
            history: []
        });
        
        console.log('✅ Response:', response.data);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testSimple(); 