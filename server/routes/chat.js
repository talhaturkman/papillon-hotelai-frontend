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
  return text.toLowerCase().replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s]/g, '').replace(/\s+/g, '').trim();
}

// Reference keywords for Turkish (can be extended for other languages)
const referenceWords = [
  'bu', 'şu', 'o', 'az önceki', 'söylediğin', 'bahsettiğin', 'bahsettiğim', 'bahsettiğimiz', 'bahsettiğiniz',
  'buradaki', 'oradaki', 'şuradaki', 'onlar', 'bunlar', 'şunlar', 'az önceki', 'önceki', 'son', 'en son', 'demin', 'az önce'
];

// Entity regex patterns (expand as needed)
const entityPatterns = [
  /([A-ZÇĞİÖŞÜ][a-zçğıöşü\'\- ]{2,}(Restoran|Bar|Spa|Havuz|Aquapark|Oda|Suite|Club|Lounge|Pastane|Ana Restoran|Snack|Ala Carte|A\'la Carte|Restaurant|Pool|Room|Suite|Club|Wellness|Fitness|Disco|Lobby|Beach|Cafe|Court|House|Harmony|Taco|Kanji|Dolce Vita|Mirage|Bloom|Asma|Farfalle|Meyhane|Mosaic|Macrina|PA&CO|Beer House|The Gourmet Street|Haru|Papy Çocuk Restoranı|Safran|Mikado|Coral|Viccolo|Surf & Turf|Villa Snack Restoran|Blue Bar|King Suite|Presidential Duplex Suite|Excellent Suite|Wine Cellar|Aphrodite Lobby Bar|Blue Pool Bar|Amphitheater Bar|Food Court Bar|Belle Vue Bar|PA & CO Coffee House|Pasha Lounge|Disco Bar|Garden Pool Bar|Cafe Wien|Terrace Bar|Aqua Bar|Martini Bar|Bloom Lounge|Bloom \(Steak & Wine\)|Bloom \(Akdeniz\)|Mirage \(İtalyan\)|Mey_Hane|Meyhane__T_rk_|Papy__ocuk_Restoran_))/, // Turkish/English
  /([A-Z][a-z]{2,} (Restaurant|Bar|Spa|Pool|Room|Suite|Club|Wellness|Fitness|Disco|Lobby|Beach|Cafe|Court|House|Lounge|Pastane|Snack|Ala Carte|A'la Carte))/
];

// Helper: Find the most recent entity in history
function findRecentEntity(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i].content;
    for (const pattern of entityPatterns) {
      const match = msg.match(pattern);
      if (match) {
        return match[0];
      }
    }
  }
  return null;
}

// Helper: Check if message contains a reference word
function containsReferenceWord(msg) {
  return referenceWords.some(word => msg.toLowerCase().includes(word));
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
        let { message, history = [], session_id, userLocation, hotel: requestHotel } = req.body;

        if (!session_id) {
            session_id = uuidv4();
            console.log(`✨ New session started: ${session_id}`);
        }
        
        console.log(`[DEBUG] Incoming message for session: ${session_id} - "${message}"`);

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // 0. Her mesajda session context'i kontrol et (ÖNCE BUNU YAP!)
        const sessionContext = await firebaseService.getSessionContext(session_id);

        // === Reference resolution logic ===
        if (containsReferenceWord(message)) {
          const recentEntity = findRecentEntity([...history].reverse()); // search from latest to oldest
          if (recentEntity) {
            // Replace reference word(s) with the entity name in the message
            let newMessage = message;
            for (const word of referenceWords) {
              const regex = new RegExp(`\\b${word}\\b`, 'gi');
              newMessage = newMessage.replace(regex, recentEntity);
            }
            if (newMessage !== message) {
              console.log(`[REFERENCE] User message rewritten: '${message}' -> '${newMessage}'`);
              message = newMessage;
            }
          }
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
        // 2. Otel tespiti: önce request body'den, sonra restoran haritası, sonra AI
        let hotel = requestHotel || detectedHotelByRestaurant;
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
            'canlı destek', 'canlı yardım', 'müşteri hizmetleri', 'live support', 'live help', 'customer service', 'real person', 'operator', 'agent', 'bağlanmak istiyorum', 'yardım istiyorum', 'support', 'help', 'assistance', 'representative', 'talk to human', 'talk to operator', 'real agent', 'real person', 
            'живая поддержка', 'поддержка', 'помощь', 'служба поддержки', 'подключиться к службе поддержки', 'хочу подключиться', 'подключиться к поддержке', 'связаться с поддержкой', 'связаться с оператором', 'поговорить с человеком', 'поговорить с оператором', 'человек', 'оператор', 'поддержка', 'помощь'
        ];
        const otelAdlari = ['belvil', 'zeugma', 'ayscha'];
        // Otel adı cümlenin herhangi bir yerinde, farklı varyasyonlarda geçebilir
        const otelAdRegex = /(belvil|zeugma|ayscha)(\s|\W|$)/i;
        const supportMsgLower = message.toLowerCase();
        const hasSupportKeyword = supportKeywords.some(kw => supportMsgLower.includes(kw));
        
        // Fuzzy otel adı eşleşmesi - ÖNCE AI ile tespit edilen oteli kontrol et
        let fuzzyHotel = null;
        
        console.log('[DEBUG] Hotel detection - AI result:', hotel);
        console.log('[DEBUG] Hotel detection - otelAdlari:', otelAdlari);
        console.log('[DEBUG] Hotel detection - hasSupportKeyword:', hasSupportKeyword);
        
        // 1. AI ile tespit edilen otel adını kontrol et
        if (hotel && hotel !== 'Unknown' && otelAdlari.includes(hotel.toLowerCase())) {
            fuzzyHotel = hotel.toLowerCase();
            console.log('[DEBUG] Hotel detection - AI match found:', fuzzyHotel);
        }
        
        // 2. Fuzzy matching ile kontrol et
        if (!fuzzyHotel) {
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
            if (fuzzyHotel) {
                console.log('[DEBUG] Hotel detection - Fuzzy match found:', fuzzyHotel);
            }
        }
        
        // 3. Regex ile kontrol et
        if (!fuzzyHotel) {
          const otelMatch = message.match(otelAdRegex);
          if (otelMatch) {
              fuzzyHotel = otelMatch[1].toLowerCase();
              console.log('[DEBUG] Hotel detection - Regex match found:', fuzzyHotel);
          }
        }
        
        console.log('[DEBUG] Hotel detection - Final fuzzyHotel:', fuzzyHotel);
        
        // --- PENDING CONTEXT KONTROLÜ (otel adı tespit edildikten sonra) ---
        if (sessionContext.pending === 'hotel' && fuzzyHotel) {
            console.log('[DEBUG] sessionContext (otel adı bekleniyor):', sessionContext);
            if (sessionContext.lastMessage) {
                // 1. Otel ve dil ile ilgili bilgi metnini çek
                const knowledge = await firebaseService.searchKnowledge(fuzzyHotel, 'tr');
                // 2. Sohbet geçmişine yeni otel adını ekle
                const updatedHistory = [...history, { role: 'user', content: message }];
                // 3. Birleştirilmiş soruyu da history'ye ekle (kronolojik bütünlük için)
                const fullQuestion = `${fuzzyHotel} otelinin ${sessionContext.lastMessage}`;
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
                    hotel: fuzzyHotel
                });
            }
        }
        
        // Otel adı algılandıysa
        if (fuzzyHotel) {
            console.log('[DEBUG] Live support check - fuzzyHotel found:', fuzzyHotel);
            console.log('[DEBUG] Live support check - hasSupportKeyword:', hasSupportKeyword);
            
            // --- Öncelik: pending intent varsa önce onu tamamla ---
            if (sessionContext.pending) {
                const hotel = fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase();
                // Canlı destek önceliği
                if (sessionContext.pending === 'support') {
                    await firebaseService.setSessionContext(session_id, { pending: null, lastIntent: 'support', lastHotel: hotel });
                    let responseText = detectedLanguage === 'tr' ? `${hotel} otelinin canlı desteğine bağlanmak istiyor musunuz?`
                        : detectedLanguage === 'en' ? `Do you want to connect to live support for ${hotel} hotel?`
                        : detectedLanguage === 'de' ? `Möchten Sie mit dem Live-Support für das Hotel ${hotel} verbunden werden?`
                        : detectedLanguage === 'ru' ? `Вы хотите подключиться к службе поддержки отеля ${hotel}?`
                        : `Do you want to connect to live support for ${hotel} hotel?`;
                    return res.json({
                        success: true,
                        response: responseText,
                        hotel,
                        offerSupport: true,
                        needHotelSelection: false
                    });
                }
                // Restoran/menü önceliği
                if (sessionContext.pending === 'restaurant_info') {
                    // 1. Otel ve dil ile ilgili bilgi metnini çek
                    const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                    // 2. Soru + bilgi metni ile Gemini'ye gönder
                    const fullQuestion = `${hotel} otelinin ${sessionContext.lastMessage}`;
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
                // Amenity bilgisi önceliği (aquapark, spa, vb.)
                if (sessionContext.pending === 'amenity_info') {
                // 1. Otel ve dil ile ilgili bilgi metnini çek
                const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                // 2. Soru + bilgi metni ile Gemini'ye gönder
                    const fullQuestion = `${hotel} otelinin ${sessionContext.lastMessage}`;
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
                // SPA veya diğer intentler için de benzer mantık eklenebilir
                // ...
            }
            
            // --- ÖNCELİK: Canlı destek anahtar kelimesi varsa hemen döndür ---
            if (hasSupportKeyword) {
                console.log('[DEBUG] Live support check - SUPPORT KEYWORD DETECTED! Returning live support response.');
                let responseText = detectedLanguage === 'tr' ? 'Canlı desteğe bağlanmak istiyor musunuz?'
                    : detectedLanguage === 'en' ? 'Do you want to connect to live support?'
                    : detectedLanguage === 'de' ? 'Möchten Sie mit dem Live-Support verbunden werden?'
                    : detectedLanguage === 'ru' ? 'Вы хотите подключиться к службе поддержки?'
                    : 'Do you want to connect to live support?';
                return res.json({
                    success: true,
                    response: responseText,
                    hotel: fuzzyHotel,
                    offerSupport: true,
                    needHotelSelection: false
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
                        console.log('[DEBUG] knowledge object keys:', Object.keys(knowledge));
                        console.log('[DEBUG] knowledge.menuChunks:', knowledge.menuChunks);
                        const menuChunkKeys = Object.keys(knowledge.menuChunks || {});
                        const normalizedKeys = menuChunkKeys.map(k => normalizeText(k));
                        const normalizedRestaurant = normalizeText(detectedRestaurant);
                        console.log('[DEBUG] menuChunks keys:', menuChunkKeys);
                        console.log('[DEBUG] normalized keys:', normalizedKeys);
                        console.log('[DEBUG] normalized detectedRestaurant:', normalizedRestaurant);
                        const filteredChunks = Object.entries(knowledge.menuChunks || {})
                            .filter(([key]) => normalizeText(key).includes(normalizeText(detectedRestaurant)))
                            .map(([, chunks]) => chunks)
                            .flat();
                        if (filteredChunks.length > 0) {
                            knowledge.content = filteredChunks.map(chunk => chunk.text).join('\n');
                            console.log(`[Chat Route] Found ${filteredChunks.length} chunks for ${detectedRestaurant}, content length: ${knowledge.content.length}`);
                        } else {
                            console.log(`[Chat Route] No chunks found for ${detectedRestaurant}`);
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
            
            // Eğer sadece otel adı yazıldıysa, otel seçimi olarak kabul et
            if (fuzzyHotel) {
                let responseText = detectedLanguage === 'tr' ? 'Merhaba! ' + fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase() + ' otelinde konaklıyorsunuz. Size nasıl yardımcı olabilirim?'
                    : detectedLanguage === 'en' ? 'Hello! You are staying at ' + fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase() + ' hotel. How can I help you?'
                    : detectedLanguage === 'de' ? 'Hallo! Sie wohnen im ' + fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase() + ' Hotel. Wie kann ich Ihnen helfen?'
                    : detectedLanguage === 'ru' ? 'Здравствуйте! Вы остановились в отеле ' + fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase() + '. Как я могу вам помочь?'
                    : 'Hello! You are staying at ' + fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase() + ' hotel. How can I help you?';
                return res.json({
                    success: true,
                    response: responseText,
                    hotel: fuzzyHotel,
                    offerSupport: false,
                    needHotelSelection: false
                });
            }
        }

        // --- YENİ: Canlı destek isteği otel adı olmadan gelirse context'e yaz ---
        if (hasSupportKeyword && !fuzzyHotel) {
            await firebaseService.setSessionContext(session_id, {
                pending: 'support',
                lastIntent: 'support',
                lastMessage: message
            });
            let askHotelMsg = detectedLanguage === 'tr' ? 'Hangi otel için canlı destek istiyorsunuz? Belvil, Zeugma veya Ayscha yazabilirsiniz.'
                : detectedLanguage === 'en' ? 'Which hotel do you want live support for? You can write Belvil, Zeugma or Ayscha.'
                : detectedLanguage === 'de' ? 'Für welches Hotel möchten Sie den Live-Support? Sie können Belvil, Zeugma oder Ayscha schreiben.'
                : detectedLanguage === 'ru' ? 'Для какого отеля вы хотите подключиться к службе поддержки? Можете написать Belvil, Zeugma или Ayscha.'
                : 'Which hotel do you want live support for?';
            return res.json({
                success: true,
                response: askHotelMsg,
                offerSupport: true,
                needHotelSelection: true
            });
        }
        // --- YENİ: Sadece otel adı geldi ve pending support varsa ---
        if (fuzzyHotel && sessionContext.pending === 'support') {
            const hotel = fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase();
            await firebaseService.setSessionContext(session_id, { pending: null, lastIntent: null, lastHotel: hotel });
            let responseText = detectedLanguage === 'tr' ? `${hotel} otelinin canlı desteğine bağlanmak istiyor musunuz?`
                : detectedLanguage === 'en' ? `Do you want to connect to live support for ${hotel} hotel?`
                : detectedLanguage === 'de' ? `Möchten Sie mit dem Live-Support für das Hotel ${hotel} verbunden werden?`
                : detectedLanguage === 'ru' ? `Вы хотите подключиться к службе поддержки отеля ${hotel}?`
                : `Do you want to connect to live support for ${hotel} hotel?`;
            return res.json({
                success: true,
                response: responseText,
                hotel,
                offerSupport: true,
                needHotelSelection: false
            });
        }
        // --- YENİ: "evet" gibi kısa cevaplarda pending support ve lastHotel ile bağ kur ---
        const yesWords = ['evet', 'yes', 'ja', 'да'];
        if (yesWords.includes(message.trim().toLowerCase()) && sessionContext.lastIntent === 'support' && sessionContext.lastHotel) {
            let responseText = detectedLanguage === 'tr' ? `${sessionContext.lastHotel} otelinin canlı desteğine bağlanıyorsunuz.`
                : detectedLanguage === 'en' ? `Connecting you to live support for ${sessionContext.lastHotel} hotel.`
                : detectedLanguage === 'de' ? `Sie werden mit dem Live-Support für das Hotel ${sessionContext.lastHotel} verbunden.`
                : detectedLanguage === 'ru' ? `Вы подключаетесь к службе поддержки отеля ${sessionContext.lastHotel}.`
                : `Connecting you to live support for ${sessionContext.lastHotel} hotel.`;
            // --- WhatsApp'a konuşma geçmişini gönder ---
            try {
                const { sendWhatsAppMessage } = require('../services/whatsapp');
                const whatsappNumber = process.env.WHATSAPP_BUSINESS_NUMBER;
                const chatHistory = await firebaseService.getChatConversation(session_id);
                const lastMessages = chatHistory?.messages?.slice(-10).map(m => `${m.role === 'user' ? 'Misafir' : 'AI'}: ${m.content}`).join('\n') || '';
                const infoText = `Yeni canlı destek talebi!\nOtel: ${sessionContext.lastHotel}\nSon konuşma:\n${lastMessages}`;
                await sendWhatsAppMessage(whatsappNumber, infoText);
            } catch (err) {
                console.error('WhatsApp mesajı gönderilemedi:', err.message);
            }
            await firebaseService.setSessionContext(session_id, { pending: null, lastIntent: null, lastHotel: null });
            return res.json({
                success: true,
                response: responseText,
                hotel: sessionContext.lastHotel,
                offerSupport: true,
                needHotelSelection: false
            });
        }

        // isQuestion kontrolünden hemen sonra locationAnalysis'ı tanımla
        let locationAnalysis = await geminiService.analyzeLocationQuery(message, history, detectedLanguage);
        // HATALI CONTEXTLERİ SİL: Location query sonrası context temizle
        await firebaseService.setSessionContext(session_id, { pending: null, lastIntent: null, lastHotel: null, lastAmenity: null, lastMessage: null });

        // Eğer otel adı eksikse ve restoran/amenity soruluyorsa, context'e pending yaz
        // (örnek: restoran sorusu, otel adı yok)
        if ((message.toLowerCase().includes('restoran') || message.toLowerCase().includes('restaurant') || message.toLowerCase().includes('a la carte')) && (!requestHotel || hotel === 'Unknown')) {
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
            // Pending context'i ayarla (otel adı bekleniyor)
            await firebaseService.setSessionContext(session_id, {
                pending: 'hotel',
                lastIntent: 'amenity_info',
                lastMessage: message,
                lastAmenity: amenity
            });
            
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
                console.log('[DEBUG] knowledge object keys:', Object.keys(knowledge));
                console.log('[DEBUG] knowledge.menuChunks:', knowledge.menuChunks);
                const menuChunkKeys = Object.keys(knowledge.menuChunks || {});
                const normalizedKeys = menuChunkKeys.map(k => normalizeText(k));
                const normalizedRestaurant = normalizeText(detectedRestaurant);
                console.log('[DEBUG] menuChunks keys:', menuChunkKeys);
                console.log('[DEBUG] normalized keys:', normalizedKeys);
                console.log('[DEBUG] normalized detectedRestaurant:', normalizedRestaurant);
                const filteredChunks = Object.entries(knowledge.menuChunks || {})
                    .filter(([key]) => normalizeText(key).includes(normalizeText(detectedRestaurant)))
                    .map(([, chunks]) => chunks)
                    .flat();
                if (filteredChunks.length > 0) {
                    knowledge.content = filteredChunks.map(chunk => chunk.text).join('\n');
                    console.log(`[Chat Route] Found ${filteredChunks.length} chunks for ${detectedRestaurant}, content length: ${knowledge.content.length}`);
                } else {
                    console.log(`[Chat Route] No chunks found for ${detectedRestaurant}`);
                }
            }
            // Restoran sorusu için sadece son kullanıcı mesajını gönder (önceki context'i temizle)
            const restaurantHistory = [{ role: 'user', content: message }];
            geminiResponse = await geminiService.generateResponse(
                restaurantHistory,
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

        // Cevabı frontend'e göndermeden önce SPA kataloğu teklifini kontrol et
        const spaKeywords = [
            'spa', 'wellness', 'masaj', 'massage', 'hamam', 'sauna', 'bakım', 'güzellik',
            'therapy', 'treatment', 'steam', 'turkish bath', 'facial', 'body care'
        ];
        const spaOfferText = 'SPA kataloğumuzdan daha fazla ayrıntı sağlayabilirim';
        if (
            typeof responseText === 'string' &&
            responseText.includes(spaOfferText) &&
            !spaKeywords.some(kw => responseText.toLowerCase().includes(kw))
        ) {
            responseText = responseText.replace(spaOfferText, '').replace(/\s{2,}/g, ' ').trim();
        }

        // AI yanıtı [DESTEK_TALEBI] içeriyorsa, canlı destek onayı akışını başlat
        function checkDestekTalebi(aiResponse, detectedLanguage) {
            if (aiResponse && aiResponse.response && aiResponse.response.includes('[DESTEK_TALEBI]')) {
                let responseText = detectedLanguage === 'tr' ? 'Canlı desteğe bağlanmak istiyor musunuz?'
                    : detectedLanguage === 'en' ? 'Do you want to connect to live support?'
                    : detectedLanguage === 'de' ? 'Möchten Sie mit dem Live-Support verbunden werden?'
                    : detectedLanguage === 'ru' ? 'Вы хотите подключиться к службе поддержки?'
                    : 'Do you want to connect to live support?';
                return {
                    success: true,
                    response: responseText,
                    offerSupport: true,
                    needHotelSelection: false
                };
            }
            return null;
        }

        const destekCheck = checkDestekTalebi(geminiResponse, detectedLanguage);
        if (destekCheck) return res.json(destekCheck);

        // Eğer hem canlı destek anahtar kelimesi hem de otel adı aynı mesajda geçiyorsa, AI veya başka bir işlem yapılmadan EN BAŞTA canlı destek onayı akışını başlat
        if (hasSupportKeyword && fuzzyHotel) {
            const hotel = fuzzyHotel.charAt(0).toUpperCase() + fuzzyHotel.slice(1).toLowerCase();
            let responseText = detectedLanguage === 'tr' ? `${hotel} otelinin canlı desteğine bağlanmak istiyor musunuz?`
                : detectedLanguage === 'en' ? `Do you want to connect to live support for ${hotel} hotel?`
                : detectedLanguage === 'de' ? `Möchten Sie mit dem Live-Support für das Hotel ${hotel} verbunden werden?`
                : detectedLanguage === 'ru' ? `Вы хотите подключиться к службе поддержки отеля ${hotel}?`
                : `Do you want to connect to live support for ${hotel} hotel?`;
            return res.json({
                success: true,
                response: responseText,
                hotel,
                offerSupport: true,
                needHotelSelection: false
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
