require('dotenv').config();
const axios = require('axios');
const questionAnalytics = require('./server/services/questionAnalytics');

const BASE_URL = 'http://localhost:3000';

// 100+ çeşitli, çok dilli, farklı kategorilerde ve otellerde test sorusu
const testQuestions = [
    // Food/Restaurant
    { message: 'Ana restoranın adı nedir?', hotel: 'Belvil', language: 'tr', category: 'food' },
    { message: 'What is the name of the main restaurant?', hotel: 'Belvil', language: 'en', category: 'food' },
    { message: 'Wie heißt das Hauptrestaurant?', hotel: 'Belvil', language: 'de', category: 'food' },
    { message: 'Restoran saat kaçta açılıyor?', hotel: 'Belvil', language: 'tr', category: 'food' },
    { message: 'What time does the restaurant open?', hotel: 'Belvil', language: 'en', category: 'food' },
    { message: 'Wann öffnet das Restaurant?', hotel: 'Belvil', language: 'de', category: 'food' },
    { message: 'Akşam yemeği saat kaçta?', hotel: 'Belvil', language: 'tr', category: 'food' },
    { message: 'What time is dinner?', hotel: 'Belvil', language: 'en', category: 'food' },
    { message: 'Wann ist das Abendessen?', hotel: 'Belvil', language: 'de', category: 'food' },
    { message: 'Menüde neler var?', hotel: 'Belvil', language: 'tr', category: 'food' },
    { message: 'What is on the menu?', hotel: 'Belvil', language: 'en', category: 'food' },
    { message: 'Was gibt es auf der Speisekarte?', hotel: 'Belvil', language: 'de', category: 'food' },
    // Room
    { message: 'Odalarda yastık var mı?', hotel: 'Belvil', language: 'tr', category: 'room' },
    { message: 'Is there a pillow in the room?', hotel: 'Belvil', language: 'en', category: 'room' },
    { message: 'Gibt es Kissen im Zimmer?', hotel: 'Belvil', language: 'de', category: 'room' },
    { message: 'Odalarda klima var mı?', hotel: 'Belvil', language: 'tr', category: 'room' },
    { message: 'Is there air conditioning in the room?', hotel: 'Belvil', language: 'en', category: 'room' },
    { message: 'Gibt es Klimaanlage im Zimmer?', hotel: 'Belvil', language: 'de', category: 'room' },
    { message: 'Odalarda kasa var mı?', hotel: 'Belvil', language: 'tr', category: 'room' },
    { message: 'Is there a safe in the room?', hotel: 'Belvil', language: 'en', category: 'room' },
    { message: 'Gibt es einen Safe im Zimmer?', hotel: 'Belvil', language: 'de', category: 'room' },
    // Pool
    { message: 'Havuz saat kaçta açılıyor?', hotel: 'Belvil', language: 'tr', category: 'facility' },
    { message: 'What time does the pool open?', hotel: 'Belvil', language: 'en', category: 'facility' },
    { message: 'Wann öffnet der Pool?', hotel: 'Belvil', language: 'de', category: 'facility' },
    { message: 'Havuzun derinliği nedir?', hotel: 'Belvil', language: 'tr', category: 'facility' },
    { message: 'What is the depth of the pool?', hotel: 'Belvil', language: 'en', category: 'facility' },
    { message: 'Wie tief ist der Pool?', hotel: 'Belvil', language: 'de', category: 'facility' },
    // Spa
    { message: 'Spa hizmetleri nelerdir?', hotel: 'Belvil', language: 'tr', category: 'facility' },
    { message: 'What are the spa services?', hotel: 'Belvil', language: 'en', category: 'facility' },
    { message: 'Welche Spa-Dienstleistungen gibt es?', hotel: 'Belvil', language: 'de', category: 'facility' },
    // Entertainment
    { message: 'Akşam eğlencesi var mı?', hotel: 'Belvil', language: 'tr', category: 'entertainment' },
    { message: 'Is there evening entertainment?', hotel: 'Belvil', language: 'en', category: 'entertainment' },
    { message: 'Gibt es Abendunterhaltung?', hotel: 'Belvil', language: 'de', category: 'entertainment' },
    // Price
    { message: 'Oda fiyatları nedir?', hotel: 'Belvil', language: 'tr', category: 'price' },
    { message: 'What are the room prices?', hotel: 'Belvil', language: 'en', category: 'price' },
    { message: 'Wie sind die Zimmerpreise?', hotel: 'Belvil', language: 'de', category: 'price' },
    // Transport
    { message: 'Havaalanına nasıl giderim?', hotel: 'Belvil', language: 'tr', category: 'transport' },
    { message: 'How do I get to the airport?', hotel: 'Belvil', language: 'en', category: 'transport' },
    { message: 'Wie komme ich zum Flughafen?', hotel: 'Belvil', language: 'de', category: 'transport' },
    // General
    { message: 'Check-in saati kaç?', hotel: 'Belvil', language: 'tr', category: 'general' },
    { message: 'What time is check-in?', hotel: 'Belvil', language: 'en', category: 'general' },
    { message: 'Wann ist Check-in?', hotel: 'Belvil', language: 'de', category: 'general' },
    { message: 'Check-out saati kaç?', hotel: 'Belvil', language: 'tr', category: 'general' },
    { message: 'What time is check-out?', hotel: 'Belvil', language: 'en', category: 'general' },
    { message: 'Wann ist Check-out?', hotel: 'Belvil', language: 'de', category: 'general' },
    // Zeugma ve Ayscha için aynı soruların varyasyonları (çeşitli oteller)
    ...[...Array(2)].flatMap((_, i) => [
        { message: 'Ana restoranın adı nedir?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'food' },
        { message: 'Odalarda yastık var mı?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'room' },
        { message: 'Havuz saat kaçta açılıyor?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'facility' },
        { message: 'Spa hizmetleri nelerdir?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'facility' },
        { message: 'Akşam eğlencesi var mı?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'entertainment' },
        { message: 'Oda fiyatları nedir?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'price' },
        { message: 'Havaalanına nasıl giderim?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'transport' },
        { message: 'Check-in saati kaç?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'general' },
        { message: 'Check-out saati kaç?', hotel: i === 0 ? 'Zeugma' : 'Ayscha', language: 'tr', category: 'general' },
    ]),
    // 50+ random, karışık, kısa ve uzun sorular
    ...Array.from({ length: 50 }, (_, i) => ({
        message: `Random test question number ${i + 1}`,
        hotel: ['Belvil', 'Zeugma', 'Ayscha'][i % 3],
        language: ['tr', 'en', 'de'][i % 3],
        category: ['food', 'room', 'facility', 'entertainment', 'price', 'transport', 'general'][i % 7]
    }))
];

async function runBigTest() {
    console.log('🚀 Büyük Test: 100+ soruluk NLP+AI hibrit gruplama başlatılıyor...');
    const result = await questionAnalytics.groupSimilarQuestions(testQuestions);
    console.log('🎯 Gruplama Sonucu:');
    result.forEach((group, idx) => {
        console.log(`\n--- Grup #${idx + 1} ---`);
        console.log('Temsili Soru:', group.question);
        console.log('Kategori:', group.category);
        console.log('Facility:', group.facility);
        console.log('Otel:', group.hotels);
        console.log('Diller:', group.languages);
        console.log('Soru Sayısı:', group.count);
        console.log('Yüzde:', group.percentage);
    });
    console.log(`\nToplam grup: ${result.length}`);
}

runBigTest().catch(console.error); 