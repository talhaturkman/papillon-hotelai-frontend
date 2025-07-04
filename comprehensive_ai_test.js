const axios = require('axios');
const fs = require('fs');

// Test konfigürasyonu
const CONFIG = {
    baseURL: 'http://localhost:5002',
    testCount: 100,
    concurrentRequests: 5,
    timeout: 30000,
    outputFile: 'stress_test_results.log'
};

// Test kategorileri ve soruları
const TEST_CATEGORIES = {
    // 1. Çeviri Testleri (15 soru)
    translation: [
        "Hello, how are you?",
        "Hallo, wie geht es Ihnen?",
        "Здравствуйте, как дела?",
        "Merhaba, nasılsınız?",
        "Where is the restaurant?",
        "Wo ist das Restaurant?",
        "Где ресторан?",
        "Restoran nerede?",
        "Thank you very much",
        "Vielen Dank",
        "Большое спасибо",
        "Çok teşekkürler",
        "Goodbye",
        "Auf Wiedersehen",
        "До свидания"
    ],

    // 2. Günlük Bilgi Testleri (15 soru)
    dailyInfo: [
        "Bugün hava nasıl?",
        "What's the weather today?",
        "Wie ist das Wetter heute?",
        "Какая погода сегодня?",
        "Bugün ne yapabilirim?",
        "What can I do today?",
        "Was kann ich heute machen?",
        "Что я могу сделать сегодня?",
        "Bugün özel bir etkinlik var mı?",
        "Is there a special event today?",
        "Gibt es heute ein besonderes Event?",
        "Есть ли сегодня особое мероприятие?",
        "Bugünün menüsü nedir?",
        "What's today's menu?",
        "Was ist das heutige Menü?"
    ],

    // 3. Spa Kataloğu Testleri (15 soru)
    spaCatalog: [
        "Spa'da hangi hizmetler var?",
        "What services are available at the spa?",
        "Welche Dienstleistungen bietet das Spa?",
        "Какие услуги доступны в спа?",
        "Masaj fiyatları nedir?",
        "What are the massage prices?",
        "Was kosten die Massagen?",
        "Сколько стоят массажи?",
        "Spa randevu alabilir miyim?",
        "Can I book a spa appointment?",
        "Kann ich einen Spa-Termin buchen?",
        "Могу ли я забронировать спа?",
        "Spa saatleri nedir?",
        "What are the spa hours?",
        "Welche Öffnungszeiten hat das Spa?"
    ],

    // 4. F&B (Food & Beverage) Testleri (15 soru)
    foodBeverage: [
        "Kahvaltı saatleri nedir?",
        "What are the breakfast hours?",
        "Wann ist das Frühstück?",
        "Когда завтрак?",
        "Restoran menüsü nedir?",
        "What's the restaurant menu?",
        "Was ist die Restaurantkarte?",
        "Какое меню в ресторане?",
        "Bar açık mı?",
        "Is the bar open?",
        "Ist die Bar geöffnet?",
        "Бар открыт?",
        "Room service var mı?",
        "Is there room service?",
        "Gibt es Zimmerdienst?"
    ],

    // 5. Genel Bilgi Testleri (15 soru)
    generalInfo: [
        "Wi-Fi şifresi nedir?",
        "What's the Wi-Fi password?",
        "Was ist das WLAN-Passwort?",
        "Какой пароль от Wi-Fi?",
        "Oda temizliği ne zaman?",
        "When is room cleaning?",
        "Wann ist die Zimmerreinigung?",
        "Когда уборка номера?",
        "Check-out saati nedir?",
        "What's the check-out time?",
        "Wann ist Check-out?",
        "Когда выезд?",
        "Otel kuralları nelerdir?",
        "What are the hotel rules?",
        "Welche Hotelregeln gibt es?"
    ],

    // 6. Konum Bilgisi Testleri (15 soru)
    locationInfo: [
        "En yakın hastane nerede?",
        "Where is the nearest hospital?",
        "Wo ist das nächste Krankenhaus?",
        "Где ближайшая больница?",
        "Plaj ne kadar uzakta?",
        "How far is the beach?",
        "Wie weit ist der Strand?",
        "Как далеко пляж?",
        "Şehir merkezi nerede?",
        "Where is the city center?",
        "Wo ist das Stadtzentrum?",
        "Где центр города?",
        "Havaalanına ne kadar sürer?",
        "How long to the airport?",
        "Wie lange zum Flughafen?"
    ],

    // 7. Canlı Destek Testleri (10 soru)
    liveSupport: [
        "Yardım istiyorum",
        "I need help",
        "Ich brauche Hilfe",
        "Мне нужна помощь",
        "Bir sorunum var",
        "I have a problem",
        "Ich habe ein Problem",
        "У меня проблема",
        "Müşteri hizmetleri",
        "Customer service"
    ]
};

// Test sonuçları
let testResults = {
    totalTests: 0,
    successfulTests: 0,
    failedTests: 0,
    averageResponseTime: 0,
    categoryResults: {},
    errors: []
};

// Test fonksiyonu
async function runTest(question, category, testNumber) {
    const startTime = Date.now();
    
    try {
        const response = await axios.post(`${CONFIG.baseURL}/api/chat`, {
            message: question,
            session_id: `test-${category}-${testNumber}`,
            hotel: 'Belvil',
            language: 'tr'
        }, {
            timeout: CONFIG.timeout
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        return {
            success: response.data.success,
            responseTime,
            category,
            question,
            testNumber,
            error: null
        };

    } catch (error) {
        return {
            success: false,
            responseTime: 0,
            category,
            question,
            testNumber,
            error: error.message
        };
    }
}

// Ana test fonksiyonu
async function runComprehensiveTest() {
    console.log('🚀 Kapsamlı AI Test Başlatılıyor...\n');
    console.log(`📊 Toplam Test Sayısı: ${CONFIG.testCount}\n`);

    const allTests = [];
    let testCounter = 0;

    // Tüm kategorilerden soruları topla
    for (const [category, questions] of Object.entries(TEST_CATEGORIES)) {
        for (const question of questions) {
            if (testCounter < CONFIG.testCount) {
                allTests.push({ question, category, testNumber: testCounter + 1 });
                testCounter++;
            }
        }
    }

    // Testleri çalıştır
    const results = [];
    for (let i = 0; i < allTests.length; i += CONFIG.concurrentRequests) {
        const batch = allTests.slice(i, i + CONFIG.concurrentRequests);
        const batchPromises = batch.map(test => 
            runTest(test.question, test.category, test.testNumber)
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Progress göster
        console.log(`📈 İlerleme: ${Math.min(i + CONFIG.concurrentRequests, allTests.length)}/${allTests.length}`);
    }

    // Sonuçları analiz et
    analyzeResults(results);
}

// Sonuç analizi
function analyzeResults(results) {
    console.log('\n📊 Test Sonuçları Analizi\n');

    // Genel istatistikler
    testResults.totalTests = results.length;
    testResults.successfulTests = results.filter(r => r.success).length;
    testResults.failedTests = results.filter(r => !r.success).length;
    
    const responseTimes = results.filter(r => r.success).map(r => r.responseTime);
    testResults.averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

    // Kategori bazlı sonuçlar
    for (const result of results) {
        if (!testResults.categoryResults[result.category]) {
            testResults.categoryResults[result.category] = {
                total: 0,
                successful: 0,
                failed: 0,
                averageResponseTime: 0,
                responseTimes: []
            };
        }

        const category = testResults.categoryResults[result.category];
        category.total++;
        
        if (result.success) {
            category.successful++;
            category.responseTimes.push(result.responseTime);
  } else {
            category.failed++;
            testResults.errors.push({
                category: result.category,
                question: result.question,
                error: result.error
            });
        }
    }

    // Kategori ortalamalarını hesapla
    for (const category in testResults.categoryResults) {
        const cat = testResults.categoryResults[category];
        cat.averageResponseTime = cat.responseTimes.length > 0 
            ? cat.responseTimes.reduce((a, b) => a + b, 0) / cat.responseTimes.length 
            : 0;
    }

    // Sonuçları yazdır
    printResults();
    
    // Dosyaya kaydet
    saveResults();
}

// Sonuçları yazdır
function printResults() {
    console.log('🎯 GENEL SONUÇLAR');
    console.log('==================');
    console.log(`📊 Toplam Test: ${testResults.totalTests}`);
    console.log(`✅ Başarılı: ${testResults.successfulTests}`);
    console.log(`❌ Başarısız: ${testResults.failedTests}`);
    console.log(`📈 Başarı Oranı: ${((testResults.successfulTests / testResults.totalTests) * 100).toFixed(2)}%`);
    console.log(`⏱️ Ortalama Yanıt Süresi: ${testResults.averageResponseTime.toFixed(2)}ms`);
    console.log('');

    console.log('📋 KATEGORİ BAZLI SONUÇLAR');
    console.log('==========================');
    
    for (const [category, results] of Object.entries(testResults.categoryResults)) {
        const successRate = ((results.successful / results.total) * 100).toFixed(2);
        console.log(`\n${getCategoryEmoji(category)} ${category.toUpperCase()}`);
        console.log(`   📊 Toplam: ${results.total}`);
        console.log(`   ✅ Başarılı: ${results.successful}`);
        console.log(`   ❌ Başarısız: ${results.failed}`);
        console.log(`   📈 Başarı Oranı: ${successRate}%`);
        console.log(`   ⏱️ Ortalama Süre: ${results.averageResponseTime.toFixed(2)}ms`);
    }

    // Hataları göster
    if (testResults.errors.length > 0) {
        console.log('\n❌ HATALAR');
        console.log('==========');
        testResults.errors.slice(0, 5).forEach(error => {
            console.log(`   ${error.category}: "${error.question}" - ${error.error}`);
        });
        if (testResults.errors.length > 5) {
            console.log(`   ... ve ${testResults.errors.length - 5} hata daha`);
        }
    }

    // Puanlama
    console.log('\n🏆 SİSTEM PUANLAMASI (10/10)');
    console.log('============================');
    const scores = calculateScores();
    for (const [aspect, score] of Object.entries(scores)) {
        console.log(`${getScoreEmoji(score)} ${aspect}: ${score}/10`);
    }
}

// Kategori emoji
function getCategoryEmoji(category) {
    const emojis = {
        translation: '🌐',
        dailyInfo: '📅',
        spaCatalog: '💆',
        foodBeverage: '🍽️',
        generalInfo: 'ℹ️',
        locationInfo: '📍',
        liveSupport: '🆘'
    };
    return emojis[category] || '📋';
}

// Puan emoji
function getScoreEmoji(score) {
    if (score >= 9) return '🟢';
    if (score >= 7) return '🟡';
    if (score >= 5) return '🟠';
    return '🔴';
}

// Puanlama hesaplama
function calculateScores() {
    const scores = {};
    
    // Genel performans
    const overallSuccessRate = (testResults.successfulTests / testResults.totalTests) * 100;
    scores['Genel Performans'] = Math.min(10, (overallSuccessRate / 10));
    
    // Yanıt süresi (5 saniye altı ideal)
    const responseTimeScore = Math.max(0, 10 - (testResults.averageResponseTime / 500));
    scores['Yanıt Hızı'] = Math.min(10, responseTimeScore);
    
    // Kategori bazlı puanlar
    const categoryScores = [];
    for (const [category, results] of Object.entries(testResults.categoryResults)) {
        const successRate = (results.successful / results.total) * 100;
        categoryScores.push(successRate);
    }
    
    const avgCategoryScore = categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length;
    scores['Kategori Desteği'] = Math.min(10, avgCategoryScore / 10);
    
    // Hata oranı
    const errorRate = (testResults.failedTests / testResults.totalTests) * 100;
    scores['Hata Toleransı'] = Math.max(0, 10 - errorRate);
    
    // Çok dilli destek (translation kategorisi)
    const translationCategory = testResults.categoryResults.translation;
    if (translationCategory) {
        const translationScore = (translationCategory.successful / translationCategory.total) * 100;
        scores['Çok Dilli Destek'] = Math.min(10, translationScore / 10);
    } else {
        scores['Çok Dilli Destek'] = 0;
    }
    
    return scores;
}

// Sonuçları dosyaya kaydet
function saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test_results_${timestamp}.json`;
    
    const dataToSave = {
        timestamp: new Date().toISOString(),
        config: CONFIG,
        results: testResults,
        scores: calculateScores()
    };
    
    fs.writeFileSync(filename, JSON.stringify(dataToSave, null, 2));
    console.log(`\n💾 Sonuçlar kaydedildi: ${filename}`);
}

// Testi başlat
runComprehensiveTest().catch(console.error);
