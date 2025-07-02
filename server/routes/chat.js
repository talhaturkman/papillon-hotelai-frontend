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
                    
                    // Cache'i temizle ki analytics panosu anında güncellensin
                    questionAnalytics.invalidateCache();
                    // Top Questions cache'ini güncelle
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

        // 3. Check if it's a location query
        const locationAnalysis = await geminiService.analyzeLocationQuery(message, history, detectedLanguage);
        console.log('🔍 Location analysis:', locationAnalysis);

        let response;
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

        // 4. For non-location queries, use standard response generation
        const knowledge = await firebaseService.searchKnowledge(hotel, detectedLanguage);
        response = await geminiService.generateResponse(
            chatHistory,
            knowledge.content,
            detectedLanguage,
            userLocation
        );

        return res.json({
            success: true,
            response: response.response
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
