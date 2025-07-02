require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Aynı soruyu 4 dilde 3'er kez gönder
const questions = [
    // Türkçe - 3 kez
    { question: "Otelin spa hizmetleri nelerdir?", language: "tr", expected: "spa" },
    { question: "Spa hizmetleri nelerdir?", language: "tr", expected: "spa" },
    { question: "Otelde spa var mı?", language: "tr", expected: "spa" },
    
    // İngilizce - 3 kez
    { question: "What are the spa services at the hotel?", language: "en", expected: "spa" },
    { question: "What spa services are available?", language: "en", expected: "spa" },
    { question: "Does the hotel have a spa?", language: "en", expected: "spa" },
    
    // Almanca - 3 kez
    { question: "Welche Spa-Dienstleistungen gibt es im Hotel?", language: "de", expected: "spa" },
    { question: "Was für Spa-Services bietet das Hotel?", language: "de", expected: "spa" },
    { question: "Gibt es ein Spa im Hotel?", language: "de", expected: "spa" },
    
    // Rusça - 3 kez
    { question: "Какие спа-услуги есть в отеле?", language: "ru", expected: "spa" },
    { question: "Какие спа услуги предоставляет отель?", language: "ru", expected: "spa" },
    { question: "Есть ли в отеле спа?", language: "ru", expected: "spa" }
];

async function sendQuestion(questionData, index) {
    try {
        console.log(`[${index + 1}] Soru (${questionData.language}): "${questionData.question}"`);
        
        const response = await axios.post(`${BASE_URL}/api/chat`, {
            message: questionData.question,
            language: questionData.language,
            hotel: "Belvil" // Sabit hotel seç
        }, {
            timeout: 10000
        });
        
        console.log(`[${index + 1}] Yanıt: ${response.data.response.substring(0, 100)}...`);
        return { success: true, data: response.data };
        
    } catch (error) {
        console.log(`[${index + 1}] Hata: ${error.response?.data?.error || error.message}`);
        return { success: false, error: error.response?.data?.error || error.message };
    }
}

async function getAnalytics() {
    try {
        const response = await axios.get(`${BASE_URL}/api/analytics/top-questions`);
        return response.data;
    } catch (error) {
        console.log(`Analytics hatası: ${error.response?.data?.error || error.message}`);
        return null;
    }
}

async function getStats() {
    try {
        const response = await axios.get(`${BASE_URL}/api/analytics/stats`);
        return response.data;
    } catch (error) {
        console.log(`Stats hatası: ${error.response?.data?.error || error.message}`);
        return null;
    }
}

async function runTest() {
    console.log('=== ÇOK DİLLİ SPA SORUSU TESTİ BAŞLIYOR ===');
    console.log(`Toplam ${questions.length} soru gönderilecek (4 dil x 3 kez)`);
    console.log('');
    
    let successCount = 0;
    let errorCount = 0;
    
    // Soruları sırayla gönder
    for (let i = 0; i < questions.length; i++) {
        const result = await sendQuestion(questions[i], i);
        
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
        }
        
        // Her 3 sorudan sonra kısa bir bekleme
        if ((i + 1) % 3 === 0) {
            console.log(`--- ${Math.floor((i + 1) / 3)}. dil tamamlandı ---`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('');
    console.log('=== TEST TAMAMLANDI ===');
    console.log(`Başarılı: ${successCount}, Hatalı: ${errorCount}, Toplam: ${questions.length}`);
    
    // Analytics sonuçlarını al
    console.log('');
    console.log('=== ANALYTICS SONUÇLARI ===');
    
    const analytics = await getAnalytics();
    if (analytics && analytics.questions) {
        console.log('Analytics Top Questions:');
        console.log(JSON.stringify(analytics.questions, null, 2));
    }
    
    const stats = await getStats();
    if (stats && stats.stats) {
        console.log('');
        console.log('Analytics Stats:');
        console.log(JSON.stringify(stats.stats, null, 2));
    }
    
    console.log('');
    console.log('=== TEST ÖZETİ ===');
    console.log('Bu test, aynı spa sorusunun 4 farklı dilde 3\'er kez gönderilmesini test eder.');
    console.log('Analytics panelinde bu soruların nasıl gruplandığını görebilirsiniz:');
    console.log('- Aynı soru farklı dillerde ayrı gruplar mı oluşturuyor?');
    console.log('- Yoksa semantic olarak birleştiriliyor mu?');
    console.log('- Her dil için ayrı count mu var, yoksa toplam count mu?');
}

// Testi başlat
runTest().catch(console.error); 