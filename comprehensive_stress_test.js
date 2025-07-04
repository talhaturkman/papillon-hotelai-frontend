const axios = require('axios');

// Test konfigürasyonu
const BASE_URL = 'http://localhost:3000';
const TEST_LANGUAGES = ['tr', 'en', 'de', 'ru', 'ar'];
const HOTELS = ['belvil', 'zeugma', 'ayscha'];

// Test soruları - 100 soru
const TEST_QUESTIONS = [
    // === ÇEVİRİ SİSTEMİ TESTLERİ (20 soru) ===
    // Türkçe sorular
    { text: "Belvil otelinde havuz ne zaman açık?", language: "tr", category: "translation", expected: "pool" },
    { text: "Zeugma'da spa randevusu alabilir miyim?", language: "tr", category: "translation", expected: "spa" },
    { text: "Ayscha'da restoran rezervasyonu yapmak istiyorum", language: "tr", category: "translation", expected: "restaurant" },
    { text: "Belvil'de plaj şemsiyesi var mı?", language: "tr", category: "translation", expected: "beach" },
    { text: "Zeugma'da fitness salonu saatleri nedir?", language: "tr", category: "translation", expected: "gym" },
    
    // İngilizce sorular
    { text: "What time does the pool open at Belvil?", language: "en", category: "translation", expected: "pool" },
    { text: "Can I book a spa appointment at Zeugma?", language: "en", category: "translation", expected: "spa" },
    { text: "I want to make a restaurant reservation at Ayscha", language: "en", category: "translation", expected: "restaurant" },
    { text: "Are there beach umbrellas at Belvil?", language: "en", category: "translation", expected: "beach" },
    { text: "What are the gym hours at Zeugma?", language: "en", category: "translation", expected: "gym" },
    
    // Almanca sorular
    { text: "Wann öffnet das Schwimmbad in Belvil?", language: "de", category: "translation", expected: "pool" },
    { text: "Kann ich einen Spa-Termin in Zeugma buchen?", language: "de", category: "translation", expected: "spa" },
    { text: "Ich möchte eine Restaurant-Reservierung in Ayscha machen", language: "de", category: "translation", expected: "restaurant" },
    { text: "Gibt es Strandschirme in Belvil?", language: "de", category: "translation", expected: "beach" },
    { text: "Was sind die Fitnessstudio-Öffnungszeiten in Zeugma?", language: "de", category: "translation", expected: "gym" },
    
    // Rusça sorular
    { text: "Когда открывается бассейн в Белвиле?", language: "ru", category: "translation", expected: "pool" },
    { text: "Могу ли я забронировать спа в Зеугме?", language: "ru", category: "translation", expected: "spa" },
    { text: "Я хочу забронировать ресторан в Айше", language: "ru", category: "translation", expected: "restaurant" },
    { text: "Есть ли пляжные зонтики в Белвиле?", language: "ru", category: "translation", expected: "beach" },
    { text: "Какие часы работы спортзала в Зеугме?", language: "ru", category: "translation", expected: "gym" },

    // === GÜNLÜK BİLGİLER TESTLERİ (20 soru) ===
    { text: "Bugün Belvil'de ne var?", language: "tr", category: "daily", expected: "daily_info" },
    { text: "Zeugma'da bugünkü aktiviteler neler?", language: "tr", category: "daily", expected: "daily_info" },
    { text: "Ayscha'da bugün ne yapabilirim?", language: "tr", category: "daily", expected: "daily_info" },
    { text: "Belvil'de bugün hava nasıl?", language: "tr", category: "daily", expected: "daily_info" },
    { text: "Zeugma'da bugün özel bir etkinlik var mı?", language: "tr", category: "daily", expected: "daily_info" },
    
    { text: "What's happening at Belvil today?", language: "en", category: "daily", expected: "daily_info" },
    { text: "What are today's activities at Zeugma?", language: "en", category: "daily", expected: "daily_info" },
    { text: "What can I do at Ayscha today?", language: "en", category: "daily", expected: "daily_info" },
    { text: "How's the weather at Belvil today?", language: "en", category: "daily", expected: "daily_info" },
    { text: "Is there a special event at Zeugma today?", language: "en", category: "daily", expected: "daily_info" },
    
    { text: "Was passiert heute in Belvil?", language: "de", category: "daily", expected: "daily_info" },
    { text: "Was sind die heutigen Aktivitäten in Zeugma?", language: "de", category: "daily", expected: "daily_info" },
    { text: "Was kann ich heute in Ayscha machen?", language: "de", category: "daily", expected: "daily_info" },
    { text: "Wie ist das Wetter heute in Belvil?", language: "de", category: "daily", expected: "daily_info" },
    { text: "Gibt es heute eine besondere Veranstaltung in Zeugma?", language: "de", category: "daily", expected: "daily_info" },
    
    { text: "Что происходит сегодня в Белвиле?", language: "ru", category: "daily", expected: "daily_info" },
    { text: "Какие сегодня мероприятия в Зеугме?", language: "ru", category: "daily", expected: "daily_info" },
    { text: "Что я могу сделать сегодня в Айше?", language: "ru", category: "daily", expected: "daily_info" },
    { text: "Какая погода сегодня в Белвиле?", language: "ru", category: "daily", expected: "daily_info" },
    { text: "Есть ли сегодня особое мероприятие в Зеугме?", language: "ru", category: "daily", expected: "daily_info" },

    // === GENEL BİLGİLER TESTLERİ (20 soru) ===
    { text: "Belvil oteli hakkında genel bilgi", language: "tr", category: "general", expected: "general_info" },
    { text: "Zeugma'nın konumu nerede?", language: "tr", category: "general", expected: "general_info" },
    { text: "Ayscha'da kaç oda var?", language: "tr", category: "general", expected: "general_info" },
    { text: "Belvil'de internet var mı?", language: "tr", category: "general", expected: "general_info" },
    { text: "Zeugma'da otopark var mı?", language: "tr", category: "general", expected: "general_info" },
    
    { text: "General information about Belvil hotel", language: "en", category: "general", expected: "general_info" },
    { text: "Where is Zeugma located?", language: "en", category: "general", expected: "general_info" },
    { text: "How many rooms does Ayscha have?", language: "en", category: "general", expected: "general_info" },
    { text: "Is there internet at Belvil?", language: "en", category: "general", expected: "general_info" },
    { text: "Is there parking at Zeugma?", language: "en", category: "general", expected: "general_info" },
    
    { text: "Allgemeine Informationen über das Belvil Hotel", language: "de", category: "general", expected: "general_info" },
    { text: "Wo befindet sich Zeugma?", language: "de", category: "general", expected: "general_info" },
    { text: "Wie viele Zimmer hat Ayscha?", language: "de", category: "general", expected: "general_info" },
    { text: "Gibt es Internet in Belvil?", language: "de", category: "general", expected: "general_info" },
    { text: "Gibt es Parkplätze in Zeugma?", language: "de", category: "general", expected: "general_info" },
    
    { text: "Общая информация об отеле Белвил", language: "ru", category: "general", expected: "general_info" },
    { text: "Где находится Зеугма?", language: "ru", category: "general", expected: "general_info" },
    { text: "Сколько номеров в Айше?", language: "ru", category: "general", expected: "daily_info" },
    { text: "Есть ли интернет в Белвиле?", language: "ru", category: "general", expected: "general_info" },
    { text: "Есть ли парковка в Зеугме?", language: "ru", category: "general", expected: "general_info" },

    // === SPA KATALOG TESTLERİ (20 soru) ===
    { text: "Belvil'de spa hizmetleri neler?", language: "tr", category: "spa", expected: "spa_catalog" },
    { text: "Zeugma'da masaj türleri", language: "tr", category: "spa", expected: "spa_catalog" },
    { text: "Ayscha'da spa fiyatları", language: "tr", category: "spa", expected: "spa_catalog" },
    { text: "Belvil'de spa randevu nasıl alınır?", language: "tr", category: "spa", expected: "spa_catalog" },
    { text: "Zeugma'da spa paketleri", language: "tr", category: "spa", expected: "spa_catalog" },
    
    { text: "What spa services are available at Belvil?", language: "en", category: "spa", expected: "spa_catalog" },
    { text: "Types of massage at Zeugma", language: "en", category: "spa", expected: "spa_catalog" },
    { text: "Spa prices at Ayscha", language: "en", category: "spa", expected: "spa_catalog" },
    { text: "How to book spa at Belvil?", language: "en", category: "spa", expected: "spa_catalog" },
    { text: "Spa packages at Zeugma", language: "en", category: "spa", expected: "spa_catalog" },
    
    { text: "Welche Spa-Dienstleistungen gibt es in Belvil?", language: "de", category: "spa", expected: "spa_catalog" },
    { text: "Massagearten in Zeugma", language: "de", category: "spa", expected: "spa_catalog" },
    { text: "Spa-Preise in Ayscha", language: "de", category: "spa", expected: "spa_catalog" },
    { text: "Wie buche ich Spa in Belvil?", language: "de", category: "spa", expected: "spa_catalog" },
    { text: "Spa-Pakete in Zeugma", language: "de", category: "spa", expected: "spa_catalog" },
    
    { text: "Какие спа-услуги доступны в Белвиле?", language: "ru", category: "spa", expected: "spa_catalog" },
    { text: "Виды массажа в Зеугме", language: "ru", category: "spa", expected: "spa_catalog" },
    { text: "Цены на спа в Айше", language: "ru", category: "spa", expected: "spa_catalog" },
    { text: "Как забронировать спа в Белвиле?", language: "ru", category: "spa", expected: "spa_catalog" },
    { text: "Спа-пакеты в Зеугме", language: "ru", category: "spa", expected: "spa_catalog" },

    // === F&B BİLGİLERİ TESTLERİ (20 soru) ===
    { text: "Belvil'de restoran menüsü", language: "tr", category: "f&b", expected: "f&b_info" },
    { text: "Zeugma'da kahvaltı saatleri", language: "tr", category: "f&b", expected: "f&b_info" },
    { text: "Ayscha'da akşam yemeği rezervasyonu", language: "tr", category: "f&b", expected: "f&b_info" },
    { text: "Belvil'de bar hizmetleri", language: "tr", category: "f&b", expected: "f&b_info" },
    { text: "Zeugma'da özel diyet menüleri", language: "tr", category: "f&b", expected: "f&b_info" },
    
    { text: "Restaurant menu at Belvil", language: "en", category: "f&b", expected: "f&b_info" },
    { text: "Breakfast hours at Zeugma", language: "en", category: "f&b", expected: "f&b_info" },
    { text: "Dinner reservation at Ayscha", language: "en", category: "f&b", expected: "f&b_info" },
    { text: "Bar services at Belvil", language: "en", category: "f&b", expected: "f&b_info" },
    { text: "Special diet menus at Zeugma", language: "en", category: "f&b", expected: "f&b_info" },
    
    { text: "Restaurant-Menü in Belvil", language: "de", category: "f&b", expected: "f&b_info" },
    { text: "Frühstückszeiten in Zeugma", language: "de", category: "f&b", expected: "f&b_info" },
    { text: "Abendessen-Reservierung in Ayscha", language: "de", category: "f&b", expected: "f&b_info" },
    { text: "Bar-Services in Belvil", language: "de", category: "f&b", expected: "f&b_info" },
    { text: "Spezielle Diät-Menüs in Zeugma", language: "de", category: "f&b", expected: "f&b_info" },
    
    { text: "Меню ресторана в Белвиле", language: "ru", category: "f&b", expected: "f&b_info" },
    { text: "Часы завтрака в Зеугме", language: "ru", category: "f&b", expected: "f&b_info" },
    { text: "Бронирование ужина в Айше", language: "ru", category: "f&b", expected: "f&b_info" },
    { text: "Бар-услуги в Белвиле", language: "ru", category: "f&b", expected: "f&b_info" },
    { text: "Специальные диетические меню в Зеугме", language: "ru", category: "f&b", expected: "f&b_info" }
];

// Canlı destek testleri (20 soru)
const LIVE_SUPPORT_QUESTIONS = [
    { text: "Belvil canlı destek", language: "tr", category: "live_support", expected: "live_support" },
    { text: "Zeugma canlı destek", language: "tr", category: "live_support", expected: "live_support" },
    { text: "Ayscha canlı destek", language: "tr", category: "live_support", expected: "live_support" },
    { text: "Belvil live support", language: "en", category: "live_support", expected: "live_support" },
    { text: "Zeugma live support", language: "en", category: "live_support", expected: "live_support" },
    { text: "Ayscha live support", language: "en", category: "live_support", expected: "live_support" },
    { text: "Belvil Live-Support", language: "de", category: "live_support", expected: "live_support" },
    { text: "Zeugma Live-Support", language: "de", category: "live_support", expected: "live_support" },
    { text: "Ayscha Live-Support", language: "de", category: "live_support", expected: "live_support" },
    { text: "Белвил живая поддержка", language: "ru", category: "live_support", expected: "live_support" },
    { text: "Зеугма живая поддержка", language: "ru", category: "live_support", expected: "live_support" },
    { text: "Айша живая поддержка", language: "ru", category: "live_support", expected: "live_support" },
    { text: "Belvil yardım", language: "tr", category: "live_support", expected: "live_support" },
    { text: "Zeugma yardım", language: "tr", category: "live_support", expected: "live_support" },
    { text: "Ayscha yardım", language: "tr", category: "live_support", expected: "live_support" },
    { text: "Belvil help", language: "en", category: "live_support", expected: "live_support" },
    { text: "Zeugma help", language: "en", category: "live_support", expected: "live_support" },
    { text: "Ayscha help", language: "en", category: "live_support", expected: "live_support" },
    { text: "Belvil Hilfe", language: "de", category: "live_support", expected: "live_support" },
    { text: "Zeugma Hilfe", language: "de", category: "live_support", expected: "live_support" },
    { text: "Ayscha Hilfe", language: "de", category: "live_support", expected: "live_support" }
];

// Tüm test sorularını birleştir
const ALL_QUESTIONS = [...TEST_QUESTIONS, ...LIVE_SUPPORT_QUESTIONS].slice(0, 20);

// Test sonuçları
let results = {
    total: 0,
    successful: 0,
    failed: 0,
    categories: {
        translation: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        daily: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        general: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        spa: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        'f&b': { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        live_support: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 }
    },
    languages: {
        tr: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        en: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        de: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        ru: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 },
        ar: { total: 0, successful: 0, failed: 0, avgResponseTime: 0 }
    },
    responseTimes: [],
    errors: []
};

// Normalizasyon fonksiyonu (küçük harf, Türkçe karakter, boşluk)
function normalize(str) {
    return str
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ş/g, 's')
        .replace(/ç/g, 'c')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ğ/g, 'g')
        .replace(/[^a-z0-9: -]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Test fonksiyonu
async function runTest(question, index) {
    const startTime = Date.now();
    
    try {
        console.log(`\n[${index + 1}/120] Testing: "${question.text}" (${question.language})`);
        
        const response = await axios.post(`${BASE_URL}/api/chat`, {
            message: question.text,
            language: question.language,
            sessionId: `stress-test-${Date.now()}-${index}`
        }, {
            timeout: 30000 // 30 saniye timeout
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const success = response.data && response.data.success;
        // Esnek anahtar kelime kontrolü
        let hasRelevantContent = false;
        if (response.data && response.data.response && question.expected) {
            const answerNorm = normalize(response.data.response);
            // Virgül veya / ile ayrılmış birden fazla expected anahtar kelimeyi destekle
            const expectedKeywords = question.expected.split(/[,/]/).map(e => normalize(e));
            hasRelevantContent = expectedKeywords.some(keyword => keyword && answerNorm.includes(keyword));
            // Saat aralığı kontrolü (örn. 07:00-19:00 gibi)
            const hourRegex = /([01]?\d|2[0-3]):[0-5]\d\s*-\s*([01]?\d|2[0-3]):[0-5]\d/;
            if (!hasRelevantContent && hourRegex.test(question.expected)) {
                const match = answerNorm.match(hourRegex);
                if (match && normalize(question.expected).includes(match[0])) {
                    hasRelevantContent = true;
                }
            }
        }
        
        // Sonuçları kaydet
        results.total++;
        results.responseTimes.push(responseTime);
        
        if (success && hasRelevantContent) {
            results.successful++;
            results.categories[question.category].successful++;
            results.languages[question.language].successful++;
        } else {
            results.failed++;
            results.categories[question.category].failed++;
            results.languages[question.language].failed++;
            results.errors.push({
                question: question.text,
                language: question.language,
                category: question.category,
                response: response.data?.response || 'No response',
                expected: question.expected
            });
        }
        
        results.categories[question.category].total++;
        results.languages[question.language].total++;
        
        // Ortalama response time güncelle
        const category = results.categories[question.category];
        category.avgResponseTime = (category.avgResponseTime * (category.total - 1) + responseTime) / category.total;
        
        const language = results.languages[question.language];
        language.avgResponseTime = (language.avgResponseTime * (language.total - 1) + responseTime) / language.total;
        
        console.log(`✅ Response time: ${responseTime}ms | Success: ${success && hasRelevantContent}`);
        
        return { success: success && hasRelevantContent, responseTime };
        
    } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        results.total++;
        results.failed++;
        results.responseTimes.push(responseTime);
        results.categories[question.category].failed++;
        results.languages[question.language].failed++;
        results.categories[question.category].total++;
        results.languages[question.language].total++;
        
        results.errors.push({
            question: question.text,
            language: question.language,
            category: question.category,
            error: error.message,
            expected: question.expected
        });
        
        console.log(`❌ Error: ${error.message} | Response time: ${responseTime}ms`);
        return { success: false, responseTime };
    }
}

// Ana test fonksiyonu
async function runStressTest() {
    console.log('🚀 Starting Comprehensive Stress Test...');
    console.log(`📊 Total questions: ${ALL_QUESTIONS.length}`);
    console.log(`🌍 Languages: ${TEST_LANGUAGES.join(', ')}`);
    console.log(`🏨 Hotels: ${HOTELS.join(', ')}`);
    console.log('=' * 60);
    
    const startTime = Date.now();
    
    // Testleri sırayla çalıştır
    for (let i = 0; i < ALL_QUESTIONS.length; i++) {
        await runTest(ALL_QUESTIONS[i], i);
        
        // Her 10 soruda bir ilerleme göster
        if ((i + 1) % 10 === 0) {
            console.log(`\n📈 Progress: ${i + 1}/${ALL_QUESTIONS.length} completed`);
        }
        
        // Rate limiting - her soru arasında 500ms bekle
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const totalTime = Date.now() - startTime;
    
    // Sonuçları analiz et ve raporla
    generateReport(totalTime);
}

// Rapor oluştur
function generateReport(totalTime) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE STRESS TEST RESULTS');
    console.log('='.repeat(60));
    
    // Genel istatistikler
    const successRate = (results.successful / results.total * 100).toFixed(2);
    const avgResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
    

}

runStressTest().catch(console.error);