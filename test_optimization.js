const axios = require('axios');

async function testOptimization() {
    console.log('🧪 Benzer Soru Gruplama Testi Başlatılıyor...\n');
    
    const testQuestions = [
        // Türkçe benzer sorular
        "Tuvalet nerede?",
        "Otelinizin tuvaleti nerede?",
        "Tuvaletin konumu nedir?",
        // İngilizce benzer sorular
        "Where is the toilet?",
        "Where is the restroom in your hotel?",
        "What is the location of the toilet?",
        // Almanca benzer sorular
        "Wo ist die Toilette?",
        "Wo befindet sich die Toilette im Hotel?",
        "Was ist der Standort der Toilette?",
        // Farklı kategoriden örnek
        "Otelinizde havuz var mı?"
    ];
    
    for (let i = 0; i < testQuestions.length; i++) {
        const question = testQuestions[i];
        console.log(`📝 Test ${i + 1}: "${question}"`);
        
        try {
            const startTime = Date.now();
            const response = await axios.post('http://localhost:5002/api/chat', {
                message: question,
                session_id: 'test-benzersoru',
                hotel: 'Belvil',
                language: 'tr'
            });
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            console.log(`✅ Yanıt süresi: ${responseTime}ms`);
            console.log(`📊 Başarılı: ${response.data.success}`);
            console.log('---\n');
            
        } catch (error) {
            console.log(`❌ Hata: ${error.message}\n`);
        }
    }
}

testOptimization(); 