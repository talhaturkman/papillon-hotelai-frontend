const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const geminiService = require('../services/gemini');
const firebaseService = require('../services/firebase');
const knowledgeService = require('../services/knowledge');
const elevenLabsService = require('../services/elevenlabs');
const translationService = require('../services/translation');
const placesService = require('../services/places');
const questionAnalytics = require('../services/questionAnalytics');

// Fuzzy string matching (Levenshtein distance)
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Otel adı kontrolü fonksiyonu
function isHotelName(msg) {
  const hotels = ['belvil', 'zeugma', 'ayscha'];
  return hotels.includes(msg.trim().toLowerCase());
}

// Örnek restoran bilgisi fonksiyonu
async function getHotelRestaurants(hotel) {
  const data = {
    belvil: 'Ana Restoran, İtalyan, Balık',
    zeugma: 'Ana Restoran, Türk, Uzakdoğu',
    ayscha: 'Ana Restoran, Fransız, Meksika'
  };
  return data[hotel.toLowerCase()] || 'Bilgi yok';
}

// Restoran/alan ismi → otel eşleştirme haritası (güncel ve tam)
const restaurantToHotel = {
  // Zeugma
  'mosaic': 'zeugma',
  'papy çocuk restoranı': 'zeugma',
  'asma': 'zeugma',
  'food court': ['zeugma', 'belvil', 'ayscha'],
  'macrina': 'zeugma',
  'pa&co': ['zeugma', 'ayscha'],
  'beer house': 'zeugma',
  'farfalle': 'zeugma',
  'the gourmet street': 'zeugma',
  'haru': 'zeugma',
  "mey'hane": 'zeugma',
  'meyhane (türk)': 'zeugma',
  // Belvil
  'belle vue': 'belvil',
  'bloom lounge': 'belvil',
  'blue bar': 'belvil',
  'kanji': 'belvil',
  'dolce vita': 'belvil',
  'mirage pastane': 'belvil',
  'bloom (steak & wine)': 'belvil',
  'bloom (akdeniz)': 'belvil',
  'mirage (italyan)': 'belvil',
  // Ayscha
  'ayscha ana restoran': 'ayscha',
  'martini bar': 'ayscha',
  'beach snack': 'ayscha',
  'cafe harmony': 'ayscha',
  'taco': 'ayscha',
  'villa snack restoran': 'ayscha',
  'surf & turf': 'ayscha',
  'safran': 'ayscha',
  'mikado': 'ayscha',
  'coral': 'ayscha',
  'viccolo': 'ayscha'
};

function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s]/g, '').trim();
}

router.post('/tts', async (req, res) => {
        const { text, language = 'tr', gender = 'female' } = req.body;
        
        if (!text) {
        return res.status(400).json({ error: 'Text is required for TTS' });
    }

    try {
        const audioBuffer = await elevenLabsService.generateSpeech(text, language, gender);
        
        // Set headers for audio playback
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        
        // Send the audio buffer
        res.send(audioBuffer);

    } catch (error) {
        console.error('❌ TTS Route Error:', error.message);
        res.status(500).json({ error: 'Failed to generate speech' });
    }
});

router.post('/', async (req, res) => {
    try {
        let { message, history = [], session_id, userLocation } = req.body;

        if (!session_id) {
            session_id = uuidv4();
            console.log(`✨ New session started: ${session_id}`);
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // 0. Her mesajda session context'i kontrol et (ÖNCE BUNU YAP!)
        const sessionContext = await firebaseService.getSessionContext(session_id);
        if (sessionContext.pending === 'hotel' && isHotelName(message)) {
            console.log('[DEBUG] sessionContext (otel adı bekleniyor):', sessionContext);
            if (sessionContext.lastMessage) {
                // 1. Otel ve dil ile ilgili bilgi metnini çek
                const knowledge = await firebaseService.searchKnowledge(message, 'tr');
                // 2. Sohbet geçmişine yeni otel adını ekle
                const updatedHistory = [...history, { role: 'user', content: message }];
                // 3. Birleştirilmiş soruyu da history'ye ekle (kronolojik bütünlük için)
                const fullQuestion = `${message} otelinde ${sessionContext.lastMessage}`;
                updatedHistory.push({ role: 'user', content: fullQuestion });
                console.log('[DEBUG] Birleştirilmiş soru Gemini\'ye gönderiliyor (tüm history ile):', fullQuestion);
                const aiResponse = await geminiService.generateResponse(
                    updatedHistory,
                    knowledge?.content || '', // context
                    'tr'
                );
                await firebaseService.setSessionContext(session_id, { pending: null, lastIntent: null });
                return res.json({
                    success: true,
                    response: aiResponse.response,
                    hotel: message
                });
            }
            // Diğer intentler için de benzer şekilde ekleyebilirsiniz
        }

        // 1. Restoran/alan ismine göre otel tahmini (normalize ile)
        let detectedHotelByRestaurant = null;
        let detectedRestaurant = null;
        const lowerMsg = normalizeText(message);
        let matchedHotels = [];
        for (const [restName, hotelName] of Object.entries(restaurantToHotel)) {
          if (lowerMsg.includes(normalizeText(restName))) {
            detectedRestaurant = restName;
            if (Array.isArray(hotelName)) {
              matchedHotels.push(...hotelName);
            } else {
              matchedHotels.push(hotelName);
            }
          }
        }
        matchedHotels = [...new Set(matchedHotels)]; // Tekilleştir
        if (matchedHotels.length === 1) {
          detectedHotelByRestaurant = matchedHotels[0];
        } else if (matchedHotels.length > 1) {
          // Birden fazla otel eşleşirse kullanıcıya sor
          detectedHotelByRestaurant = null;
        }
        // 2. Otel tespiti: önce restoran haritası, sonra AI
        let hotel = detectedHotelByRestaurant;
        if (!hotel) {
          hotel = await geminiService.detectHotelWithAI(message, history);
        }
        let detectedLanguage = await geminiService.detectLanguage(message, history);
        if (!hotel) hotel = 'Unknown';
        if (!detectedLanguage) detectedLanguage = 'tr';
        
        // Add user's message to history for this turn
        const chatHistory = [...history, { role: 'user', content: message }];

        // Soru mu? Selamlaşma/teşekkür/veda ise Gemini'ye hiç gönderme (ÖNCE BUNU YAP!)
        const isQuestion = await questionAnalytics.isQuestion(message, detectedLanguage);

        // --- CANLI DESTEK + OTEL ADI BİRLİKTEYSE ÖNCELİKLİ AKIŞ ---
        const supportKeywords = [
            'canlı destek', 'canlı yardım', 'müşteri hizmetleri', 'live support', 'live help', 'customer service', 'real person', 'operator', 'agent', 'bağlanmak istiyorum', 'yardım istiyorum', 'support', 'help', 'assistance', 'representative', 'talk to human', 'talk to operator', 'real agent', 'real person', 'живая поддержка', 'поддержка', 'помощь', 'служба поддержки'
        ];
        const otelAdlari = ['belvil', 'zeugma', 'ayscha'];
        // Otel adı cümlenin herhangi bir yerinde, farklı varyasyonlarda geçebilir
        const otelAdRegex = /(belvil|zeugma|ayscha)(\s|\W|$)/i;
        const supportMsgLower = message.toLowerCase();
        const hasSupportKeyword = supportKeywords.some(kw => supportMsgLower.includes(kw));
        // Fuzzy otel adı eşleşmesi
        let fuzzyHotel = null;
        let minDistance = 3;
        for (const otel of otelAdlari) {
          const words = supportMsgLower.split(/\s|\W/).filter(Boolean);
          for (const word of words) {
            const dist = levenshtein(word, otel);
            if (dist < minDistance) {
              minDistance = dist;
              fuzzyHotel = otel;
            }
          }
        }
        if (!fuzzyHotel) {
          // Regex ile de deneriz
          const otelMatch = message.match(otelAdRegex);
          if (otelMatch) fuzzyHotel = otelMatch[1].toLowerCase();
        }
        // Otel adı algılandıysa
        if (fuzzyHotel) {
            const hotel = fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase();
            console.log('DEBUG: OTEL ADI ALGILANDI (fuzzy):', message, '→', hotel);
            
            // Eğer session context'te pending intent varsa, AI yanıtı üret
            if (sessionContext.pending === 'hotel' && sessionContext.lastIntent === 'restaurant_info') {
                console.log('🔥 Session context detected - generating AI response for hotel selection');
                // 1. Otel ve dil ile ilgili bilgi metnini çek
                const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                // 2. Soru + bilgi metni ile Gemini'ye gönder
                const fullQuestion = `${hotel} otelinde ${sessionContext.lastMessage}`;
                const aiResponse = await geminiService.generateResponse(
                    [{ role: 'user', content: fullQuestion }],
                    knowledge?.content || '', // context
                    detectedLanguage
                );
                await firebaseService.setSessionContext(session_id, { pending: null, lastIntent: null });
                return res.json({
                    success: true,
                    response: aiResponse.response,
                    hotel
                });
            }
            
            // Eğer mesajda hem otel adı hem de soru varsa (tek seferde), yeni çok dilli arama zincirini kullan
            if (fuzzyHotel && isQuestion) {
                console.log('🔥 Hotel + Question detected in single message - using multi-language knowledge search');
                
                // Restoran sorusu ise özel filtreleme yap
                if (detectedRestaurant) {
                    console.log(`[Chat Route] Restaurant-specific question detected: ${detectedRestaurant}`);
                    // Restoran sorusu için eski yöntemi kullan (çünkü özel filtreleme gerekiyor)
                    const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                    if (knowledge && detectedRestaurant) {
                        const filteredChunks = Object.entries(knowledge.fbChunks || {})
                            .filter(([key]) => normalizeText(key).includes(normalizeText(detectedRestaurant)))
                            .map(([, chunks]) => chunks)
                            .flat();
                        if (filteredChunks.length > 0) {
                            knowledge.content = filteredChunks.map(chunk => chunk.text).join('\n');
                        }
                    }
                    const aiResponse = await geminiService.generateResponse(
                        chatHistory,
                        knowledge?.content || '',
                        detectedLanguage,
                        userLocation
                    );
                    return res.json({
                        success: true,
                        response: aiResponse.response,
                        hotel
                    });
                } else {
                    // Genel sorular için yeni çok dilli arama zincirini kullan
                    const knowledgeResult = await knowledgeService.findBestKnowledgeAnswer(message, hotel, detectedLanguage);
                    
                    if (knowledgeResult.success) {
                        console.log(`[Chat Route] ✅ Found answer in ${knowledgeResult.sourceLanguage}: "${knowledgeResult.answer.substring(0, 50)}..."`);
                        return res.json({
                            success: true,
                            response: knowledgeResult.answer,
                            hotel
                        });
                    } else {
                        console.log(`[Chat Route] ❌ No answer found, using fallback LLM response`);
                        // Fallback: Eski yöntemle LLM'ye gönder
                        const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                        const aiResponse = await geminiService.generateResponse(
                            chatHistory,
                            knowledge?.content || '',
                            detectedLanguage,
                            userLocation
                        );
                        return res.json({
                            success: true,
                            response: aiResponse.response,
                            hotel
                        });
                    }
                }
            }
            
            // Eğer canlı destek anahtar kelimesi de varsa
            if (hasSupportKeyword) {
                let responseText = detectedLanguage === 'tr' ? 'Canlı desteğe bağlanmak istiyor musunuz?'
                    : detectedLanguage === 'en' ? 'Do you want to connect to live support?'
                    : detectedLanguage === 'de' ? 'Möchten Sie mit dem Live-Support verbunden werden?'
                    : detectedLanguage === 'ru' ? 'Вы хотите подключиться к службе поддержки?'
                    : 'Do you want to connect to live support?';
                return res.json({
                    success: true,
                    response: responseText,
                    hotel,
                    offerSupport: true,
                    needHotelSelection: false
                });
            } else {
                // Sadece otel adı yazıldıysa, otel seçimi olarak kabul et
                let responseText = detectedLanguage === 'tr' ? 'Merhaba! ' + hotel + ' otelinde konaklıyorsunuz. Size nasıl yardımcı olabilirim?'
                    : detectedLanguage === 'en' ? 'Hello! You are staying at ' + hotel + ' hotel. How can I help you?'
                    : detectedLanguage === 'de' ? 'Hallo! Sie wohnen im ' + hotel + ' Hotel. Wie kann ich Ihnen helfen?'
                    : detectedLanguage === 'ru' ? 'Здравствуйте! Вы остановились в отеле ' + hotel + '. Как я могу вам помочь?'
                    : 'Hello! You are staying at ' + hotel + ' hotel. How can I help you?';
                return res.json({
                    success: true,
                    response: responseText,
                    hotel,
                    offerSupport: false,
                    needHotelSelection: false
                });
            }
        }

        // Soru mu? Selamlaşma/teşekkür/veda ise Gemini'ye hiç gönderme
        if (!isQuestion) {
            let greetingReply = 'Merhaba!';
            if (detectedLanguage === 'en') greetingReply = 'Hello!';
            else if (detectedLanguage === 'de') greetingReply = 'Hallo!';
            else if (detectedLanguage === 'ru') greetingReply = 'Здравствуйте!';
            return res.json({
                success: true,
                response: greetingReply,
                isQuestion: false
            });
        }

        // isQuestion kontrolünden hemen sonra locationAnalysis'ı tanımla
        let locationAnalysis = await geminiService.analyzeLocationQuery(message, history, detectedLanguage);

        // Eğer otel adı eksikse ve restoran/amenity soruluyorsa, context'e pending yaz
        // (örnek: restoran sorusu, otel adı yok)
        if ((message.toLowerCase().includes('restoran') || message.toLowerCase().includes('restaurant')) && (!hotel || hotel === 'Unknown')) {
            await firebaseService.setSessionContext(session_id, {
                pending: 'hotel',
                lastIntent: 'restaurant_info',
                lastMessage: message
            });
            return res.json({
                success: true,
                response: 'Hangi Papillon Hotels otelinde konaklıyorsunuz? Belvil, Zeugma ve Ayscha otellerimizden hangisinde olduğunuzu belirtirseniz, restoranlar hakkında bilgi verebilirim.',
                needHotelSelection: true
            });
        }

        // Log the question for analytics
        const questionId = await firebaseService.logQuestionForAnalysis({
            message,
            session_id,
            hotel,
            language: detectedLanguage,
            userLocation: userLocation ? {
                lat: userLocation.lat,
                lng: userLocation.lng
            } : null
        });

        // 2. REAL-TIME QUESTION ANALYSIS - Anında soru analizi
        if (questionId) {
            try {
                console.log(`🔍 Starting real-time analysis for question: ${questionId}`);
                
                        // İlk isQuestion kontrolünü kullan (çifte kontrol yok)
                console.log(`❓ Is question "${message}": ${isQuestion}`);
                
                if (isQuestion) {
            // Anında kategorizasyon + embedding (optimized)
            const categorizationWithEmbedding = await questionAnalytics.categorizeQuestionWithEmbedding(message);
            console.log(`📊 Categorization + Embedding for "${message}":`, {
                category: categorizationWithEmbedding.category,
                facility: categorizationWithEmbedding.facility,
                hasEmbedding: !!categorizationWithEmbedding.embedding
            });
            
            // Firebase'i güncelle (hem kategorizasyon hem embedding)
                    await firebaseService.updateQuestionAnalytics(questionId, {
                        isQuestion: true,
                categorization: {
                    category: categorizationWithEmbedding.category,
                    facility: categorizationWithEmbedding.facility,
                    intent: categorizationWithEmbedding.intent
                },
                        preprocessed: true,
                category: categorizationWithEmbedding.category,
                facility: categorizationWithEmbedding.facility,
                embedding: categorizationWithEmbedding.embedding,
                semantic_keywords: categorizationWithEmbedding.semantic_keywords,
                        analyzedAt: new Date().toISOString()
                    });
                    
                    console.log(`✅ Question ${questionId} analyzed and categorized in real-time`);
                    
                    // Sadece incremental cache güncelle
                    questionAnalytics.updateTopQuestionsCache({
                        message,
                        text: message,
                        hotel,
                        language: detectedLanguage,
                category: categorizationWithEmbedding.category,
                facility: categorizationWithEmbedding.facility,
                        isQuestion: true
                    });
                } else {
                    // Soru değilse işaretle
                    await firebaseService.updateQuestionAnalytics(questionId, {
                        isQuestion: false,
                        preprocessed: true,
                        analyzedAt: new Date().toISOString()
                    });
                    
                    console.log(`❌ Question ${questionId} marked as non-question`);
                }
            } catch (analysisError) {
                console.error('❌ Real-time analysis failed:', analysisError);
                // Analiz başarısız olsa bile devam et
            }
        }

        // --- LLM tabanlı analiz ---
        const llmAnalysis = await geminiService.analyzeUserIntent(message, history, detectedLanguage);
        let intent = llmAnalysis?.intent || null;
        let amenity = llmAnalysis?.amenity || null;
        let offerSupport = llmAnalysis?.offerSupport || false;
        let needHotelSelection = llmAnalysis?.needHotelSelection || false;
        let hotelFromLLM = llmAnalysis?.hotel || null;
        if (!hotel || hotel === 'Unknown') hotel = hotelFromLLM || hotel;
        // Eğer canlı destek + otel adı varyasyonu aktifse, needHotelSelection tekrar true olmasın
        if (offerSupport && hotel && otelAdlari.includes(hotel.toLowerCase())) {
            needHotelSelection = false;
        }

        // Support niyetini sadece bariz anahtar kelimelerle sınırla
        const supportKeywordsStrict = [
            'canlı destek', 'gerçek bir insanla konuşmak istiyorum', 'operatörle görüşmek istiyorum',
            'i want live support', 'i want to talk to a real person', 'customer service', 'help', 'support',
            'ich möchte mit einem menschen sprechen', 'live support', 'kundendienst', 'hilfe',
            'я хочу поговорить с человеком', 'поддержка', 'помощь', 'служба поддержки',
            'talk to human', 'talk to operator'
        ];
        const msgLower = message.toLowerCase();
        if (intent === 'support') {
            const found = supportKeywordsStrict.some(kw => msgLower.includes(kw));
            if (!found) {
                intent = 'info';
                offerSupport = false;
            }
        }

        // Canlı destek değilse, lokasyon analizi ve diğer işlemler devam eder
        console.log('🔍 Location analysis:', locationAnalysis);

        if (!locationAnalysis.isHotelAmenity && locationAnalysis.confidence > 0.6) {
            console.log('📍 External location query detected. Using enhanced location handling...');
            
            if (!userLocation || !userLocation.lat || !userLocation.lng) {
                return res.json({
                    success: true,
                    response: 'Konumunuzu bulmam için izin vermeniz gerekiyor. İzni verdikten sonra tekrar deneyebilirsiniz.',
                    requiresLocation: true
                });
            }

            response = await geminiService.generateLocationResponse(
                message,
                locationAnalysis,
                userLocation,
                hotel,
                detectedLanguage
            );

            // Ensure placesData has the correct structure
            const sanitizedPlacesData = response.placesData ? {
                list: Array.isArray(response.placesData.list) ? response.placesData.list.map(place => ({
                    name: place.name || '',
                    distance: place.distance || 0,
                    lat: place.lat || 0,
                    lng: place.lng || 0,
                    rating: place.rating || 0,
                    vicinity: place.vicinity || '',
                    address: place.address || ''
                })) : [],
                searchQuery: response.placesData.searchQuery || '',
                searchLocation: {
                    lat: response.placesData.searchLocation?.lat || userLocation.lat,
                    lng: response.placesData.searchLocation?.lng || userLocation.lng,
                    address: response.placesData.searchLocation?.address || ''
                }
            } : null;

            // Log the response for analytics
            await firebaseService.logQuestionForAnalysis({
                message: response.response,
                session_id,
                hotel,
                language: detectedLanguage,
                isLocationResponse: true,
                locationData: sanitizedPlacesData?.list || []
            });

            return res.json({
                success: true,
                response: response.response,
                placesData: sanitizedPlacesData
            });
        }

        // Otel içi olanak ve otel adı yoksa, LLM flag'lerine göre akış
        if (amenity && (hotel === 'Unknown' || !hotel) && needHotelSelection) {
            // Eğer canlı destek niyeti varsa butonlu akış
            if (offerSupport) {
            return res.json({
                success: true,
                response: detectedLanguage === 'tr' ? 'Hangi Papillon Hotels otelinde konaklıyorsunuz? Belvil, Zeugma ve Ayscha otellerimizden hangisinde olduğunuzu belirtirseniz, ' + amenity + ' hakkında bilgi verebilirim.' :
                          detectedLanguage === 'en' ? 'Which Papillon Hotels property are you staying at? Please specify Belvil, Zeugma, or Ayscha so I can provide information about ' + amenity + '.' :
                          detectedLanguage === 'de' ? 'In welchem Papillon Hotels wohnen Sie? Bitte geben Sie Belvil, Zeugma oder Ayscha an, damit ich Ihnen Informationen zu ' + amenity + ' geben kann.' :
                          detectedLanguage === 'ru' ? 'В каком отеле Papillon Hotels вы остановились? Пожалуйста, укажите Belvil, Zeugma или Ayscha, чтобы я мог предоставить информацию о ' + amenity + '.' :
                          'Which Papillon Hotels property are you staying at?',
                offerSupport: true,
                needHotelSelection: true
            });
            } else {
                // Sadece metinle otel sorusu dön, buton flag'leri olmadan
                return res.json({
                    success: true,
                    response: detectedLanguage === 'tr' ? 'Hangi Papillon Hotels otelinde konaklıyorsunuz? Belvil, Zeugma ve Ayscha otellerimizden hangisinde olduğunuzu belirtirseniz, ' + amenity + ' hakkında bilgi verebilirim.' :
                              detectedLanguage === 'en' ? 'Which Papillon Hotels property are you staying at? Please specify Belvil, Zeugma, or Ayscha so I can provide information about ' + amenity + '.' :
                              detectedLanguage === 'de' ? 'In welchem Papillon Hotels wohnen Sie? Bitte geben Sie Belvil, Zeugma oder Ayscha an, damit ich Ihnen Informationen zu ' + amenity + ' geben kann.' :
                              detectedLanguage === 'ru' ? 'В каком отеле Papillon Hotels вы остановились? Пожалуйста, укажите Belvil, Zeugma или Ayscha, чтобы я мог предоставить информацию о ' + amenity + '.' :
                              'Which Papillon Hotels property are you staying at?'
                });
            }
        }

        // YENİ: Çok dilli bilgi arama zinciri kullan
        console.log(`[Chat Route] Using multi-language knowledge search for: "${message}"`);
        
        let responseText;
        let geminiResponse = null;
        
        // Restoran sorusu ise özel filtreleme yap
        if (detectedRestaurant) {
            console.log(`[Chat Route] Restaurant-specific question detected: ${detectedRestaurant}`);
            // Restoran sorusu için eski yöntemi kullan (çünkü özel filtreleme gerekiyor)
            const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
            if (knowledge && detectedRestaurant) {
                const filteredChunks = Object.entries(knowledge.fbChunks || {})
                    .filter(([key]) => normalizeText(key).includes(normalizeText(detectedRestaurant)))
                    .map(([, chunks]) => chunks)
                    .flat();
                if (filteredChunks.length > 0) {
                    knowledge.content = filteredChunks.map(chunk => chunk.text).join('\n');
                }
            }
            geminiResponse = await geminiService.generateResponse(
                chatHistory,
                knowledge?.content || '',
                detectedLanguage,
                userLocation
            );
            responseText = geminiResponse.response;
        } else {
            // Genel sorular için yeni çok dilli arama zincirini kullan
            const knowledgeResult = await knowledgeService.findBestKnowledgeAnswer(message, hotel, detectedLanguage);
            
            if (knowledgeResult.success) {
                console.log(`[Chat Route] ✅ Found answer in ${knowledgeResult.sourceLanguage}: "${knowledgeResult.answer.substring(0, 50)}..."`);
                responseText = knowledgeResult.answer;
            } else {
                console.log(`[Chat Route] ❌ No answer found, using fallback LLM response`);
                // Fallback: Eski yöntemle LLM'ye gönder
                const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                geminiResponse = await geminiService.generateResponse(
                    chatHistory,
                    knowledge?.content || '',
                    detectedLanguage,
                    userLocation
                );
                responseText = geminiResponse.response;
            }
        }
        if (responseText && responseText.includes('[DESTEK_TALEBI]')) {
            offerSupport = true;
            if (hotel === 'Unknown') {
                needHotelSelection = true;
            }
            if (detectedLanguage === 'tr') {
                responseText = needHotelSelection
                    ? "Hangi otelde konaklıyorsunuz?"
                    : "Canlı desteğe bağlanmak istiyor musunuz?";
            } else if (detectedLanguage === 'en') {
                responseText = needHotelSelection
                    ? "Which hotel are you staying at?"
                    : "Do you want to connect to live support?";
            } else if (detectedLanguage === 'de') {
                responseText = needHotelSelection
                    ? "In welchem Hotel wohnen Sie?"
                    : "Möchten Sie mit dem Live-Support verbunden werden?";
            } else if (detectedLanguage === 'ru') {
                responseText = needHotelSelection
                    ? "В каком отеле вы остановились?"
                    : "Вы хотите подключиться к службе поддержки?";
            } else {
                responseText = needHotelSelection
                    ? "Which hotel are you staying at?"
                    : "Do you want to connect to live support?";
            }
            return res.json({
                success: true,
                response: responseText,
                offerSupport,
                hotel: hotel !== 'Unknown' ? hotel : undefined,
                needHotelSelection
            });
        }

        // LLM'den dönen cevabı işledikten hemen sonra:
        const spaCatalogOfferSentences = [
            'Eğer ilgilenirseniz, SPA kataloğumuzdan daha fazla detay verebilirim.',
            'If you are interested, I can provide more details from our SPA catalog.',
            'Wenn Sie interessiert sind, kann ich Ihnen weitere Details aus unserem SPA-Katalog geben.',
            'Если вам интересно, я могу предоставить больше информации из нашего СПА-каталога.'
        ];
        const spaKeywords = ['spa', 'wellness', 'masaj', 'massage', 'bakım', 'treatment'];
        if (responseText) {
            // Sadece amenity ve facility alanlarına bak
            const amenityOrFacility = ((amenity || '') + ' ' + (llmAnalysis?.facility || '')).toLowerCase();
            const isSpaContext = spaKeywords.some(kw => amenityOrFacility.includes(kw));
            spaCatalogOfferSentences.forEach(sentence => {
                if (!isSpaContext && responseText.includes(sentence)) {
                    responseText = responseText.replace(sentence, '').replace(/\s{2,}/g, ' ').trim();
                }
            });
        }

        return res.json({
            success: true,
            response: responseText,
            offerSupport,
            hotel: hotel !== 'Unknown' ? hotel : undefined,
            needHotelSelection
        });

    } catch (error) {
        console.error('❌ Chat endpoint error:', error);
        
        // Check if it's a Gemini API error
        if (error.message && error.message.includes('Gemini API')) {
            return res.status(503).json({
                success: false,
                error: 'AI service is temporarily unavailable. Please try again in a moment.',
                retryAfter: 30
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'An error occurred while processing your request. Please try again.',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 
