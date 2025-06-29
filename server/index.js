const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

console.log('Ì∫Ä Starting backend server with basic chat functionality...');

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

// Simple chat endpoint for testing - no external dependencies
app.post('/api/chat/message', (req, res) => {
    try {
        const { message, sessionId, chatHistory = [] } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Generate session ID if not provided
        const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Mock response for testing
        const mockResponse = `Merhaba! "${message}" mesajƒ±nƒ±zƒ± aldƒ±m. ≈ûu anda test modundayƒ±m, yakƒ±nda tam AI fonksiyonlarƒ± aktif olacak. Ì∫Ä`;

        console.log(`Ì≤¨ Chat message received: "${message}" - responding with mock message`);

        res.json({
            success: true,
            response: mockResponse,
            sessionId: currentSessionId,
            placesData: null
        });

    } catch (error) {
        console.error('‚ùå Chat endpoint error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            fallbackMessage: '√úzg√ºn√ºm, ≈üu anda teknik bir sorun ya≈üƒ±yorum. L√ºtfen tekrar deneyin.'
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
        message: 'Backend server with basic chat endpoint'
    });
});

// Debug endpoint for environment variables
app.get('/api/debug/env', (req, res) => {
    res.json({
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        GEMINI_MODEL: process.env.GEMINI_MODEL,
        NODE_ENV: process.env.NODE_ENV,
        PORT: PORT,
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Backend server is working!',
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
    console.log(`Ì∫Ä Papillon Hotels AI Server running on port ${PORT}`);
    console.log(`Ìºç Environment: ${process.env.NODE_ENV}`);
    console.log(`Ì≤¨ Basic chat endpoint active at /api/chat/message`);
    console.log(`Ì≥± Server accessible on all network interfaces (0.0.0.0:${PORT})`);
});
