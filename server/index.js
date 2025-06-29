const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const knowledgeRoutes = require('./routes/knowledge');

const app = express();
const PORT = process.env.PORT || 8080;

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
        'http://192.168.4.151:3000',
        'http://192.168.4.151:5173',
        'http://192.168.7.2:3000',
        'http://192.168.7.2:5173',
        'http://192.168.137.1:3001',
        'https://192.168.137.1:3001',
        'http://192.168.137.1:63659',
        'http://192.168.137.1:3000',
        'http://192.168.137.1:5173',
        /^https?:\/\/192\.168\.\d+\.\d+:(3000|3001|5173|63659)$/,
        'https://gen-lang-client-0930707875.web.app',
        'https://ai.talhaturkman.com',
        'https://papillonai-backend.loca.lt'
    ],
    credentials: true
}));

// Rate limiting
if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        message: { error: 'Too many requests from this IP, please try again later.' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);
} else {
    const devLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        skip: (req) => {
            return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(devLimiter);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: PORT
    });
});

// Debug endpoint for environment variables
app.get('/api/debug/env', (req, res) => {
    res.json({
        DOCUMENT_AI_PROJECT_ID: process.env.DOCUMENT_AI_PROJECT_ID,
        DOCUMENT_AI_LOCATION: process.env.DOCUMENT_AI_LOCATION,
        DOCUMENT_AI_PROCESSOR_ID: process.env.DOCUMENT_AI_PROCESSOR_ID,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        GEMINI_MODEL: process.env.GEMINI_MODEL,
        NODE_ENV: process.env.NODE_ENV,
        PORT: PORT,
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
    console.log(`🚀 Papillon Hotels AI Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🤖 Gemini Model: ${process.env.GEMINI_MODEL}`);
    console.log(`🔧 Document AI Project: ${process.env.DOCUMENT_AI_PROJECT_ID}`);
    console.log(`📱 Server accessible on all network interfaces (0.0.0.0:${PORT})`);
});
