const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const geminiService = require('../services/gemini');
const firebaseService = require('../services/firebase');
const elevenLabsService = require('../services/elevenlabs');
const translationService = require('../services/translation');
const placesService = require('../services/places');
const questionAnalytics = require('../services/questionAnalytics');

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

        // 1. Detect conversation context (hotel, language)
        let hotel = await geminiService.detectHotelWithAI(message, history);
        let detectedLanguage = await geminiService.detectLanguage(message, history);
        if (!hotel) hotel = 'Unknown';
        if (!detectedLanguage) detectedLanguage = 'tr';
        
        // Add user's message to history for this turn
        const chatHistory = [...history, { role: 'user', content: message }];

        // Otel adı yazıldığında, history'de son assistant mesajı olmasa bile, bir önceki user mesajı bilgi sorgusuysa otel seçimi akışını başlat
        const otelAdlari = ['belvil', 'zeugma', 'ayscha'];
        const otelAdRegex = /(belvil|zeugma|ayscha)( otel| otelde| oteldeyim| otelde konaklıyorum)?/i;
        const lastUserMsg = history.slice().reverse().find(m => m.role === 'user');
        if ((otelAdlari.includes(message.toLowerCase().trim()) || otelAdRegex.test(message.toLowerCase())) && lastUserMsg) {
            // Son user mesajı bir bilgi sorgusuysa (ör: info intent veya soru)
            const llmAnalysis = await geminiService.analyzeUserIntent(lastUserMsg.content, history, detectedLanguage);
            let amenity = llmAnalysis?.amenity || null;
            let hotelMatch = message.match(/belvil|zeugma|ayscha/i);
            let hotel = hotelMatch ? hotelMatch[0].charAt(0).toUpperCase() + hotelMatch[0].slice(1).toLowerCase() : message;
            if (llmAnalysis?.intent === 'info' && amenity) {
                const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                const response = await geminiService.generateResponse(
                    [...history, { role: 'user', content: lastUserMsg.content }],
                    knowledge.content,
                    detectedLanguage,
                    null
                );
                return res.json({
                    success: true,
                    response: response.response,
                    hotel,
                    offerSupport: false,
                    needHotelSelection: false
                });
            } else {
                const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                const response = await geminiService.generateResponse(
                    [...history, { role: 'user', content: lastUserMsg.content }],
                    knowledge.content,
                    detectedLanguage,
                    null
                );
                return res.json({
                    success: true,
                    response: response.response,
                    hotel,
                    offerSupport: false,
                    needHotelSelection: false
                });
            }
        }

        // Soru mu? Selamlaşma/teşekkür/veda ise Gemini'ye hiç gönderme
        const isQuestion = await questionAnalytics.isQuestion(message, detectedLanguage);
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
                
                // Anında isQuestion kontrolü
                const isQuestion = await questionAnalytics.isQuestion(message, detectedLanguage);
                console.log(`❓ Is question "${message}": ${isQuestion}`);
                
                if (isQuestion) {
                    // Anında kategorizasyon
                    const categorization = await questionAnalytics.categorizeQuestion(message);
                    console.log(`📊 Categorization for "${message}":`, categorization);
                    
                    // Firebase'i güncelle
                    await firebaseService.updateQuestionAnalytics(questionId, {
                        isQuestion: true,
                        categorization,
                        preprocessed: true,
                        category: categorization.category,
                        facility: categorization.facility,
                        analyzedAt: new Date().toISOString()
                    });
                    
                    console.log(`✅ Question ${questionId} analyzed and categorized in real-time`);
                    
                    // Sadece incremental cache güncelle
                    questionAnalytics.updateTopQuestionsCache({
                        message,
                        text: message,
                        hotel,
                        language: detectedLanguage,
                        category: categorization.category,
                        facility: categorization.facility,
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
        }

        // CANLI DESTEK TALEBİ VARSA, LOKASYON ANALİZİ VE DİĞERLERİ ATLANSIN
        let response;
        let responseText;
        // Canlı destek isteği kontrolü için önce knowledge'ı al
        const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
        response = await geminiService.generateResponse(
            chatHistory,
            knowledge.content,
            detectedLanguage,
            userLocation
        );
        responseText = response.response;
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
        if (response && response.response) {
            // Sadece amenity ve facility alanlarına bak
            const amenityOrFacility = ((amenity || '') + ' ' + (llmAnalysis?.facility || '')).toLowerCase();
            const isSpaContext = spaKeywords.some(kw => amenityOrFacility.includes(kw));
            spaCatalogOfferSentences.forEach(sentence => {
                if (!isSpaContext && response.response.includes(sentence)) {
                    response.response = response.response.replace(sentence, '').replace(/\s{2,}/g, ' ').trim();
                }
            });
        }

        return res.json({
            success: true,
            response: response.response,
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
