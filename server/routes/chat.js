const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');
const firebaseService = require('../services/firebase');
const placesService = require('../services/places');
const naturalLanguageService = require('../services/naturalLanguage');
const elevenlabs = require('../services/elevenlabs');

// Chat endpoint for guest interactions
router.post('/message', async (req, res) => {
    try {
        const { message, sessionId, chatHistory = [], userLocation = null } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Generate session ID if not provided
        const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Detect language and hotel from user message with conversation context
        const detectedLanguage = await naturalLanguageService.detectLanguageWithContext(message, chatHistory);
        const detectedHotel = extractHotelName(message, chatHistory);
        
        console.log(`🌐 Language detection: "${message}" → ${detectedLanguage}`);

        // Search for relevant knowledge base documents
        let knowledgeContext = '';
        try {
            let searchResults = [];
            
            // STRATEGY 1: Try detected hotel + language first (if both available)
            if (detectedHotel && detectedLanguage) {
                searchResults = await firebaseService.searchKnowledge(
                    message, 
                    detectedHotel, 
                    detectedLanguage
                );
                console.log(`🔍 Strategy 1: Found ${searchResults.length} results for ${detectedHotel}-${detectedLanguage}`);
            }
            
            // STRATEGY 2: If no results, try detected hotel + all languages
            if (searchResults.length === 0 && detectedHotel) {
                searchResults = await firebaseService.searchKnowledge(
                    message, 
                    detectedHotel, 
                    null
                );
                console.log(`🔍 Strategy 2: Found ${searchResults.length} results for ${detectedHotel}-all languages`);
            }
            
            // STRATEGY 3: If still no results, try all hotels + detected language
            if (searchResults.length === 0 && detectedLanguage) {
                searchResults = await firebaseService.searchKnowledge(
                    message, 
                    null, 
                    detectedLanguage
                );
                console.log(`🔍 Strategy 3: Found ${searchResults.length} results for all hotels-${detectedLanguage}`);
            }
            
            // STRATEGY 4: Final fallback - search everything
            if (searchResults.length === 0) {
                searchResults = await firebaseService.searchKnowledge(
                    message, 
                    null, 
                    null
                );
                console.log(`🔍 Strategy 4: Found ${searchResults.length} results for all hotels-all languages`);
            }
            
            if (searchResults && searchResults.length > 0) {
                knowledgeContext = searchResults.map(doc => doc.content).join('\n\n');
                console.log(`📚 Final knowledge context: ${searchResults.length} documents (${knowledgeContext.length} chars)`);
            } else {
                console.log(`📭 No relevant documents found after all strategies`);
            }
        } catch (error) {
            console.warn('⚠️ Knowledge search failed:', error.message);
        }

        // Check for location-based queries and get Places API data
        let placesContext = '';
        let placesResult = null;
        let isLocationQuery = false; // Initialize outside try block
        try {
            // Use enhanced AI-powered location detection
            isLocationQuery = await placesService.isLocationQueryEnhanced(message, chatHistory, detectedLanguage);
            
            if (isLocationQuery) {
                console.log('🗺️ Enhanced AI detected location query:', message);
                console.log('📍 Received userLocation:', userLocation);
                
                // Use detected hotel context or default to first hotel mentioned
                const hotelForPlaces = detectedHotel ? detectedHotel.toLowerCase() : null;
                console.log('🏨 Hotel context for places:', hotelForPlaces);
                
                // Use user location if available, otherwise fall back to hotel location
                placesResult = await placesService.handleLocationQuery(
                    message, 
                    hotelForPlaces, 
                    detectedLanguage,
                    userLocation
                );
                
                if (placesResult.hasResults) {
                    placesContext = placesResult.placesData;
                    console.log(`🏪 Found places data for: ${placesResult.hotelLocation?.name || 'Unknown'}`);
                    console.log(`📍 Search was performed from: ${placesResult.locationContext === 'user' ? 'User Location' : 'Hotel Location'}`);
                } else {
                    console.log('🏪 No places found for location query');
                }
            }
        } catch (error) {
            console.warn('⚠️ Places search failed:', error.message);
        }

        // Combine knowledge and places context
        let combinedContext = '';
        if (knowledgeContext) {
            combinedContext += `OTEL BİLGİLERİ:\n${knowledgeContext}\n\n`;
        }
        if (placesContext) {
            combinedContext += `KONUM BİLGİLERİ:\n${placesContext}`;
        }

        // Log user location usage
        if (userLocation) {
            console.log(`📍 User provided location: (${userLocation.lat}, ${userLocation.lng})`);
        }

        const messages = [
            ...chatHistory,
            { role: 'user', content: message }
        ];

        const aiResult = await geminiService.generateResponse(messages, combinedContext || null, detectedLanguage);

        if (!aiResult.success) {
            return res.status(500).json({ 
                error: aiResult.error,
                fallbackMessage: 'Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen tekrar deneyin.'
            });
        }

        // Store conversation in Firebase chatlog collection
        try {
            const conversationData = {
                sessionId: currentSessionId,
                userMessage: message,
                aiResponse: aiResult.response,
                timestamp: new Date().toISOString(),
                userAgent: req.headers['user-agent'] || 'unknown',
                ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
                detectedHotel: detectedHotel,
                detectedLanguage: detectedLanguage,
                hadKnowledgeContext: !!knowledgeContext,
                hadPlacesContext: !!placesContext,
                isLocationQuery: isLocationQuery,
                userLocationProvided: !!userLocation,
                locationContext: placesResult?.locationContext || null
            };

            // Store in chatlog collection
            await firebaseService.storeChatLog(conversationData);
            console.log(`✅ Chat stored to Firebase: ${currentSessionId}`);
        } catch (error) {
            console.warn('⚠️ Failed to store chat log:', error.message);
            // Don't fail the request if logging fails
        }

        res.json({
            success: true,
            response: aiResult.response,
            sessionId: currentSessionId,
            // Send Places API data for map rendering - send if location query detected
            placesData: placesResult ? {
                hasPlaces: !!placesResult?.hasResults,
                hotelLocation: placesResult?.hotelLocation,
                userQuery: message,
                searchQuery: placesResult?.searchQuery,
                rawPlaces: placesResult?.rawPlaces,
                isLocationQuery: true,
                locationContext: placesResult?.locationContext
            } : null
        });

    } catch (error) {
        console.error('❌ Chat endpoint error:', error);
        res.status(500).json({ 
            error: 'Internal server error'
        });
    }
});

// Get chat history for a session
router.get('/history/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // Here you could implement fetching chat history from Firebase
        // For now, return empty array
        res.json({
            success: true,
            history: [],
            sessionId
        });

    } catch (error) {
        console.error('❌ Chat history error:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

// ElevenLabs TTS endpoint
router.post('/tts', async (req, res) => {
    try {
        const { text, language = 'tr', gender = 'female' } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        console.log(`🎙️ TTS Request: ${text.substring(0, 50)}... (${language})`);

        // Generate speech using ElevenLabs
        const audioBuffer = await elevenlabs.generateSpeech(text, language, gender);
        
        // Set appropriate headers for audio response
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'no-cache'
        });

        res.send(audioBuffer);

    } catch (error) {
        console.error('❌ TTS Error:', error.message);
        res.status(500).json({ 
            error: 'TTS generation failed',
            details: error.message 
        });
    }
});

// Get ElevenLabs usage info
router.get('/tts/usage', async (req, res) => {
    try {
        const usage = await elevenlabs.getUsage();
        res.json(usage);
    } catch (error) {
        console.error('❌ TTS Usage Error:', error.message);
        res.status(500).json({ 
            error: 'Failed to get TTS usage',
            details: error.message 
        });
    }
});

// Get available voices
router.get('/tts/voices', async (req, res) => {
    try {
        const voices = await elevenlabs.getVoices();
        res.json(voices);
    } catch (error) {
        console.error('❌ TTS Voices Error:', error.message);
        res.status(500).json({ 
            error: 'Failed to get TTS voices',
            details: error.message 
        });
    }
});

// Test ElevenLabs API key
router.get('/tts/test', async (req, res) => {
    try {
        const result = await elevenlabs.testApiKey();
        if (result.valid) {
            res.json({
                status: 'success',
                message: 'ElevenLabs API key is valid',
                user: result.user
            });
        } else {
            res.status(401).json({
                status: 'error',
                message: 'ElevenLabs API key is invalid',
                error: result.error
            });
        }
    } catch (error) {
        console.error('❌ TTS Test Error:', error.message);
        res.status(500).json({ 
            error: 'Failed to test ElevenLabs API key',
            details: error.message 
        });
    }
});

// Helper functions
function extractHotelName(text, chatHistory = []) {
    const hotels = ['belvil', 'zeugma', 'ayscha'];
    const textLower = text.toLowerCase();
    
    // 1. Direct hotel name match (mevcut sistem)
    for (const hotel of hotels) {
        if (textLower.includes(hotel)) {
            return hotel.charAt(0).toUpperCase() + hotel.slice(1);
        }
    }
    
    // 2. Turkish patterns - çekim ekleri ve yaygın ifadeler
    const turkishPatterns = [
        // "Ben X'de kalıyorum" formatları
        /ben\s+(belvil|zeugma|ayscha)['']?d[ae]\s+kal/i,
        /(belvil|zeugma|ayscha)['']?d[ae]\s+kal/i,
        // "X'dan yazıyorum" formatları  
        /(belvil|zeugma|ayscha)['']?dan\s+yaz/i,
        /(belvil|zeugma|ayscha)['']?den\s+yaz/i,
        // "X otelinde" formatları
        /(belvil|zeugma|ayscha)\s+otel/i,
        /papillon\s+(belvil|zeugma|ayscha)/i,
        // "X'de konaklıyorum" formatları
        /(belvil|zeugma|ayscha)['']?d[ae]\s+konak/i
    ];
    
    for (const pattern of turkishPatterns) {
        const match = textLower.match(pattern);
        if (match && match[1]) {
            const hotel = match[1].toLowerCase();
            return hotel.charAt(0).toUpperCase() + hotel.slice(1);
        }
    }
    
    // 3. Chat history'den otel tespiti - son 3 mesajı kontrol et (recursive olmadan)
    if (chatHistory && chatHistory.length > 0) {
        const recentMessages = chatHistory.slice(-3);
        for (const msg of recentMessages) {
            if (msg.content) {
                const msgLower = msg.content.toLowerCase();
                
                // Direkt hotel ismi arama
                for (const hotel of hotels) {
                    if (msgLower.includes(hotel)) {
                        console.log(`🏨 Hotel detected from chat history: ${hotel.charAt(0).toUpperCase() + hotel.slice(1)}`);
                        return hotel.charAt(0).toUpperCase() + hotel.slice(1);
                    }
                }
                
                // Turkish patterns arama
                const turkishPatterns = [
                    /ben\s+(belvil|zeugma|ayscha)['']?d[ae]\s+kal/i,
                    /(belvil|zeugma|ayscha)['']?d[ae]\s+kal/i,
                    /(belvil|zeugma|ayscha)['']?dan\s+yaz/i,
                    /(belvil|zeugma|ayscha)['']?den\s+yaz/i,
                    /(belvil|zeugma|ayscha)\s+otel/i,
                    /papillon\s+(belvil|zeugma|ayscha)/i,
                    /(belvil|zeugma|ayscha)['']?d[ae]\s+konak/i
                ];
                
                for (const pattern of turkishPatterns) {
                    const match = msgLower.match(pattern);
                    if (match && match[1]) {
                        const hotel = match[1].toLowerCase();
                        console.log(`🏨 Hotel detected from chat history (pattern): ${hotel.charAt(0).toUpperCase() + hotel.slice(1)}`);
                        return hotel.charAt(0).toUpperCase() + hotel.slice(1);
                    }
                }
            }
        }
    }
    
    // 4. English patterns
    const englishPatterns = [
        /staying\s+at\s+(belvil|zeugma|ayscha)/i,
        /at\s+papillon\s+(belvil|zeugma|ayscha)/i,
        /(belvil|zeugma|ayscha)\s+hotel/i
    ];
    
    for (const pattern of englishPatterns) {
        const match = textLower.match(pattern);
        if (match && match[1]) {
            const hotel = match[1].toLowerCase();
            return hotel.charAt(0).toUpperCase() + hotel.slice(1);
        }
    }
    
    return null;
}

module.exports = router; 