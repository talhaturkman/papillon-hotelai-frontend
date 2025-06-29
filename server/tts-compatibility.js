
// TTS compatibility endpoint
app.post('/api/chat/tts', async (req, res) => {
    try {
        const { text, language = 'tr', gender = 'female' } = req.body;

            return res.status(400).json({ 
                success: false, 
                error: 'Text is required' 
            });
        }

        const maxLength = 500;
        const textToSynthesize = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

        console.log(`���️ TTS (chat route): "${textToSynthesize}" (${language}, ${gender})`);

        const elevenlabs = require('./services/elevenlabs');
        const audioBuffer = await elevenlabs.generateSpeech(textToSynthesize, language, gender);

            throw new Error('No audio buffer returned from TTS service');
        }

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        });

        console.log(`✅ TTS (chat route) successful: ${audioBuffer.length} bytes`);
        res.send(audioBuffer);

    } catch (error) {
        console.error('❌ TTS (chat route) Error:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'Voice synthesis failed',
            message: error.message,
            fallback: 'Ses sentezi şu anda kullanılamıyor.'
        });
    }
});

