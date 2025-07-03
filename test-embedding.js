require('dotenv').config({ path: './server/.env' });
// const fetch = require('node-fetch'); // KALDIRILDI, Node 18+ global fetch kullanılıyor

// Çoklu metin için embedding ve similarity test
async function testEmbedding() {
    console.log('🧪 Testing Text Embedding 004 with multiple texts...');
    console.log('🔑 Using API Key:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
    
    const testTexts = [
        "What is the main restaurant's name?",
        "Ana restoranın adı ne?",
        "What is the name of main restaurant?",
        "Restaurant name please",
        "Pool opening hours",
        "Havuz açılış saatleri",
        "Saat kaçta açılıyor havuz?",
        "Can I swim at night?",
        "Gece yüzebilir miyim?"
    ];
    
    try {
        // Her metin için embedding al
        const embeddings = [];
        for (const text of testTexts) {
            console.log(`📝 Getting embedding for: "${text}"`);
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    content: {
                        parts: [{ text }]
                    }
                })
            });
            const data = await response.json();
            if (response.ok && data.embedding && data.embedding.values) {
                embeddings.push({ text, embedding: data.embedding.values });
                console.log(`✅ Embedding received! Length: ${data.embedding.values.length}`);
            } else {
                console.log('❌ Embedding not received for:', text);
            }
        }
        // Cosine similarity hesapla
        console.log('\n🔍 Calculating similarities:');
        for (let i = 0; i < embeddings.length; i++) {
            for (let j = i + 1; j < embeddings.length; j++) {
                const sim = cosineSimilarity(embeddings[i].embedding, embeddings[j].embedding);
                console.log(`"${embeddings[i].text}" <-> "${embeddings[j].text}": ${sim.toFixed(3)}`);
            }
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Cosine similarity hesaplama
function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
        return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Test'i çalıştır
testEmbedding().then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 