const firebaseService = require('./firebase');
const translationService = require('./translation');

class KnowledgeService {
    /**
     * Kullanıcının mesajına göre ilgili knowledge kategorilerini döndürür.
     * Her kategori ayrı property olarak döner: { general, daily, spa, fb }
     */
    async getRelevantKnowledge(message, hotel = null, language = 'tr') {
        try {
            if (!hotel) return null;
            // Get knowledge from Firebase
            const result = await firebaseService.searchKnowledge(hotel, language);
            if (!result.success) return null;

            const lowerMessage = message.toLowerCase();
            let general = '', daily = '', spa = '', fb = '';

            // General
            if (result.content.includes('### General Information ###')) {
                general = result.content.split('### General Information ###')[1].split('###')[0].trim();
            }
            // Daily (tüm daily başlıklarını birleştir)
            if (result.content.includes('### Daily Information')) {
                const dailySections = result.content.split('### Daily Information');
                for (let i = 1; i < dailySections.length; i++) {
                    const section = dailySections[i].split('###')[0].trim();
                    if (section) daily += section + '\n\n';
                }
            }
            // SPA
            if (result.content.includes('### SPA Information ###')) {
                spa = result.content.split('### SPA Information ###')[1].split('###')[0].trim();
            }
            // F&B
            if (result.content.includes('### F&B Information ###')) {
                fb = result.content.split('### F&B Information ###')[1].split('###')[0].trim();
            }

            // Mesajdan kategori tahmini (sadece ilgili context'i döndürmek için)
            let relevant = {};
            if (lowerMessage.match(/spa|wellness|masaj|massage|bakım|treatment/)) {
                relevant.spa = spa;
            }
            if (lowerMessage.match(/restoran|restaurant|yemek|food|içecek|drink|bar|cafe|kahve|coffee/)) {
                relevant.fb = fb;
            }
            if (lowerMessage.match(/bugün|today|yarın|tomorrow|program|aktivite|activity|etkinlik|event/)) {
                relevant.daily = daily;
            }
            if (Object.keys(relevant).length === 0) {
                // Hiçbiri eşleşmezse genel bilgi döndür
                relevant.general = general;
            }
            // Her zaman tüm kategorileri de ekle (gerekirse chat route'unda kullanılabilir)
            relevant._all = { general, daily, spa, fb };
            return relevant;
        } catch (error) {
            console.error('❌ Error getting relevant knowledge:', error);
            return null;
        }
    }

    /**
     * YENİ: Çok dilli bilgi arama zinciri
     * 1. Kullanıcının sorusunu İngilizceye çevir
     * 2. İngilizce chunk'larda arama yap
     * 3. Bulunamazsa diğer dillerde sırayla ara
     * 4. En iyi cevabı kullanıcıya kendi diline çevirip döndür
     */
    async findBestKnowledgeAnswer(userQuestion, hotel, userLanguage = 'tr') {
        try {
            console.log(`[Knowledge Chain] Starting multi-language search for: "${userQuestion}"`);
            console.log(`[Knowledge Chain] Hotel: ${hotel}, User Language: ${userLanguage}`);

            // 1. Kullanıcının sorusunu İngilizceye çevir
            const englishQuestion = await translationService.translateText(userQuestion, 'en');
            console.log(`[Knowledge Chain] Question translated to English: "${englishQuestion}"`);

            // Dil önceliği: İngilizce -> Kullanıcının dili -> Türkçe -> Almanca -> Rusça
            const languagePriority = ['en', userLanguage, 'tr', 'de', 'ru'].filter((v, i, a) => a.indexOf(v) === i);
            console.log(`[Knowledge Chain] Language priority: ${languagePriority.join(' -> ')}`);

            let bestAnswer = null;
            let bestAnswerLanguage = null;
            let bestAnswerContent = null;

            // 2. Her dilde sırayla arama yap
            for (const searchLanguage of languagePriority) {
                console.log(`[Knowledge Chain] Searching in ${searchLanguage}...`);
                
                try {
                    // Firebase'den knowledge'ı çek
                    const knowledgeResult = await firebaseService.searchKnowledge(hotel, searchLanguage);
                    
                    if (knowledgeResult.success && knowledgeResult.content) {
                        console.log(`[Knowledge Chain] Found ${knowledgeResult.content.length} chars in ${searchLanguage}`);
                        
                        // --- KATEGORİ BAZINDA DETAYLI LOG ---
                        const catLog = [];
                        if (knowledgeResult.general && knowledgeResult.general.length > 0) catLog.push(`General: ${searchLanguage} (${knowledgeResult.general.length} karakter)`);
                        if (knowledgeResult.dailyToday && knowledgeResult.dailyToday.length > 0) catLog.push(`DailyToday: ${searchLanguage} (${knowledgeResult.dailyToday.length} karakter)`);
                        if (knowledgeResult.dailyYesterday && knowledgeResult.dailyYesterday.length > 0) catLog.push(`DailyYesterday: ${searchLanguage} (${knowledgeResult.dailyYesterday.length} karakter)`);
                        if (knowledgeResult.spa && knowledgeResult.spa.length > 0) catLog.push(`SPA: ${searchLanguage} (${knowledgeResult.spa.length} karakter)`);
                        if (knowledgeResult.fb && knowledgeResult.fb.length > 0) catLog.push(`F&B: ${searchLanguage} (${knowledgeResult.fb.length} karakter)`);
                        if (catLog.length === 0) catLog.push('Hiçbir kategori bulunamadı.');
                        console.log(`[KNOWLEDGE->LLM] LLM'ye gönderilecek context kategorileri:`);
                        catLog.forEach(line => console.log('  - ' + line));
                        // Kategori bazında ilk 200 karakter önizleme
                        if (knowledgeResult.general && knowledgeResult.general.length > 0) console.log(`[KNOWLEDGE->LLM] General (ilk 200): "${knowledgeResult.general.substring(0,200).replace(/\n/g,' ')}"`);
                        if (knowledgeResult.dailyToday && knowledgeResult.dailyToday.length > 0) console.log(`[KNOWLEDGE->LLM] DailyToday (ilk 200): "${knowledgeResult.dailyToday.substring(0,200).replace(/\n/g,' ')}"`);
                        if (knowledgeResult.dailyYesterday && knowledgeResult.dailyYesterday.length > 0) console.log(`[KNOWLEDGE->LLM] DailyYesterday (ilk 200): "${knowledgeResult.dailyYesterday.substring(0,200).replace(/\n/g,' ')}"`);
                        if (knowledgeResult.spa && knowledgeResult.spa.length > 0) console.log(`[KNOWLEDGE->LLM] SPA (ilk 200): "${knowledgeResult.spa.substring(0,200).replace(/\n/g,' ')}"`);
                        if (knowledgeResult.fb && knowledgeResult.fb.length > 0) console.log(`[KNOWLEDGE->LLM] F&B (ilk 200): "${knowledgeResult.fb.substring(0,200).replace(/\n/g,' ')}"`);
                        // --- SONU ---
                        // LLM'ye gönder ve cevap al
                        const geminiService = require('./gemini');
                        const llmResponse = await geminiService.generateResponse(
                            [{ role: 'user', content: englishQuestion }], // İngilizce soru
                            knowledgeResult.content, // O dildeki context
                            'en' // LLM'ye İngilizce cevap ver
                        );

                        const responseText = llmResponse.response;
                        
                        // Cevap "bilgi yok" mu kontrol et
                        const noInfoKeywords = [
                            'i don\'t have', 'no information', 'not available', 'cannot find',
                            'у меня нет', 'нет информации', 'не найдено',
                            'keine information', 'nicht verfügbar',
                            'bilgi yok', 'bilgi bulunamadı', 'mevcut değil'
                        ];
                        
                        const hasNoInfo = noInfoKeywords.some(keyword => 
                            responseText.toLowerCase().includes(keyword.toLowerCase())
                        );

                        if (!hasNoInfo && responseText.length > 10) {
                            console.log(`[Knowledge Chain] ✅ Found good answer in ${searchLanguage}: "${responseText.substring(0, 50)}..."`);
                            bestAnswer = responseText;
                            bestAnswerLanguage = searchLanguage;
                            bestAnswerContent = knowledgeResult.content;
                            break; // İlk iyi cevabı bulduk, döngüden çık
                        } else {
                            console.log(`[Knowledge Chain] ❌ No useful info in ${searchLanguage}: "${responseText}"`);
                        }
                    } else {
                        console.log(`[Knowledge Chain] ❌ No knowledge found in ${searchLanguage}`);
                    }
                } catch (error) {
                    console.error(`[Knowledge Chain] Error searching in ${searchLanguage}:`, error.message);
                    continue; // Sonraki dile geç
                }
            }

            // 3. En iyi cevabı kullanıcıya kendi diline çevir
            if (bestAnswer && bestAnswerLanguage !== userLanguage) {
                console.log(`[Knowledge Chain] Translating answer from ${bestAnswerLanguage} to ${userLanguage}...`);
                const translatedAnswer = await translationService.translateText(bestAnswer, userLanguage);
                console.log(`[Knowledge Chain] Final answer: "${translatedAnswer.substring(0, 50)}..."`);
                return {
                    success: true,
                    answer: translatedAnswer,
                    sourceLanguage: bestAnswerLanguage,
                    originalAnswer: bestAnswer,
                    context: bestAnswerContent
                };
            } else if (bestAnswer) {
                console.log(`[Knowledge Chain] Answer already in user language: "${bestAnswer.substring(0, 50)}..."`);
                return {
                    success: true,
                    answer: bestAnswer,
                    sourceLanguage: bestAnswerLanguage,
                    originalAnswer: bestAnswer,
                    context: bestAnswerContent
                };
            } else {
                console.log(`[Knowledge Chain] ❌ No answer found in any language`);
                return {
                    success: false,
                    answer: null,
                    sourceLanguage: null,
                    originalAnswer: null,
                    context: null
                };
            }

        } catch (error) {
            console.error('❌ Error in findBestKnowledgeAnswer:', error);
            return {
                success: false,
                answer: null,
                sourceLanguage: null,
                originalAnswer: null,
                context: null,
                error: error.message
            };
        }
    }
}

module.exports = new KnowledgeService();