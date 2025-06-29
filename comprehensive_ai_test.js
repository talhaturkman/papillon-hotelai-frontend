const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:5002/api/chat/message';

// 100+ Kapsamlı Test Soruları - Gerçek misafir senaryoları
const testQuestions = [
    // === GENEL BİLGİ SORULARI ===
    { category: 'Genel', question: 'Merhaba, size nasıl ulaşabilirim?', type: 'greeting' },
    { category: 'Genel', question: 'Papillon Hotels hakkında bilgi verir misiniz?', type: 'general' },
    { category: 'Genel', question: 'Kaç otel var ve isimleri neler?', type: 'hotels' },
    { category: 'Genel', question: 'En popüler otelınız hangisi?', type: 'recommendation' },
    { category: 'Genel', question: 'Aileler için en uygun otel hangisi?', type: 'recommendation' },

    // === OTEL TANIMLAMA TESTLERİ ===
    { category: 'Otel-Tanıma', question: 'Ben Belvil\'de kalıyorum', type: 'hotel-identify', hotel: 'Belvil' },
    { category: 'Otel-Tanıma', question: 'Zeugma\'da konaklıyorum', type: 'hotel-identify', hotel: 'Zeugma' },
    { category: 'Otel-Tanıma', question: 'Ayscha otelindeyim', type: 'hotel-identify', hotel: 'Ayscha' },
    { category: 'Otel-Tanıma', question: 'I\'m staying at Belvil', type: 'hotel-identify', hotel: 'Belvil' },
    { category: 'Otel-Tanıma', question: 'We are at Zeugma hotel', type: 'hotel-identify', hotel: 'Zeugma' },
    { category: 'Otel-Tanıma', question: 'Papillon Ayscha\'da misafirim', type: 'hotel-identify', hotel: 'Ayscha' },

    // === RESTORAN SORULARI ===
    { category: 'Restoran', question: 'Restoran bilgileri verir misiniz?', type: 'restaurant-general' },
    { category: 'Restoran', question: 'Kaç restoran var?', type: 'restaurant-count' },
    { category: 'Restoran', question: 'Ana restoran açılış saatleri nedir?', type: 'restaurant-hours' },
    { category: 'Restoran', question: 'A la carte restoranlar var mı?', type: 'restaurant-alacarte' },
    { category: 'Restoran', question: 'Çocuk menüsü var mı?', type: 'restaurant-kids' },
    { category: 'Restoran', question: 'Vegan yemek seçenekleri var mı?', type: 'restaurant-vegan' },
    { category: 'Restoran', question: 'Akşam yemeği kaçta bitiyor?', type: 'restaurant-dinner' },
    { category: 'Restoran', question: 'Rezervasyon gerekli mi?', type: 'restaurant-reservation' },
    { category: 'Restoran', question: 'Hangi mutfaklar mevcut?', type: 'restaurant-cuisine' },
    { category: 'Restoran', question: 'Beach restaurant var mı?', type: 'restaurant-beach' },

    // === SPA & WELLNESS ===
    { category: 'SPA', question: 'SPA saatleri nedir?', type: 'spa-hours' },
    { category: 'SPA', question: 'Masaj fiyatları nedir?', type: 'spa-prices' },
    { category: 'SPA', question: 'Türk hamamı var mı?', type: 'spa-hamam' },
    { category: 'SPA', question: 'Sauna ücretsiz mi?', type: 'spa-sauna' },
    { category: 'SPA', question: 'SPA rezervasyonu nasıl yapılır?', type: 'spa-reservation' },
    { category: 'SPA', question: 'Çift masajı yapıyor musunuz?', type: 'spa-couple' },
    { category: 'SPA', question: 'SPA\'da hangi hizmetler ücretsiz?', type: 'spa-free' },
    { category: 'SPA', question: 'Fitness merkezi var mı?', type: 'spa-fitness' },

    // === HAVUZ SORULARI ===
    { category: 'Havuz', question: 'Kaç havuz var?', type: 'pool-count' },
    { category: 'Havuz', question: 'Havuz saatleri nedir?', type: 'pool-hours' },
    { category: 'Havuz', question: 'Aquapark var mı?', type: 'pool-aquapark' },
    { category: 'Havuz', question: 'Çocuk havuzu var mı?', type: 'pool-kids' },
    { category: 'Havuz', question: 'Kapalı havuz var mı?', type: 'pool-indoor' },
    { category: 'Havuz', question: 'Havuz başı servis var mı?', type: 'pool-service' },
    { category: 'Havuz', question: 'Water slides var mı?', type: 'pool-slides' },

    // === ODA BİLGİLERİ ===
    { category: 'Oda', question: 'Oda tipleri nelerdir?', type: 'room-types' },
    { category: 'Oda', question: 'Deniz manzaralı oda var mı?', type: 'room-seaview' },
    { category: 'Oda', question: 'Aile odaları mevcut mu?', type: 'room-family' },
    { category: 'Oda', question: 'Suit oda özellikleri neler?', type: 'room-suite' },
    { category: 'Oda', question: 'Odada minibar var mı?', type: 'room-minibar' },
    { category: 'Oda', question: 'Balkonlu odalar var mı?', type: 'room-balcony' },
    { category: 'Oda', question: 'Oda servisi var mı?', type: 'room-service' },
    { category: 'Oda', question: 'WiFi ücretsiz mi?', type: 'room-wifi' },

    // === AKTİVİTELER ===
    { category: 'Aktivite', question: 'Hangi aktiviteler mevcut?', type: 'activity-general' },
    { category: 'Aktivite', question: 'Gece eğlenceleri neler?', type: 'activity-night' },
    { category: 'Aktivite', question: 'Çocuk kulübü var mı?', type: 'activity-kids' },
    { category: 'Aktivite', question: 'Spor aktiviteleri neler?', type: 'activity-sports' },
    { category: 'Aktivite', question: 'Plaj aktiviteleri var mı?', type: 'activity-beach' },
    { category: 'Aktivite', question: 'Animasyon takımı var mı?', type: 'activity-animation' },
    { category: 'Aktivite', question: 'Gece kulübü var mı?', type: 'activity-nightclub' },
    { category: 'Aktivite', question: 'Tenis kortu var mı?', type: 'activity-tennis' },

    // === KONUM & ULAŞIM ===
    { category: 'Konum', question: 'Havaalanına uzaklık nedir?', type: 'location-airport' },
    { category: 'Konum', question: 'Şehir merkezine kaç km?', type: 'location-city' },
    { category: 'Konum', question: 'Transfer hizmeti var mı?', type: 'location-transfer' },
    { category: 'Konum', question: 'Yakındaki alışveriş merkezi nerede?', type: 'location-shopping' },
    { category: 'Konum', question: 'Beach club nasıl gidilir?', type: 'location-beach' },
    { category: 'Konum', question: 'Yakın hastane var mı?', type: 'location-hospital' },
    { category: 'Konum', question: 'Taxi çağırabilir misiniz?', type: 'location-taxi' },

    // === REZERVASYON & FİYAT ===
    { category: 'Rezervasyon', question: 'Rezervasyon nasıl yapılır?', type: 'booking-how' },
    { category: 'Rezervasyon', question: 'İptal koşulları neler?', type: 'booking-cancel' },
    { category: 'Rezervasyon', question: 'Oda fiyatları nedir?', type: 'booking-price' },
    { category: 'Rezervasyon', question: 'All inclusive paket var mı?', type: 'booking-allinclusive' },
    { category: 'Rezervasyon', question: 'Erken check-in mümkün mü?', type: 'booking-checkin' },
    { category: 'Rezervasyon', question: 'Late check-out ücreti nedir?', type: 'booking-checkout' },

    // === ÇOK DİLLİ SORULAR ===
    { category: 'Çoklu-Dil', question: 'Hello, do you speak English?', type: 'multilang-en' },
    { category: 'Çoklu-Dil', question: 'Guten Tag, sprechen Sie Deutsch?', type: 'multilang-de' },
    { category: 'Çoklu-Dil', question: 'Привет, вы говорите по-русски?', type: 'multilang-ru' },
    { category: 'Çoklu-Dil', question: 'What restaurants do you have?', type: 'multilang-en' },
    { category: 'Çoklu-Dil', question: 'Welche Restaurants haben Sie?', type: 'multilang-de' },
    { category: 'Çoklu-Dil', question: 'I need pool information', type: 'multilang-en' },

    // === ÖZEL DURUMLAR ===
    { category: 'Özel', question: 'Engelli misafir olanakları var mı?', type: 'special-disabled' },
    { category: 'Özel', question: 'Pet friendly misiniz?', type: 'special-pets' },
    { category: 'Özel', question: 'Nikah töreni yapabilir miyiz?', type: 'special-wedding' },
    { category: 'Özel', question: 'Doğum günü organizasyonu yapıyor musunuz?', type: 'special-birthday' },
    { category: 'Özel', question: 'Glutensiz yemek var mı?', type: 'special-gluten' },

    // === PROBLEM & ŞİKAYET ===
    { category: 'Problem', question: 'Odamda sorun var, kimle görüşmeli?', type: 'problem-room' },
    { category: 'Problem', question: 'Klima çalışmıyor', type: 'problem-ac' },
    { category: 'Problem', question: 'WiFi bağlanmıyor', type: 'problem-wifi' },
    { category: 'Problem', question: 'Resepsiyon telefonunu verir misiniz?', type: 'problem-contact' },
    { category: 'Problem', question: 'Eşyam kayıp, ne yapmalıyım?', type: 'problem-lost' },

    // === KARMAŞIK SORULAR ===
    { category: 'Karmaşık', question: 'Yarın ailecek spa\'ya gitmek istiyoruz, 4 kişi için masaj rezervasyonu ve fiyat bilgisi alabilir miyim?', type: 'complex-spa' },
    { category: 'Karmaşık', question: 'Çocuğum 8 yaşında, hangi aktivitelere katılabilir ve güvenli mi?', type: 'complex-kids' },
    { category: 'Karmaşık', question: 'Akşam romantic dinner için reserved table, sonra beach walk, bunlar için nereye başvurmalıyım?', type: 'complex-romantic' },
    { category: 'Karmaşık', question: 'All inclusive paketimizde hangi restoranlar dahil, hangileri extra ücretli?', type: 'complex-allinclusive' },

    // === EDGE CASES ===
    { category: 'Edge', question: 'abc123', type: 'edge-random' },
    { category: 'Edge', question: '', type: 'edge-empty' },
    { category: 'Edge', question: 'ne ne ne ne ne', type: 'edge-repeat' },
    { category: 'Edge', question: 'Papillon Marriott Hotel\'deyim', type: 'edge-wrong-hotel' },
    { category: 'Edge', question: 'Ben Mars\'ta kalıyorum', type: 'edge-impossible' },
    { category: 'Edge', question: 'Çok çok çok çok uzun bir soru soruyorum çünkü AI\'ın çok uzun metinleri nasıl işlediğini görmek istiyorum acaba bu durumda ne olacak bakalım ne cevap verecek sistem böyle durumlarda', type: 'edge-long' },

    // === BELİRSİZ SORULAR ===
    { category: 'Belirsiz', question: 'Bir şey sorabilir miyim?', type: 'vague-general' },
    { category: 'Belirsiz', question: 'Bu konuda ne düşünüyorsunuz?', type: 'vague-opinion' },
    { category: 'Belirsiz', question: 'Yardım', type: 'vague-help' },
    { category: 'Belirsiz', question: 'Bilgi', type: 'vague-info' },
    { category: 'Belirsiz', question: 'Ne önerirsiniz?', type: 'vague-suggest' },

    // === DETAYLI SORULAR ===
    { category: 'Detay', question: 'Spa\'da hangi marka ürünler kullanılıyor?', type: 'detail-spa-brands' },
    { category: 'Detay', question: 'Restorandaki şeflerin uzmanlık alanları neler?', type: 'detail-chef' },
    { category: 'Detay', question: 'Havuz suyunun sıcaklığı kaç derece?', type: 'detail-pool-temp' },
    { category: 'Detay', question: 'Odaların metrekaresi nedir?', type: 'detail-room-size' },
    { category: 'Detay', question: 'All inclusive paket hangi markaları içeriyor?', type: 'detail-brands' },

    // === SAYISAL BİLGİ SORULARI ===
    { category: 'Sayısal', question: 'Toplam kaç oda var?', type: 'numeric-rooms' },
    { category: 'Sayısal', question: 'Kapasite nedir?', type: 'numeric-capacity' },
    { category: 'Sayısal', question: 'Havuz derinliği kaç metre?', type: 'numeric-depth' },
    { category: 'Sayısal', question: 'SPA kaç metrekare?', type: 'numeric-spa-size' },
    { category: 'Sayısal', question: 'Restaurant kapasiteleri nedir?', type: 'numeric-restaurant-cap' }
];

// Test sonuçlarını analiz etmek için
class TestAnalyzer {
    constructor() {
        this.results = [];
        this.categoryStats = {};
        this.startTime = Date.now();
    }

    addResult(question, response, success, responseTime, detectedHotel = null) {
        const result = {
            category: question.category,
            type: question.type,
            question: question.question,
            response: response,
            success: success,
            responseTime: responseTime,
            detectedHotel: detectedHotel,
            timestamp: new Date().toISOString()
        };

        this.results.push(result);

        // Category istatistikleri
        if (!this.categoryStats[question.category]) {
            this.categoryStats[question.category] = {
                total: 0,
                success: 0,
                totalTime: 0
            };
        }
        this.categoryStats[question.category].total++;
        if (success) this.categoryStats[question.category].success++;
        this.categoryStats[question.category].totalTime += responseTime;
    }

    generateReport() {
        const totalTime = Date.now() - this.startTime;
        const totalQuestions = this.results.length;
        const successCount = this.results.filter(r => r.success).length;
        const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / totalQuestions;

        const report = {
            summary: {
                totalQuestions,
                successCount,
                successRate: ((successCount / totalQuestions) * 100).toFixed(2),
                avgResponseTime: Math.round(avgResponseTime),
                totalTestTime: Math.round(totalTime / 1000),
                testDate: new Date().toISOString()
            },
            categoryStats: {},
            detailedResults: this.results,
            problemQuestions: this.results.filter(r => !r.success),
            slowResponses: this.results.filter(r => r.responseTime > 5000)
        };

        // Category detayları
        for (const [category, stats] of Object.entries(this.categoryStats)) {
            report.categoryStats[category] = {
                total: stats.total,
                success: stats.success,
                successRate: ((stats.success / stats.total) * 100).toFixed(2),
                avgTime: Math.round(stats.totalTime / stats.total)
            };
        }

        return report;
    }
}

async function runComprehensiveTest() {
    console.log('🚀 KAPSAMLI AI PERFORMANS TESTİ BAŞLIYOR');
    console.log('=' .repeat(80));
    console.log(`📊 Toplam ${testQuestions.length} soru test edilecek`);
    console.log(`🔍 ${Object.keys(testQuestions.reduce((acc, q) => { acc[q.category] = true; return acc; }, {})).length} farklı kategori`);
    console.log('⏱️  Test süresi: ~10-60 dakika (internet hızına bağlı)');
    console.log('=' .repeat(80));

    const analyzer = new TestAnalyzer();
    let questionCount = 0;

    for (const question of testQuestions) {
        questionCount++;
        const startTime = Date.now();
        
        console.log(`\n[${questionCount}/${testQuestions.length}] 🧪 ${question.category}: ${question.type}`);
        console.log(`📝 "${question.question}"`);

        try {
            const response = await axios.post(API_URL, {
                message: question.question,
                sessionId: `test_session_${Date.now()}`
            });

            const responseTime = Date.now() - startTime;
            
            if (response.data.success) {
                const aiResponse = response.data.response;
                const shortResponse = aiResponse.length > 150 
                    ? aiResponse.substring(0, 150) + '...'
                    : aiResponse;

                console.log(`✅ Yanıt alındı (${responseTime}ms)`);
                console.log(`💬 "${shortResponse}"`);

                // Basit başarı değerlendirmesi
                const success = aiResponse.length > 10 && 
                               !aiResponse.includes('error') && 
                               !aiResponse.includes('hata');

                analyzer.addResult(question, aiResponse, success, responseTime);
            } else {
                console.log(`❌ API Hatası: ${response.data.error}`);
                analyzer.addResult(question, 'API_ERROR', false, responseTime);
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.log(`❌ İstek Hatası: ${error.message}`);
            analyzer.addResult(question, error.message, false, responseTime);
        }

        // Her 10 soruda bir ilerleme raporu
        if (questionCount % 10 === 0) {
            const progress = ((questionCount / testQuestions.length) * 100).toFixed(1);
            console.log(`\n📈 İlerleme: ${progress}% (${questionCount}/${testQuestions.length})`);
        }

        // Rate limiting için kısa bekleme
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Final raporu oluştur
    const report = analyzer.generateReport();
    
    // Raporu dosyaya kaydet
    const reportFileName = `ai_test_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    fs.writeFileSync(reportFileName, JSON.stringify(report, null, 2));

    // Konsol raporu
    console.log('\n' + '=' .repeat(80));
    console.log('🏆 KAPSAMLI TEST TAMAMLANDI!');
    console.log('=' .repeat(80));
    console.log(`📊 Toplam Soru: ${report.summary.totalQuestions}`);
    console.log(`✅ Başarılı: ${report.summary.successCount} (%${report.summary.successRate})`);
    console.log(`⚡ Ortalama Yanıt Süresi: ${report.summary.avgResponseTime}ms`);
    console.log(`⏱️  Toplam Test Süresi: ${report.summary.totalTestTime} saniye`);
    console.log(`💾 Detay Rapor: ${reportFileName}`);

    console.log('\n📋 KATEGORİ BAZLI BAŞARI ORANLARI:');
    for (const [category, stats] of Object.entries(report.categoryStats)) {
        console.log(`${category.padEnd(15)}: ${stats.success}/${stats.total} (%${stats.successRate}) - ${stats.avgTime}ms`);
    }

    if (report.problemQuestions.length > 0) {
        console.log(`\n⚠️  SORUNLU SORULAR (${report.problemQuestions.length} adet):`);
        report.problemQuestions.slice(0, 5).forEach((q, i) => {
            console.log(`${i + 1}. [${q.category}] "${q.question}"`);
        });
        if (report.problemQuestions.length > 5) {
            console.log(`... ve ${report.problemQuestions.length - 5} adet daha`);
        }
    }

    console.log('\n🎯 Test raporu hazır! Backend performansınız değerlendirildi.');
}

// Testi başlat
runComprehensiveTest().catch(console.error); 