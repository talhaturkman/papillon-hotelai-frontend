require('dotenv').config();
const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testAll() {
  // 1. Otel algılama, dil algılama, çeviri, genel bilgi, spa, günlük bilgi, harita/location, analytics, vs.
  const hotels = ['Belvil', 'Zeugma', 'Ayscha', 'Unknown', 'Blevil', 'Papillon'];
  const languages = ['tr', 'en', 'de', 'ru'];
  const locations = [
    { lat: 36.856, lng: 31.045 }, // Antalya
    { lat: 36.890, lng: 30.698 }, // Lara
    null
  ];
  const baseQuestions = [
    // Genel bilgi
    'Check-in saati kaç?', 'What time is check-in?', 'Wann ist Check-in?', 'Во сколько заезд?',
    // SPA
    'Spa hizmetleri nelerdir?', 'What are the spa services?', 'Welche Spa-Dienstleistungen gibt es?', 'Какие услуги спа?',
    // Günlük bilgi
    'Bugün hangi etkinlikler var?', 'What are today\'s activities?', 'Welche Aktivitäten gibt es heute?', 'Какие мероприятия сегодня?',
    // Harita/location
    'Otele en yakın eczane nerede?', 'Where is the nearest pharmacy?', 'Wo ist die nächste Apotheke?', 'Где ближайшая аптека?',
    // Fiyat
    'Oda fiyatları nedir?', 'What are the room prices?', 'Wie sind die Zimmerpreise?', 'Сколько стоит номер?',
    // Otel algılama
    'Belvil otelinde havuz var mı?', 'Zeugma\'da spa var mı?', 'Ayscha\'da çocuk kulübü var mı?', 'Papillon\'da restoran var mı?',
    // Edge-case
    'merhaba', 'hi', 'hallo', 'привет', '12345', '', '!!!', 'Belvil', 'Zeugma', 'Ayscha'
  ];

  // 2. 1000+ randomize edilmiş, karışık, edge-case ve spam içeren soru üret
  let testQuestions = [];
  for (let i = 0; i < 1000; i++) {
    const q = baseQuestions[Math.floor(Math.random() * baseQuestions.length)];
    const hotel = hotels[Math.floor(Math.random() * hotels.length)];
    const lang = languages[Math.floor(Math.random() * languages.length)];
    const loc = locations[Math.floor(Math.random() * locations.length)];
    testQuestions.push({ message: q, hotel, language: lang, userLocation: loc });
  }

  // 3. Her soruyu chat endpoint'ine gönder, yanıtı ve hatayı logla
  let success = 0, fail = 0;
  for (let i = 0; i < testQuestions.length; i++) {
    const { message, hotel, language, userLocation } = testQuestions[i];
    try {
      const res = await axios.post(`${BASE_URL}/api/chat`, {
        message, history: [], session_id: `test-session-${i}`,
        userLocation
      });
      if (res.data && res.data.success) success++;
      else fail++;
      if (i % 50 === 0) console.log(`[${i}] Soru: "${message}" Yanıt:`, res.data.response || res.data.error);
    } catch (err) {
      fail++;
      console.error(`[${i}] Hata:`, err.response?.data || err.message);
    }
    if (i % 20 === 0) await sleep(500); // Sunucuyu boğmamak için
  }

  // 4. Analytics endpoint'ini, stats endpoint'ini ve knowledge base'i test et
  try {
    const analytics = await axios.get(`${BASE_URL}/api/analytics/top-questions`);
    console.log('Analytics Top Questions:', analytics.data.questions);
    const stats = await axios.get(`${BASE_URL}/api/analytics/stats`);
    console.log('Analytics Stats:', stats.data.stats);
  } catch (err) {
    console.error('Analytics/Stats Hatası:', err.response?.data || err.message);
  }

  // 5. Sonuç özeti
  console.log(`\nTest tamamlandı. Başarılı: ${success}, Hatalı: ${fail}, Toplam: ${testQuestions.length}`);
}

testAll().catch(console.error); 