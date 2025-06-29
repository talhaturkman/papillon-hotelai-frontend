const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios'); // For Gemini API
require('dotenv').config();

// Import Firebase service
const firebaseService = require('./services/firebase');

// Import routes - with error handling
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

console.log('��� Starting backend server with Gemini AI + Firebase + Admin integration...');

// Initialize Firebase
firebaseService.initialize().catch(err => {
    console.warn('⚠️ Firebase initialization failed, continuing without Firebase:', err.message);
});

// Trust proxy settings for proper IP detection
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

// Gemini AI function
async function callGeminiAPI(messages, detectedLanguage = 'tr') {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
        
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }

        const systemPrompt = `Sen Papillon Hotels'in yapay zeka asistanısın. Papillon Hotels'un 3 oteli var: Belvil, Zeugma ve Ayscha. 

ÖNEMLİ: SADECE TÜRKÇE YANIT VER!

OTEL TESPİTİ VE BİLGİ PAYLAŞIMI:
- Eğer soru GENEL nitelikte ise (selam, nasılsın, teşekkür vb.) direkt yanıtla, otel sorma
- Eğer soru KİŞİSEL/GENEL ise (personel tanıma, genel sohbet) direkt yanıtla, otel sorma  
- Eğer soru OTEL-SPESİFİK ise (odalar, restoranlar, aktiviteler, spa, pool vb.) VE otel belirtilmemişse, o zaman sor: "Bu bilgiyi size doğru şekilde verebilmem için hangi Papillon otelinde konaklamaktasınız? Belvil, Zeugma yoksa Ayscha?"
- Eğer zaten otel context'i varsa, direkt bilgi ver

YANITLAMA KURALLARI:
- Yanıtlarını düzenli ve okunaklı şekilde formatla
- Önemli bilgileri **kalın** yap
- Başlıklar için ### kullan
- Liste için - kullan
- Sayılı liste için 1. 2. 3. kullan
- Karmaşık bilgileri kategorilere ayır
- Kısa ve net yanıtlar ver

Misafirlerin sorularını doğal şekilde yanıtla. Sadece otel-spesifik bilgi gerektiğinde otel sor. TÜM YANITLARIN TÜRKÇE OLMALI.`;

        let conversationHistory = [
            {
                role: "user",
                parts: [{ text: systemPrompt }]
            },
            {
                role: "model", 
                parts: [{ text: "Anladım! Papillon Hotels asistanı olarak yardımcı olmaya hazırım." }]
            }
        ];

        messages.forEach(message => {
            conversationHistory.push({
                role: message.role === 'user' ? 'user' : 'model',
                parts: [{ text: message.content }]
            });
        });

        const requestData = {
            contents: conversationHistory,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        
        const response = await axios.post(
            `${apiUrl}?key=${apiKey}`,
            requestData,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000
            }
        );

        if (response.data && response.data.candidates && response.data.candidates[0]) {
            const aiResponse = response.data.candidates[0].content.parts[0].text;
            console.log(`✅ Gemini API Success: Response length ${aiResponse.length} chars`);
            return {
                success: true,
                response: aiResponse
            };
        } else {
            throw new Error('Unexpected response format from Gemini API');
        }

    } catch (error) {
        console.error('❌ Gemini API Error:', error.message);
        return {
            success: false,
            error: error.message,
            fallbackResponse: 'Üzgünüm, şu anda AI sistemimde teknik bir sorun var. Lütfen tekrar deneyin.'
        };
    }
}

// Chat endpoint with Gemini AI + Firebase logging
app.post('/api/chat/message', async (req, res) => {
    try {
        const { message, sessionId, chatHistory = [] } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Generate session ID if not provided
        const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`��� Chat message received: "${message}"`);

        // Call Gemini AI
        const messages = [
            ...chatHistory,
            { role: 'user', content: message }
        ];

        const aiResult = await callGeminiAPI(messages);

        let finalResponse;
        if (aiResult.success) {
            console.log(`��� AI response generated successfully`);
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
                console.log(`✅ Chat stored to Firebase: ${currentSessionId}`);
            } else {
                console.log(`⚠️ Firebase not available, chat not stored`);
            }
        } catch (firebaseError) {
            console.warn('⚠️ Failed to store chat log:', firebaseError.message);
            // Don't fail the request if Firebase fails
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

// Mount admin routes (if available)
if (adminRoutes) {
    console.log('✅ Mounting admin routes at /api/admin');
    app.use('/api/admin', adminRoutes);
} else {
    console.log('⚠️ Admin routes not available');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: PORT,
        message: 'Backend server with Gemini AI + Firebase + Admin integration',
        firebase: firebaseService.isInitialized ? 'Connected' : 'Disabled',
        adminRoutes: adminRoutes ? 'Loaded' : 'Disabled'
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
        admin_routes_loaded: adminRoutes ? true : false
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Backend server with Gemini AI + Firebase + Admin integration is working!',
        timestamp: new Date().toISOString()
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
    console.log(`��� Papillon Hotels AI Server running on port ${PORT}`);
    console.log(`��� Environment: ${process.env.NODE_ENV}`);
    console.log(`��� Gemini AI Model: ${process.env.GEMINI_MODEL}`);
    console.log(`��� Firebase: ${firebaseService.isInitialized ? 'Connected' : 'Disabled'}`);
    console.log(`���‍��� Admin Panel: ${adminRoutes ? 'Enabled' : 'Disabled'}`);
    console.log(`��� AI chat endpoint active at /api/chat/message`);
    console.log(`��� Admin panel available at /api/admin/*`);
    console.log(`��� Server accessible on all network interfaces (0.0.0.0:${PORT})`);
});
