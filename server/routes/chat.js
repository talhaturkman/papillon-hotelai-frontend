const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const geminiService = require('../services/gemini');
const firebaseService = require('../services/firebase');
const elevenLabsService = require('../services/elevenlabs');

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
    let { message, history, session_id } = req.body;

    if (!session_id) {
        session_id = uuidv4();
        console.log(`✨ New session started: ${session_id}`);
    }

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // The AI is now responsible for identifying support requests via a special tag.
        // Our logic is much simpler: just call the AI and check its response.

        // 1. Detect conversation context (hotel, language)
        const hotel = await geminiService.detectHotelWithAI(message, history);
        const detectedLanguage = await geminiService.detectLanguage(message, history);
        
        let knowledgeContext = null;
        if (hotel) {
            const knowledge = await firebaseService.searchKnowledge(message, hotel, detectedLanguage);
            if (knowledge && knowledge.length > 0) {
                knowledgeContext = knowledge[0].content;
            }
        }

        // 2. Generate AI response
        const fullHistory = [...history, { role: 'user', content: message }];
        const aiResult = await geminiService.generateResponse(fullHistory, knowledgeContext, detectedLanguage);

        let offerSupport = false;
        let finalResponse = '';

        if (!aiResult.success) {
            // Handle cases where the AI service itself fails
            offerSupport = true;
            finalResponse = 'Üzgünüm, yapay zeka servisinde bir sorun oluştu. Sizi bir temsilciye bağlamamı ister misiniz?';
        } else {
            finalResponse = aiResult.response;

            // 3. Check for the special support tag from the AI
            if (finalResponse.includes('[DESTEK_TALEBI]')) {
                offerSupport = true;
                
                // Replace the tag with a user-friendly message based on language
                const supportOfferMessages = {
                    'tr': 'Anladım, sizi bir müşteri temsilcisine bağlamamı ister misiniz?',
                    'en': 'I understand. Would you like me to connect you to a customer service agent?',
                    'de': 'Ich verstehe. Möchten Sie, dass ich Sie mit einem Kundendienstmitarbeiter verbinde?',
                    'ru': 'Я понимаю. Хотите, я соединю вас с представителем службы поддержки?'
                };
                finalResponse = supportOfferMessages[detectedLanguage] || supportOfferMessages['en'];
            }
        }
        
        // 4. Save the interaction to Firestore
        const interaction = {
            timestamp: new Date(),
            userInput: message,
            aiResponse: finalResponse,
            session_id: session_id,
            offerSupport: offerSupport,
            detectedHotel: hotel,
            detectedLanguage: detectedLanguage
        };
        await firebaseService.storeChatLog(interaction);

        // 5. Send response back to client, now including the session_id
        res.json({ 
            response: finalResponse,
            offerSupport: offerSupport,
            sessionId: session_id
        });

    } catch (error) {
        console.error('❌ Chat endpoint error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
