const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const TEST_FILE = './test-otelai-100.json';
const API_URL = 'http://localhost:5002/api/analytics/top-questions';
const CHAT_URL = 'http://localhost:5002/api/chat/';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBenchmark() {
    const questions = JSON.parse(fs.readFileSync(TEST_FILE, 'utf8'));
    console.log(`🧪 ${questions.length} soruluk test başlatılıyor...`);

    // 1. Her soruyu sisteme ekle
    for (const q of questions) {
        const res = await fetch(CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: q.text, language: q.language })
        });
        if (!res.ok) {
            let errText = await res.text();
            console.error('❌ Soru eklenemedi:', q.text, res.status, res.statusText, '| Response:', errText);
        }
        await sleep(200); // Her istek arasında bekle
    }
    console.log('✅ Tüm sorular sisteme eklendi. Analiz başlatılıyor...');

    // 2. Analytics endpointinden grupları çek
    const res = await fetch(API_URL);
    if (!res.ok) {
        console.error('❌ API yanıtı alınamadı:', res.status, res.statusText);
        process.exit(1);
    }
    const data = await res.json();
    if (!data.questions) {
        console.error('❌ API yanıtında questions yok!');
        process.exit(1);
    }
    const groups = data.questions;
    console.log(`📊 ${groups.length} grup bulundu.`);

    // 3. Her sorunun doğru grupta olup olmadığını, kategori ve intent tespitini kontrol et
    let intentScore = 0, groupingScore = 0, languageScore = 0, infoScore = 0;
    let total = questions.length;
    let unmatched = 0;
    let groupMap = {};

    // Grupları başlığa göre haritalandır
    groups.forEach(g => {
        groupMap[g.question.toLowerCase().replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ ]/g, '').trim()] = g;
    });

    for (const q of questions) {
        // Soru başlığına en yakın grubu bul
        let found = false;
        for (const key in groupMap) {
            if (key.includes(q.text.toLowerCase().split(' ')[0])) {
                found = true;
                break;
            }
        }
        if (found) groupingScore++;
        else unmatched++;
    }

    // Kategori ve intent tespiti için örnek gruplardan kontrol
    for (const g of groups) {
        if (g.category && g.category !== 'general') intentScore++;
        if (g.languages && g.languages.length > 1) languageScore++;
        if (g.facility || g.hotels.length > 0) infoScore++;
    }

    // 10 üzerinden puanla
    const score = x => Math.round((x / total) * 10 * 10) / 10;
    console.log('\n==== SONUÇLAR ====');
    console.log(`Gruplama Başarısı: ${score(groupingScore)} / 10`);
    console.log(`Niyet/Kategori Tespiti: ${score(intentScore)} / 10`);
    console.log(`Çok Dilli Gruplama: ${score(languageScore)} / 10`);
    console.log(`Otel Bilgisi & Olanaklar: ${score(infoScore)} / 10`);
    console.log(`Eşleşmeyen Soru Sayısı: ${unmatched}`);

    // Güçlü ve zayıf alanları özetle
    console.log('\nGüçlü Alanlar:');
    if (score(groupingScore) > 7) console.log('- Çok dilli gruplama ve başlık eşleştirme iyi');
    if (score(intentScore) > 7) console.log('- Niyet/kategori tespiti başarılı');
    if (score(languageScore) > 7) console.log('- Farklı dillerde benzer sorular iyi gruplanıyor');
    if (score(infoScore) > 7) console.log('- Otel bilgisi ve olanaklar doğru gruplarda');

    console.log('\nGeliştirilebilecek Alanlar:');
    if (score(groupingScore) <= 7) console.log('- Gruplama algoritması daha da iyileştirilebilir');
    if (score(intentScore) <= 7) console.log('- Niyet/kategori tespiti daha hassas olabilir');
    if (score(languageScore) <= 7) console.log('- Çok dilli gruplama için threshold veya embedding ayarı gözden geçirilmeli');
    if (score(infoScore) <= 7) console.log('- Otel bilgisi/olanaklar için ek veri gerekebilir');
}

runBenchmark(); 