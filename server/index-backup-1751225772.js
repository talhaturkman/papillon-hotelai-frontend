const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import Firebase service
const firebaseService = require('./services/firebase');

// Import chat routes with error handling - FOR KNOWLEDGE BASE INTEGRATION
let chatRoutes = null;
try {
    chatRoutes = require('./routes/chat');
    console.log('✅ Chat routes loaded successfully');
} catch (error) {
    console.warn('⚠️ Chat routes failed to load:', error.message);
}

// Import admin routes with error handling
let adminRoutes = null;
try {
    adminRoutes = require('./routes/admin');
    console.log('✅ Admin routes loaded successfully');
} catch (error) {
    console.warn('⚠️ Admin routes failed to load:', error.message);
}

const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 Starting COMPLETE Papillon Hotels AI Server...');

// Initialize Firebase
firebaseService.initialize().catch(err => {
    console.warn('⚠️ Firebase initialization failed, continuing without Firebase:', err.message);
});

// Trust proxy settings
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? [
        'https://ai.talhaturkman.com',
        'https://gen-lang-client-0930707875.web.app',
        'https://talhaturkman.com',
        'https://www.talhaturkman.com'
    ] : [
        'http://localhost:3000', 
        'http://localhost:5173',
        'https://gen-lang-client-0930707875.web.app',
        'https://ai.talhaturkman.com'
    ],
    credentials: true
}));

// Rate limiting
if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: { error: 'Too many requests from this IP, please try again later.' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount chat routes FIRST - for knowledge base integration
if (chatRoutes) {
    console.log('✅ Using ADVANCED chat routes with knowledge base');
    app.use('/api/chat', chatRoutes);
} else {
    console.log('⚠️ Using FALLBACK basic chat endpoint');
    
    // FALLBACK: Basic chat endpoint (current problematic one)
    app.post('/api/chat/message', async (req, res) => {
        try {
            const { message, sessionId, chatHistory = [] } = req.body;

            if (!message || !message.trim()) {
                return res.status(400).json({ error: 'Message is required' });
            }

            const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            console.log(`⚠️ FALLBACK Chat message received: "${message}"`);

            const messages = [
                ...chatHistory,
                { role: 'user', content: message }
            ];

            const aiResult = await callGeminiAPI(messages);

            let finalResponse;
            if (aiResult.success) {
                console.log(`⚠️ AI response generated successfully`);
                finalResponse = aiResult.response;
            } else {
                console.log(`⚠️ Using fallback response due to AI error`);
                finalResponse = aiResult.fallbackResponse;
            }

            // Store conversation in Firebase (if available)
            try {
                if (firebaseService.isInitialized) {
                    const conversationData = {
                        sessionId: currentSessionId,
                        userMessage: message,
                        aiResponse: finalResponse,
                        timestamp: new Date().toISOString(),
                        userAgent: req.headers['user-agent'] || 'unknown',
                        ipAddress: req.ip || req.connection.remoteAddress || 'unknown'
                    };

                    await firebaseService.storeChatLog(conversationData);
                    console.log(`⚠️ Chat stored to Firebase: ${currentSessionId}`);
                } else {
                    console.log(`⚠️ Firebase not available, chat not stored`);
                }
            } catch (firebaseError) {
                console.warn('⚠️ Failed to store chat log:', firebaseError.message);
            }

            res.json({
                success: true,
                response: finalResponse,
                sessionId: currentSessionId,
                placesData: null
            });

        } catch (error) {
            console.error('❌ Chat endpoint error:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                fallbackMessage: 'Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen tekrar deneyin.'
            });
        }
    });
}

// Mount admin routes (if available)
if (adminRoutes) {
    console.log('✅ Mounting admin routes at /api/admin');
    app.use('/api/admin', adminRoutes);
} else {
    console.log('⚠️ Admin routes not available');
}

// Voice/TTS endpoint using ElevenLabs
app.post('/api/voice/synthesize', async (req, res) => {
    try {
        const { text, language = 'tr', gender = 'female' } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Text is required' 
            });
        }

        // Limit text length for TTS
        const maxLength = 500;
        const textToSynthesize = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

        console.log(`⚠️️ TTS request: "${textToSynthesize}" (${language}, ${gender})`);

        // Import ElevenLabs service
        const elevenlabs = require('./services/elevenlabs');

        // Generate speech
        const audioBuffer = await elevenlabs.generateSpeech(textToSynthesize, language, gender);

        if (!audioBuffer) {
            throw new Error('No audio buffer returned from TTS service');
        }

        // Set appropriate headers for audio response
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        });

        console.log(`✅ TTS successful: ${audioBuffer.length} bytes`);
        res.send(audioBuffer);

    } catch (error) {
        console.error('❌ TTS Error:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'Voice synthesis failed',
            message: error.message,
            fallback: 'Ses sentezi şu anda kullanılamıyor. API key kontrolü gerekebilir.'
        });
    }
});

// Test TTS endpoint
app.get('/api/voice/test', async (req, res) => {
    try {
        const elevenlabs = require('./services/elevenlabs');
        
        // Test API key validity
        const testResult = await elevenlabs.testApiKey();
        
        res.json({
            success: true,
            elevenlabs: testResult,
            message: 'Voice service test completed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: PORT,
        message: 'FIXED Papillon Hotels AI Server - Knowledge Base Active',
        firebase: firebaseService.isInitialized ? 'Connected' : 'Disabled',
        adminRoutes: adminRoutes ? 'Loaded' : 'Disabled',
        chatRoutes: chatRoutes ? 'Loaded (KNOWLEDGE BASE)' : 'Fallback',
        voiceFeatures: 'Enabled'
    });
});

// Debug endpoint for environment variables
app.get('/api/debug/env', (req, res) => {
    res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'SET' : 'NOT_SET',
        GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY ? 'SET' : 'NOT_SET',
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ? 'SET' : 'NOT_SET',
        ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'papillon_admin',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'SET' : 'DEFAULT',
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        GEMINI_MODEL: process.env.GEMINI_MODEL,
        NODE_ENV: process.env.NODE_ENV,
        PORT: PORT,
        timestamp: new Date().toISOString(),
        firebase_initialized: firebaseService.isInitialized,
        admin_routes_loaded: adminRoutes ? true : false,
        chat_routes_loaded: chatRoutes ? true : false,
        voice_features: 'enabled'
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        message: 'FIXED Papillon Hotels AI Server - Knowledge Base Active!',
        features: [
            'Gemini AI Chat ✅',
            'Firebase Integration ✅', 
            'Knowledge Base ' + (chatRoutes ? '✅' : '❌'),
            'Admin Panel ' + (adminRoutes ? '✅' : '❌'),
            'Voice Synthesis ✅',
            'Places API ' + (chatRoutes ? '✅' : '❌'),
            'Analytics ' + (adminRoutes ? '✅' : '❌')
        ],
        timestamp: new Date().toISOString()
    });
});

// Root welcome page
app.get('/', (req, res) => {
    res.json({
        message: '🦋 Papillon Hotels AI Backend Server',
        status: 'RUNNING',
        version: '1.0.0',
        features: {
            'Gemini AI Chat': chatRoutes ? '✅ Active' : '⚠️ Fallback Mode',
            'Firebase Integration': firebaseService.isInitialized ? '✅ Connected' : '❌ Disabled',
            'Knowledge Base': chatRoutes ? '✅ Active' : '❌ Disabled',
            'Admin Panel': adminRoutes ? '✅ Enabled' : '❌ Disabled',
            'Voice Synthesis': '✅ ElevenLabs TTS',
            'Places API': chatRoutes ? '✅ Google Places' : '❌ Disabled',
            'Analytics': adminRoutes ? '✅ AI Analytics' : '❌ Disabled'
        },
        endpoints: {
            'Chat': '/api/chat/message',
            'Health Check': '/api/health', 
            'Admin Panel': '/api/admin/*',
            'Voice Synthesis': '/api/voice/synthesize',
            'Test': '/api/test'
        },
        frontend: 'https://gen-lang-client-0930707875.web.app',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FIXED Papillon Hotels AI Server running on port ${PORT}`);
    console.log(`🚀 Environment: ${process.env.NODE_ENV}`);
    console.log(`🚀 Gemini AI Model: ${process.env.GEMINI_MODEL}`);
    console.log(`🚀 Firebase: ${firebaseService.isInitialized ? 'Connected' : 'Disabled'}`);
    console.log(`🚀 Admin Panel: ${adminRoutes ? 'Enabled' : 'Disabled'}`);
    console.log(`🚀 Knowledge Base: ${chatRoutes ? 'ACTIVE' : 'DISABLED'}`);
    console.log(`🚀️ Voice Features: Enabled (ElevenLabs TTS)`);
    console.log(`🚀 AI chat endpoint active at /api/chat/message`);
    console.log(`🚀 Admin panel available at /api/admin/*`);
    console.log(`🚀 Voice synthesis available at /api/voice/synthesize`);
    console.log(`🚀 Server accessible on all network interfaces (0.0.0.0:${PORT})`);
    console.log(`✨ FIXED: Knowledge Base ${chatRoutes ? 'ACTIVE' : 'INACTIVE'} ✨`);
});
