const axios = require('axios');

const testQuestions = [
  { message: 'Restoran saatleri nedir?', language: 'tr' },
  { message: 'What time does the restaurant open?', language: 'en' },
  { message: 'Papillon Belvil\'de havuz var mı?', language: 'tr' },
  { message: 'Is there a pool at Papillon Belvil?', language: 'en' },
  { message: 'Belvil', language: 'tr' },
  { message: 'Merhaba', language: 'tr' },
  { message: 'Do you accept foreign currency?', language: 'en' },
  { message: 'Hastane nerede?', language: 'tr' },
  { message: 'Where is the hospital?', language: 'en' },
  { message: 'Papillon Zeugma\'da spa var mı?', language: 'tr' },
  { message: 'Is there a spa at Papillon Zeugma?', language: 'en' },
  { message: 'Как называется главный ресторан отеля Belvil?', language: 'ru' },
  { message: 'Welche Einrichtungen hat das Zeugma Hotel?', language: 'de' }
];

async function runTests() {
  for (const q of testQuestions) {
    try {
      const res = await axios.post('http://localhost:5002/api/chat', {
        message: q.message,
        history: [],
        session_id: 'ai-test-session',
        userLocation: { lat: 36.8574, lng: 31.0188 },
      });
      console.log(`\n[TEST] Soru: "${q.message}" (${q.language})`);
      console.log(`[TEST] Backend cevabı:`, res.data);
    } catch (err) {
      console.error(`[TEST] Hata: ${q.message}`, err.response ? err.response.data : err);
    }
  }
}

runTests();
