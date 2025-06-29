const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:5002/api/chat/message';

// Kategorize edilmiş test soruları
const testCategories = {
    'Otel-Tanıma': [
        'Ben Belvil\'de kalıyorum, yardım eder misiniz?',
        'Zeugma\'da konaklıyorum, bilgi istiyorum',
        'Ayscha otelindeyim, sorularım var',
        'I\'m staying at Belvil hotel',
        'We are guests at Zeugma',
        'From Papillon Ayscha'
    ],
    'Restoran': [
        'Restoran bilgileri verebilir misiniz?',
        'Kaç restoran mevcut?',
        'Ana restoran saatleri nedir?',
        'A la carte restoranlar var mı?',
        'Çocuk menüsü bulunuyor mu?',
        'Vegan seçenekler mevcut mu?',
        'Beach restaurant available?',
        'Room service hours?'
    ],
    'SPA-Wellness': [
        'SPA saatleri nedir?',
        'Masaj fiyatları nasıl?',
        'Türk hamamı var mı?',
        'Sauna ücretsiz mi?',
        'Fitness merkezi mevcut mu?',
        'Yoga classes available?',
        'Personal trainer service?'
    ],
    'Havuz': [
        'Kaç havuz bulunuyor?',
        'Havuz açılış saatleri?',
        'Aquapark mevcut mu?',
        'Çocuk havuzu var mı?',
        'Indoor pool available?',
        'Pool bar service?',
        'Water slides?'
    ],
    'Aktivite': [
        'Hangi aktiviteler var?',
        'Gece eğlenceleri neler?',
        'Çocuk kulübü mevcut mu?',
        'Spor aktiviteleri?',
        'Live music events?',
        'Animation team?',
        'Night club?'
    ],
    'Konum': [
        'Havaalanına uzaklık?',
        'Şehir merkezine mesafe?',
        'Transfer hizmeti var mı?',
        'Yakın alışveriş merkezi?',
        'Hospital nearby?',
        'Taxi service?'
    ],
    'Dil-Karışımı': [
        'Hello, restaurant information please',
        'Guten Tag, Pool Öffnungszeiten?',
        'Spa services available?',
        'Welche Aktivitäten gibt es?',
        'Pool opening hours?',
        'Restaurant Informationen bitte'
    ],
    'Karmaşık': [
        'Yarın ailecek spa\'ya gitmek istiyoruz, 4 kişi için masaj rezervasyonu nasıl yapabiliriz?',
        'Çocuğum 10 yaşında, hangi aktivitelere katılabilir?',
        'All inclusive paketimizde hangi restoranlar dahil?',
        'Beach access ve private beach bilgileri?'
    ],
    'Edge-Cases': [
        'abc123',
        '',
        'çok çok çok uzun soru çok çok uzun soru çok çok uzun soru',
        'Ben Mars\'ta kalıyorum',
        'Papillon Hilton\'dayım'
    ]
};

class DetailedTestRunner {
    constructor() {
        this.results = {};
        this.overallStats = {
            totalQuestions: 0,
            successCount: 0,
            failedCount: 0,
            totalTime: 0,
            startTime: Date.now()
        };
    }

    async runCategoryTest(categoryName, questions) {
        console.log(`\n🧪 KATEGORİ: ${categoryName} (${questions.length} soru)`);
        console.log('=' .repeat(50));
        
        const categoryResults = {
            questions: [],
            successCount: 0,
            failedCount: 0,
            totalTime: 0,
            hotelDetections: 0,
            avgResponseLength: 0
        };

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const startTime = Date.now();
            
            console.log(`[${i + 1}/${questions.length}] "${question}"`);
            
            try {
                const response = await axios.post(API_URL, {
                    message: question,
                    sessionId: `test_${categoryName}_${Date.now()}`
                }, { timeout: 10000 });

                const responseTime = Date.now() - startTime;
                categoryResults.totalTime += responseTime;

                if (response.data.success) {
                    const aiResponse = response.data.response;
                    categoryResults.successCount++;
                    categoryResults.avgResponseLength += aiResponse.length;

                    // Hotel detection check
                    if (aiResponse.includes('Belvil') || aiResponse.includes('Zeugma') || aiResponse.includes('Ayscha')) {
                        categoryResults.hotelDetections++;
                    }

                    const shortResponse = aiResponse.length > 80 
                        ? aiResponse.substring(0, 80) + '...'
                        : aiResponse;
                    
                    console.log(`✅ OK (${responseTime}ms): ${shortResponse}`);

                    categoryResults.questions.push({
                        question,
                        response: aiResponse,
                        success: true,
                        responseTime,
                        responseLength: aiResponse.length
                    });
                } else {
                    categoryResults.failedCount++;
                    console.log(`❌ FAILED: ${response.data.error}`);
                    
                    categoryResults.questions.push({
                        question,
                        response: response.data.error,
                        success: false,
                        responseTime
                    });
                }
            } catch (error) {
                const responseTime = Date.now() - startTime;
                categoryResults.failedCount++;
                categoryResults.totalTime += responseTime;
                
                console.log(`❌ ERROR (${responseTime}ms): ${error.message}`);
                
                categoryResults.questions.push({
                    question,
                    response: error.message,
                    success: false,
                    responseTime
                });
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Calculate averages
        categoryResults.avgResponseTime = Math.round(categoryResults.totalTime / questions.length);
        categoryResults.avgResponseLength = Math.round(categoryResults.avgResponseLength / Math.max(categoryResults.successCount, 1));
        categoryResults.successRate = ((categoryResults.successCount / questions.length) * 100).toFixed(1);

        this.results[categoryName] = categoryResults;

        // Update overall stats
        this.overallStats.totalQuestions += questions.length;
        this.overallStats.successCount += categoryResults.successCount;
        this.overallStats.failedCount += categoryResults.failedCount;
        this.overallStats.totalTime += categoryResults.totalTime;

        console.log(`📊 Kategori Sonucu: ${categoryResults.successCount}/${questions.length} başarılı (%${categoryResults.successRate})`);
        console.log(`⚡ Ortalama Yanıt: ${categoryResults.avgResponseTime}ms`);
        console.log(`🏨 Otel Algılama: ${categoryResults.hotelDetections} kez`);
    }

    async runFullTest() {
        console.log('🚀 DETAYLI AI PERFORMANS ANALİZİ');
        console.log('=' .repeat(80));
        console.log(`📋 ${Object.keys(testCategories).length} kategori, ${Object.values(testCategories).flat().length} toplam soru`);
        console.log('⏳ Tahmini süre: 10-30 dakika\n');

        for (const [categoryName, questions] of Object.entries(testCategories)) {
            await this.runCategoryTest(categoryName, questions);
        }

        this.generateFinalReport();
    }

    generateFinalReport() {
        const totalTestTime = Date.now() - this.overallStats.startTime;
        const overallSuccessRate = ((this.overallStats.successCount / this.overallStats.totalQuestions) * 100).toFixed(1);
        const avgResponseTime = Math.round(this.overallStats.totalTime / this.overallStats.totalQuestions);

        console.log('\n' + '='.repeat(80));
        console.log('🏆 DETAYLI TEST RAPORU');
        console.log('='.repeat(80));
        console.log(`📊 Genel İstatistikler:`);
        console.log(`   • Toplam Soru: ${this.overallStats.totalQuestions}`);
        console.log(`   • Başarılı: ${this.overallStats.successCount} (%${overallSuccessRate})`);
        console.log(`   • Başarısız: ${this.overallStats.failedCount}`);
        console.log(`   • Ortalama Yanıt: ${avgResponseTime}ms`);
        console.log(`   • Toplam Test Süresi: ${Math.round(totalTestTime / 1000)} saniye`);

        console.log('\n📋 KATEGORİ BAZLI PERFORMANS:');
        for (const [categoryName, results] of Object.entries(this.results)) {
            console.log(`${categoryName.padEnd(15)}: ${results.successCount}/${results.questions.length} (%${results.successRate}) - ${results.avgResponseTime}ms - ${results.hotelDetections} otel algılama`);
        }

        // En başarılı ve en sorunlu kategoriler
        const categoryPerformance = Object.entries(this.results)
            .map(([name, data]) => ({ name, successRate: parseFloat(data.successRate) }))
            .sort((a, b) => b.successRate - a.successRate);

        console.log('\n🏆 EN BAŞARILI KATEGORİLER:');
        categoryPerformance.slice(0, 3).forEach((cat, i) => {
            console.log(`${i + 1}. ${cat.name}: %${cat.successRate}`);
        });

        console.log('\n⚠️ EN SORUNLU KATEGORİLER:');
        categoryPerformance.slice(-3).reverse().forEach((cat, i) => {
            console.log(`${i + 1}. ${cat.name}: %${cat.successRate}`);
        });

        // Detailed JSON report
        const reportData = {
            timestamp: new Date().toISOString(),
            overallStats: this.overallStats,
            categoryResults: this.results,
            categoryPerformance
        };

        const reportFileName = `ai_performance_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        fs.writeFileSync(reportFileName, JSON.stringify(reportData, null, 2));

        console.log(`\n💾 Detaylı rapor kaydedildi: ${reportFileName}`);
        console.log('🎯 Test tamamlandı! AI sisteminizin kapsamlı analizi hazır.');
    }
}

// Test başlat
console.log('📝 Detaylı AI Test Sistemi hazırlanıyor...');
const testRunner = new DetailedTestRunner();
testRunner.runFullTest().catch(console.error); 