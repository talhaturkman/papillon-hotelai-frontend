const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const geminiService = require('../services/gemini');
const firebaseService = require('../services/firebase');
const elevenLabsService = require('../services/elevenlabs');
const translationService = require('../services/translation');
const placesService = require('../services/places');

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

        // The AI is now responsible for identifying support requests via a special tag.
        // Our logic is much simpler: just call the AI and check its response.

        // 1. Detect conversation context (hotel, language)
        const hotel = await geminiService.detectHotelWithAI(message, history);
        const detectedLanguage = await geminiService.detectLanguage(message, history);
        
        // Add user's message to history for this turn
        const chatHistory = [...history, { role: 'user', content: message }];

        // Asynchronously log the question for analytics without waiting for it to complete
        firebaseService.logQuestionForAnalysis({
            message,
            detectedHotel: hotel,
            detectedLanguage,
            sessionId: session_id
        });

        // NEW: Check if this is a location-based query FIRST
        const isLocation = await placesService.isLocationQueryEnhanced(message, history, detectedLanguage);

        let knowledgeContext = null;
        let aiResult;

        if (isLocation) {
            console.log('📍 This is a location query. Using PlacesService...');
            aiResult = await placesService.handleLocationQuery(message, hotel, detectedLanguage, userLocation);
        } else {
            console.log('📚 This is a knowledge query. Fetching all relevant knowledge...');
            
            let combinedKnowledge = {};

            // 1. Fetch general and daily knowledge
            if (hotel) {
                const knowledgeResult = await firebaseService.searchKnowledge(hotel, detectedLanguage);
                if (knowledgeResult.success && knowledgeResult.content) {
                    combinedKnowledge = { ...knowledgeResult.content };
                    console.log(`🧠 General/Daily knowledge loaded for ${hotel}/${detectedLanguage}`);
                }
            }

            // 2. Check for SPA context and fetch SPA catalog if needed
            const isSpaQuery = await geminiService.isSpaQuery(message, history, detectedLanguage);
            if (isSpaQuery && hotel) {
                 const spaCatalog = await firebaseService.getSpaCatalog(hotel, detectedLanguage);
                 if (spaCatalog) {
                    combinedKnowledge.spa = spaCatalog;
                    console.log(`🧖‍♀️ SPA Catalog loaded for ${hotel}/${detectedLanguage}`);
                 }
            }

            // Convert the combined knowledge object to a JSON string to pass to the AI
            const knowledgeContextString = Object.keys(combinedKnowledge).length > 0 ? JSON.stringify(combinedKnowledge) : null;

            // 3. Generate AI response using the combined knowledge
            aiResult = await geminiService.generateResponse(chatHistory, knowledgeContextString, detectedLanguage, userLocation);
        }

        if (!aiResult.success) {
            return res.status(500).json({ success: false, error: 'AI service failed' });
        }
        
        // 3. Final Step: Force translation to the user's language
        const finalResponse = await translationService.translateText(aiResult.response, detectedLanguage);

        const responsePayload = {
            success: true,
            response: finalResponse,
            sessionId: session_id,
            placesData: aiResult.placesData,
            offerSupport: finalResponse.includes('[DESTEK_TALEBI]')
        };
        
        // 4. Add the final assistant message to history for storage
        const finalHistory = [...chatHistory, { role: 'assistant', content: finalResponse }];
        await firebaseService.storeChatConversation(session_id, finalHistory);
        
        res.json(responsePayload);

    } catch (error) {
        console.error('❌ Chat endpoint error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router; 
