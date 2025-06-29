
// TTS compatibility endpoint for frontend
app.post('/api/chat/tts', async (req, res) => {
    try {
        const { text, language = 'tr', gender = 'female' } = req.body;
            return res.status(400).json({ success: false, error: 'Text is required' });
        }
        const maxLength = 500;
        const textToSynthesize = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        console.log('ÌæôÔ∏è TTS (chat route):', textToSynthesize.substring(0, 50) + '...');
        const elevenlabs = require('./services/elevenlabs');
        const audioBuffer = await elevenlabs.generateSpeech(textToSynthesize, language, gender);
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        });
        console.log('‚úÖ TTS (chat route) successful:', audioBuffer.length, 'bytes');
        res.send(audioBuffer);
    } catch (error) {
        console.error('‚ùå TTS (chat route) Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Voice synthesis failed',
            message: error.message
        });
    }
});

