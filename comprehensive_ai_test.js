const axios = require('axios');

const API_URL = 'http://localhost:5002/api/chat';

const testCases = [
  // Canlı destek niyeti
  { message: 'canlı destek', expected: 'support' },
  { message: 'gerçek bir insanla konuşmak istiyorum', expected: 'support' },
  { message: 'I want live support', expected: 'support' },
  { message: 'I want to talk to a real person', expected: 'support' },
  { message: 'Ich möchte mit einem Menschen sprechen', expected: 'support' },
  { message: 'Я хочу поговорить с человеком', expected: 'support' },
  { message: 'customer service', expected: 'support' },
  { message: 'support', expected: 'support' },
  { message: 'help', expected: 'support' },
  { message: 'operatörle görüşmek istiyorum', expected: 'support' },
  { message: 'yardım', expected: 'support' },
  { message: 'destek', expected: 'support' },
  // Lokasyon niyeti
  { message: 'En yakın hastane nerede?', expected: 'location' },
  { message: 'Where is the nearest pharmacy?', expected: 'location' },
  { message: 'Wo ist der nächste Strand?', expected: 'location' },
  { message: 'Где ближайший ресторан?', expected: 'location' },
  { message: 'Yakındaki marketleri göster', expected: 'location' },
  { message: 'Show me nearby cafes', expected: 'location' },
  { message: 'En yakın taksi durağı nerede?', expected: 'location' },
  { message: 'How do I get to the airport?', expected: 'location' },
  { message: 'Bana en yakın plajı bul', expected: 'location' },
  { message: 'Find the closest shopping mall', expected: 'location' },
  { message: 'Wo ist das nächste Krankenhaus?', expected: 'location' },
  { message: 'Где находится ближайшая аптека?', expected: 'location' },
  // Otel bilgisi niyeti
  { message: 'Belvil otelinin havuz saatleri nedir?', expected: 'info' },
  { message: 'What are the pool hours at Zeugma?', expected: 'info' },
  { message: 'Ayscha otelinde spa var mı?', expected: 'info' },
  { message: 'Does Belvil have a gym?', expected: 'info' },
  { message: 'Zeugma otelinde kaç restoran var?', expected: 'info' },
  { message: 'Is there a kids club at Ayscha?', expected: 'info' },
  { message: 'Belvil otelinde kaç oda var?', expected: 'info' },
  { message: 'Wie viele Pools hat das Zeugma Hotel?', expected: 'info' },
  { message: 'В отеле Белвиль есть спа?', expected: 'info' },
  // Selamlaşma, teşekkür, veda, vs.
  { message: 'Merhaba', expected: 'none' },
  { message: 'Hello', expected: 'none' },
  { message: 'Hi', expected: 'none' },
  { message: 'Danke', expected: 'none' },
  { message: 'Teşekkürler', expected: 'none' },
  { message: 'Goodbye', expected: 'none' },
  { message: 'Güle güle', expected: 'none' },
  { message: 'Auf Wiedersehen', expected: 'none' },
  { message: 'До свидания', expected: 'none' },
  // Karışık ve kenar durumlar
  { message: 'Belvil', expected: 'none' },
  { message: 'Zeugma', expected: 'none' },
  { message: 'Ayscha', expected: 'none' },
  { message: 'Belvil otel', expected: 'none' },
  { message: 'Zeugma hotel', expected: 'none' },
  { message: 'Ayscha otelde', expected: 'none' },
  { message: 'Papillon', expected: 'none' },
  { message: 'Hotel', expected: 'none' },
  { message: 'Otel', expected: 'none' },
  // Genel bilgi soruları
  { message: 'Bugün otelde hangi aktiviteler var?', expected: 'info' },
  { message: 'What activities are there today?', expected: 'info' },
  { message: 'Otelde kaç restoran var?', expected: 'info' },
  { message: 'How many restaurants are in the hotel?', expected: 'info' },
  { message: 'Spa fiyatları nedir?', expected: 'info' },
  { message: 'What are the spa prices?', expected: 'info' },
  { message: 'Çocuklar için etkinlik var mı?', expected: 'info' },
  { message: 'Is there an event for kids?', expected: 'info' },
  { message: 'Bugün hava nasıl?', expected: 'info' },
  { message: 'What is the weather today?', expected: 'info' },
  // Kısa, bağlamsız, tek kelime
  { message: 'Pool', expected: 'none' },
  { message: 'Spa', expected: 'none' },
  { message: 'Restaurant', expected: 'none' },
  { message: 'Kids', expected: 'none' },
  { message: 'Weather', expected: 'none' },
  { message: 'Fiyat', expected: 'none' },
  { message: 'Price', expected: 'none' },
  // 100'e tamamlamak için varyasyonlar
  { message: 'Can I get a late checkout?', expected: 'info' },
  { message: 'Geç çıkış yapabilir miyim?', expected: 'info' },
  { message: 'Is breakfast included?', expected: 'info' },
  { message: 'Kahvaltı dahil mi?', expected: 'info' },
  { message: 'Do you have vegan options?', expected: 'info' },
  { message: 'Vegan seçenek var mı?', expected: 'info' },
  { message: 'Can I bring my pet?', expected: 'info' },
  { message: 'Evcil hayvan kabul ediyor musunuz?', expected: 'info' },
  { message: 'Is there a shuttle to the airport?', expected: 'location' },
  { message: 'Havaalanına servis var mı?', expected: 'location' },
  { message: 'Do you have parking?', expected: 'info' },
  { message: 'Otopark var mı?', expected: 'info' },
  { message: 'Can I book a massage?', expected: 'info' },
  { message: 'Masaj rezervasyonu yapabilir miyim?', expected: 'info' },
  { message: 'Is the pool heated?', expected: 'info' },
  { message: 'Havuz ısıtmalı mı?', expected: 'info' },
  { message: 'Do you have a gym?', expected: 'info' },
  { message: 'Spor salonu var mı?', expected: 'info' },
  { message: 'Can I get a baby cot?', expected: 'info' },
  { message: 'Bebek yatağı alabilir miyim?', expected: 'info' },
  { message: 'Do you have gluten-free food?', expected: 'info' },
  { message: 'Glutensiz yemek var mı?', expected: 'info' },
  { message: 'Can I pay with credit card?', expected: 'info' },
  { message: 'Kredi kartı ile ödeme yapabilir miyim?', expected: 'info' },
  { message: 'Do you have WiFi?', expected: 'info' },
  { message: 'WiFi var mı?', expected: 'info' },
  { message: 'Is there a doctor on site?', expected: 'info' },
  { message: 'Otelde doktor var mı?', expected: 'info' },
  { message: 'Can I get a taxi from the hotel?', expected: 'location' },
  { message: 'Otelden taksi çağırabilir miyim?', expected: 'location' },
  { message: 'Do you have a laundry service?', expected: 'info' },
  { message: 'Çamaşırhane hizmetiniz var mı?', expected: 'info' },
  { message: 'Can I rent a car?', expected: 'info' },
  { message: 'Araba kiralayabilir miyim?', expected: 'info' },
  { message: 'Do you have a bar?', expected: 'info' },
  { message: 'Bar var mı?', expected: 'info' },
  { message: 'Can I get room service?', expected: 'info' },
  { message: 'Oda servisi var mı?', expected: 'info' },
  { message: 'Do you have a safe in the room?', expected: 'info' },
  { message: 'Odada kasa var mı?', expected: 'info' },
  { message: 'Can I get an extra bed?', expected: 'info' },
  { message: 'Ekstra yatak alabilir miyim?', expected: 'info' },
  { message: 'Do you have a mini bar?', expected: 'info' },
  { message: 'Mini bar var mı?', expected: 'info' },
  { message: 'Can I get a wake-up call?', expected: 'info' },
  { message: 'Uyandırma servisi var mı?', expected: 'info' },
];

function categorizeResponse(data) {
  if (data.isQuestion === false) return 'none';
  if (data.offerSupport) return 'support';
  if (data.placesData || data.response?.toLowerCase().includes('konum') || data.response?.toLowerCase().includes('location')) return 'location';
  if (data.response && data.response.length > 0 && data.response !== 'Merhaba!') return 'info';
  return 'none';
}

async function runTest() {
  let allPassed = true;
  let results = [];
  for (const test of testCases) {
    const sessionId = `test-session-${Math.random().toString(36).substring(2, 10)}`;
    const history = [];
    const req = { message: test.message, history, sessionId };
    try {
      const res = await axios.post(API_URL, req);
      const data = res.data;
      const detected = categorizeResponse(data);
      results.push({ message: test.message, expected: test.expected, detected });
      if (detected !== test.expected) {
        console.error(`❌ '${test.message}' için beklenen: ${test.expected}, bulunan: ${detected}`);
        allPassed = false;
      } else {
        console.log(`✅ '${test.message}' doğru kategorize edildi: ${detected}`);
      }
    } catch (err) {
      console.error(`❌ '${test.message}' için hata:`, err.message);
      allPassed = false;
    }
  }
  if (allPassed) {
    console.log('🎉 Tüm genel testler başarıyla geçti!');
  } else {
    console.log('⚠️ Bazı genel testlerde hata var. Logları ve sonuçları inceleyin.');
  }
  // Sonuç özeti
  const summary = results.reduce((acc, r) => {
    acc[r.expected] = (acc[r.expected] || 0) + 1;
    return acc;
  }, {});
  console.log('Sonuç özeti:', summary);
}

async function testAquaparkOtelAkisi() {
  const sessionId = `test-aquapark-${Math.random().toString(36).substring(2, 10)}`;
  const history = [];
  // 1. Kullanıcı aquapark hakkında bilgi sorar
  const req1 = { message: 'aquapark hakkında bilgi alabilir miyim?', history, sessionId };
  const res1 = await axios.post(API_URL, req1);
  const data1 = res1.data;
  console.log('--- İlk adımda dönen response ---');
  console.dir(data1, { depth: null });
  if (!data1.offerSupport && !data1.needHotelSelection) {
    console.error('❌ İlk adımda otel seçimi istenmeliydi!');
    return;
  }
  console.log('✅ İlk adımda otel seçimi istendi.');
  // 2. Kullanıcı otel adını yazar
  const req2 = {
    message: 'belvil',
    history: [
      { role: 'user', content: 'aquapark hakkında bilgi alabilir miyim?' },
      { role: 'assistant', content: data1.response, offerSupport: true, needHotelSelection: true }
    ],
    sessionId
  };
  const res2 = await axios.post(API_URL, req2);
  const data2 = res2.data;
  if (data2.response && (data2.response.toLowerCase().includes('konum') || data2.response.toLowerCase().includes('harita') || data2.placesData)) {
    console.error('❌ Otel adı sonrası konum veya harita dönmemeliydi!');
    return;
  }
  if (data2.response && data2.response.length > 0) {
    console.log('✅ Otel adı sonrası aquapark bilgisi döndü:', data2.response);
  } else {
    console.error('❌ Otel adı sonrası bilgi dönmedi!');
  }
}

// 100 soruluk yeni genel test seti
const generalTestSet = [
  // --- CANLI DESTEK ---
  { q: 'canlı destek', expected: 'support' },
  { q: 'yardım', expected: 'support' },
  { q: 'I want live support', expected: 'support' },
  { q: 'Ich möchte mit einem Menschen sprechen', expected: 'support' },
  { q: 'Я хочу поговорить с человеком', expected: 'support' },
  { q: 'customer service', expected: 'support' },
  { q: 'help', expected: 'support' },
  { q: 'support', expected: 'support' },
  // --- OTEL İÇİ OLANAKLAR/INFO ---
  { q: 'Aquapark hakkında bilgi alabilir miyim?', expected: 'info' },
  { q: 'Belvil otelinde spa var mı?', expected: 'info' },
  { q: 'WiFi var mı?', expected: 'info' },
  { q: 'Oda servisi var mı?', expected: 'info' },
  { q: 'Spa fiyatları nedir?', expected: 'info' },
  { q: 'Restoran saatleri nedir?', expected: 'info' },
  { q: 'Ayscha otelinde çocuk kulübü var mı?', expected: 'info' },
  { q: 'Zeugma otelinde kaç restoran var?', expected: 'info' },
  { q: 'Is there a gym at Belvil?', expected: 'info' },
  { q: 'Does Zeugma have a heated pool?', expected: 'info' },
  { q: 'Ayscha\'da vegan yemek var mı?', expected: 'info' },
  { q: 'Belvil otelinde kaç oda var?', expected: 'info' },
  { q: 'Ayscha otelinde spa fiyatları nedir?', expected: 'info' },
  { q: 'Zeugma otelinde ana restoranın adı ne?', expected: 'info' },
  { q: 'Belvil otelde kahvaltı saat kaçta?', expected: 'info' },
  { q: 'Ayscha otelinde masaj rezervasyonu yapabilir miyim?', expected: 'info' },
  { q: 'Otopark var mı?', expected: 'info' },
  { q: 'Mini bar var mı?', expected: 'info' },
  { q: 'Ekstra yatak alabilir miyim?', expected: 'info' },
  { q: 'Odada kasa var mı?', expected: 'info' },
  // --- KONUM/ÇEVRE ---
  { q: 'En yakın hastane nerede?', expected: 'location' },
  { q: 'Where is the nearest pharmacy?', expected: 'location' },
  { q: 'Wo ist der nächste Strand?', expected: 'location' },
  { q: 'Где ближайший ресторан?', expected: 'location' },
  { q: 'Yakındaki marketleri göster', expected: 'location' },
  { q: 'Show me nearby cafes', expected: 'location' },
  { q: 'En yakın taksi durağı nerede?', expected: 'location' },
  { q: 'How do I get to the airport?', expected: 'location' },
  { q: 'Bana en yakın plajı bul', expected: 'location' },
  { q: 'Find the closest shopping mall', expected: 'location' },
  // --- SELAMLAŞMA/TEŞEKKÜR/EDGE ---
  { q: 'Merhaba', expected: 'none' },
  { q: 'Hello', expected: 'none' },
  { q: 'Hi', expected: 'none' },
  { q: 'Danke', expected: 'none' },
  { q: 'Teşekkürler', expected: 'none' },
  { q: 'Goodbye', expected: 'none' },
  { q: 'Güle güle', expected: 'none' },
  { q: 'Auf Wiedersehen', expected: 'none' },
  { q: 'До свидания', expected: 'none' },
  // --- OTEL SEÇİMİ/AKIŞ ---
  { q: 'Belvil', expected: 'none' },
  { q: 'Zeugma', expected: 'none' },
  { q: 'Ayscha', expected: 'none' },
  { q: 'Belvil otel', expected: 'none' },
  { q: 'Zeugma hotel', expected: 'none' },
  { q: 'Ayscha otelde', expected: 'none' },
  // --- EDGE CASE/KISA-UZUN/KARMAŞIK ---
  { q: 'Papillon', expected: 'none' },
  { q: 'Hotel', expected: 'none' },
  { q: 'Otel', expected: 'none' },
  { q: 'Bugün otelde hangi aktiviteler var?', expected: 'info' },
  { q: 'What activities are there today?', expected: 'info' },
  { q: 'Otelde kaç restoran var?', expected: 'info' },
  { q: 'How many restaurants are in the hotel?', expected: 'info' },
  { q: 'Spa fiyatları nedir?', expected: 'info' },
  { q: 'What are the spa prices?', expected: 'info' },
  { q: 'Çocuklar için etkinlik var mı?', expected: 'info' },
  { q: 'Is there an event for kids?', expected: 'info' },
  { q: 'Bugün hava nasıl?', expected: 'location' },
  { q: 'What is the weather today?', expected: 'location' },
  // ... (daha fazla varyasyon, yanlış yazım, emoji, karışık niyet, boş/saçma mesajlar, vs.)
];

runTest().then(testAquaparkOtelAkisi);
