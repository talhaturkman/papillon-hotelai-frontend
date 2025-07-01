const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002';
const hotels = ['Belvil', 'Zeugma', 'Ayscha'];

// 10 standard questions to test the AI's knowledge
const questions = [
  "What are the check-in and check-out times?",
  "Can you tell me about the main restaurant?",
  "What are the operating hours for the swimming pools?",
  "Is there a spa? What services are offered?",
  "What activities are available for children?",
  "Do the rooms have free Wi-Fi?",
  "Is there an extra charge for the à la carte restaurants?",
  "What are the names of the bars and what are their hours?",
  "How can I contact the reception?",
  "Tell me about the beach facilities."
];

async function runTest() {
  console.log('��� Starting Comprehensive AI Knowledge Test...');
  console.log('=============================================');

  for (const hotel of hotels) {
    console.log(`\n��� Testing Hotel: ${hotel}\n-------------------------`);
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      try {
        // We simulate a conversation history where the hotel was already identified.
        // This forces the backend to use the specified hotel's knowledge base.
        const response = await axios.post(`${API_BASE_URL}/api/chat`, {
          message: question,
          history: [
            { role: 'user', content: `Tell me about ${hotel}` },
            { role: 'assistant', content: `Of course, I can help with that.` }
          ],
          session_id: `test-session-${hotel.toLowerCase()}`
        });

        console.log(`❓ Q${i + 1}: ${question}`);
        console.log(`��� A: ${response.data.response.replace(/\n/g, ' ')}`);
        console.log('-------------------------');

        } catch (error) {
        console.error(`❌ Error testing "${question}" for ${hotel}:`, error.response ? error.response.data : error.message);
      }
    }
  }

  console.log('=============================================');
  console.log('��� Test finished.');
}

runTest();
