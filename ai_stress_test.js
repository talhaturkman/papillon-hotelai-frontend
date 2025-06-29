const axios = require('axios');

const API_URL = 'http://localhost:5002/api/chat/message';

const testQuestions = [
    // GENEL - 5 soru
    'Merhaba, size nasıl ulaşabilirim?',
    'Papillon Hotels hakkında bilgi verir misiniz?', 
    'Kaç otel var ve isimleri neler?',
    'En popüler otelınız hangisi?',
    'Aileler için en uygun otel hangisi?',
    
    // OTEL TANIMA - 15 soru
    'Ben Belvil\'de kalıyorum',
    'Zeugma\'da konaklıyorum', 
    'Ayscha otelindeyim',
    'I\'m staying at Belvil',
    'We are at Zeugma hotel',
    'Papillon Ayscha\'da misafirim',
    'Belvil\'den yazıyorum',
    'Zeugma\'dan merhaba',
    'Ayscha\'dayım, yardım',
    'I need help at Belvil',
    'Zeugma hotel guest here',
    'From Ayscha hotel',
    'Ben Belvil müşterisi',
    'Zeugma konuğuyum',
    'Ayscha\'da tatildeyim',
    
    // RESTORAN - 20 soru
    'Restoran bilgileri verir misiniz?',
    'Kaç restoran var?',
    'Ana restoran açılış saatleri nedir?',
    'A la carte restoranlar var mı?',
    'Çocuk menüsü var mı?',
    'Vegan yemek seçenekleri var mı?',
    'Akşam yemeği kaçta bitiyor?',
    'Rezervasyon gerekli mi?',
    'Hangi mutfaklar mevcut?',
    'Beach restaurant var mı?',
    'Restoran kapasiteleri nedir?',
    'Büfe restoranlar hangileri?',
    'İtalyan restoranı var mı?',
    'Deniz ürünleri restoranı?',
    'Kahvaltı kaçtan kaça?',
    'Öğle yemeği saatleri?',
    'Gece açık restoran var mı?',
    'Room service var mı?',
    'Vegetarian menü mevcut mu?',
    'Local food servisi?',
    
    // SPA & WELLNESS - 15 soru
    'SPA saatleri nedir?',
    'Masaj fiyatları nedir?',
    'Türk hamamı var mı?',
    'Sauna ücretsiz mi?',
    'SPA rezervasyonu nasıl yapılır?',
    'Çift masajı yapıyor musunuz?',
    'SPA\'da hangi hizmetler ücretsiz?',
    'Fitness merkezi var mı?',
    'SPA package fiyatları?',
    'Facial treatment var mı?',
    'Hot stone massage?',
    'Aromatherapy massage?',
    'Body wrap hizmeti?',
    'Manicure pedicure?',
    'SPA açılış günleri?',
    
    // HAVUZ - 10 soru  
    'Kaç havuz var?',
    'Havuz saatleri nedir?',
    'Aquapark var mı?',
    'Çocuk havuzu var mı?',
    'Kapalı havuz var mı?',
    'Havuz başı servis var mı?',
    'Water slides var mı?',
    'Infinity pool var mı?',
    'Pool bar mevcut mu?',
    'Havuz animasyonu var mı?',
    
    // ODA - 15 soru
    'Oda tipleri nelerdir?',
    'Deniz manzaralı oda var mı?',
    'Aile odaları mevcut mu?', 
    'Suit oda özellikleri neler?',
    'Odada minibar var mı?',
    'Balkonlu odalar var mı?',
    'Oda servisi var mı?',
    'WiFi ücretsiz mi?',
    'Executive room nedir?',
    'Connecting rooms var mı?',
    'Oda büyüklükleri nedir?',
    'Extra bed mümkün mü?',
    'Baby crib var mı?',
    'Safe box var mı?',
    'Terrace room var mı?',
    
    // AKTİVİTE - 12 soru
    'Hangi aktiviteler mevcut?',
    'Gece eğlenceleri neler?',
    'Çocuk kulübü var mı?',
    'Spor aktiviteleri neler?',
    'Plaj aktiviteleri var mı?',
    'Animasyon takımı var mı?',
    'Gece kulübü var mı?',
    'Tenis kortu var mı?',
    'Water sports mevcut mu?',
    'Kids club saatleri?',
    'Live music var mı?',
    'Dance show var mı?',
    
    // KONUM & ULAŞIM - 10 soru
    'Havaalanına uzaklık nedir?',
    'Şehir merkezine kaç km?',
    'Transfer hizmeti var mı?',
    'Yakındaki alışveriş merkezi nerede?',
    'Beach club nasıl gidilir?',
    'Yakın hastane var mı?',
    'Taxi çağırabilir misiniz?',
    'Public transport var mı?',
    'Car rental hizmeti?',
    'Shuttle service saatleri?'
];

class TestRunner {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
        this.categories = {
            'Success': 0,
            'Failed': 0,
            'HotelDetected': 0,
            'ResponseTime': []
        };
    }

    async runSingleTest(question, index) {
        const startTime = Date.now();
        
        try {
            console.log(`[${index + 1}/${testQuestions.length}] Testing: "${question}"`);
            
            const response = await axios.post(API_URL, {
                message: question,
                sessionId: `stress_test_${Date.now()}`
            }, { timeout: 10000 });

            const responseTime = Date.now() - startTime;
            this.categories.ResponseTime.push(responseTime);

            if (response.data.success) {
                const aiResponse = response.data.response;
                this.categories.Success++;
                
                // Check if hotel was detected
                if (aiResponse.includes('Belvil') || aiResponse.includes('Zeugma') || aiResponse.includes('Ayscha')) {
                    this.categories.HotelDetected++;
                }
                
                const shortResponse = aiResponse.length > 100 
                    ? aiResponse.substring(0, 100) + '...'
                    : aiResponse;
                
                console.log(`✅ Success (${responseTime}ms): ${shortResponse}`);
                
                this.results.push({
                    question,
                    response: aiResponse,
                    success: true,
                    responseTime,
                    index: index + 1
                });
            } else {
                console.log(`❌ Failed: ${response.data.error}`);
                this.categories.Failed++;
                this.results.push({
                    question,
                    response: response.data.error,
                    success: false,
                    responseTime,
                    index: index + 1
                });
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.log(`❌ Error (${responseTime}ms): ${error.message}`);
            this.categories.Failed++;
            this.categories.ResponseTime.push(responseTime);
            
            this.results.push({
                question,
                response: error.message,
                success: false,
                responseTime,
                index: index + 1
            });
        }
    }

    generateReport() {
        const totalTime = Date.now() - this.startTime;
        const avgResponseTime = this.categories.ResponseTime.reduce((a, b) => a + b, 0) / this.categories.ResponseTime.length;
        
        console.log('\n' + '='.repeat(80));
        console.log('🏆 AI STRES TEST RAPORU');
        console.log('='.repeat(80));
        console.log(`📊 Toplam Soru: ${testQuestions.length}`);
        console.log(`✅ Başarılı: ${this.categories.Success} (%${((this.categories.Success / testQuestions.length) * 100).toFixed(1)})`);
        console.log(`❌ Başarısız: ${this.categories.Failed} (%${((this.categories.Failed / testQuestions.length) * 100).toFixed(1)})`);
        console.log(`🏨 Otel Algılanan: ${this.categories.HotelDetected} (%${((this.categories.HotelDetected / testQuestions.length) * 100).toFixed(1)})`);
        console.log(`⚡ Ortalama Yanıt: ${Math.round(avgResponseTime)}ms`);
        console.log(`⚡ En Hızlı: ${Math.min(...this.categories.ResponseTime)}ms`);
        console.log(`⚡ En Yavaş: ${Math.max(...this.categories.ResponseTime)}ms`);
        console.log(`⏱️ Toplam Süre: ${Math.round(totalTime / 1000)} saniye`);
        
        // Başarısız soruları göster
        const failedQuestions = this.results.filter(r => !r.success);
        if (failedQuestions.length > 0) {
            console.log(`\n⚠️ BAŞARISIZ SORULAR (${failedQuestions.length} adet):`);
            failedQuestions.slice(0, 10).forEach((result, i) => {
                console.log(`${i + 1}. "${result.question}" - ${result.response}`);
            });
            if (failedQuestions.length > 10) {
                console.log(`... ve ${failedQuestions.length - 10} adet daha`);
            }
        }
        
        // Yavaş yanıtları göster  
        const slowResponses = this.results.filter(r => r.responseTime > 3000);
        if (slowResponses.length > 0) {
            console.log(`\n🐌 YAVAŞ YANITLAR (>3s, ${slowResponses.length} adet):`);
            slowResponses.slice(0, 5).forEach((result, i) => {
                console.log(`${i + 1}. "${result.question}" - ${result.responseTime}ms`);
            });
        }
        
        console.log('\n🎯 Test tamamlandı! AI sisteminin performansı analiz edildi.');
    }

    async runFullTest() {
        console.log('🚀 PAPILLON AI KAPSAMLI STRES TESTİ');
        console.log(`📋 ${testQuestions.length} soru test edilecek`);
        console.log('⏳ Tahmini süre: 5-15 dakika\n');
        
        for (let i = 0; i < testQuestions.length; i++) {
            await this.runSingleTest(testQuestions[i], i);
            
            // Progress update
            if ((i + 1) % 10 === 0) {
                const progress = ((i + 1) / testQuestions.length * 100).toFixed(1);
                console.log(`\n📈 İlerleme: ${progress}% (${i + 1}/${testQuestions.length})\n`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        this.generateReport();
    }
}

// Testi başlat
const testRunner = new TestRunner();
testRunner.runFullTest().catch(console.error); 