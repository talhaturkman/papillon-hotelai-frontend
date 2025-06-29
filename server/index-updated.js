const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
require('dotenv').config();

// Import routes
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const knowledgeRoutes = require('./routes/knowledge');

const app = express();
const PORT = config.PORT;

// Trust proxy settings for proper IP detection
app.set('trust proxy', config.NODE_ENV === 'production' ? 1 : false);

// Security middleware
app.use(helmet());
app.use(cors({
    origin: config.NODE_ENV === 'production' ? config.PRODUCTION_ORIGINS : config.DEVELOPMENT_ORIGINS,
    credentials: true
}));

// Rate limiting - only in production or when needed
if (config.NODE_ENV === 'production') {
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: {
            error: 'Too many requests from this IP, please try again later.'
        },
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
    app.use(limiter);
} else {
    // In development, use more relaxed rate limiting
    const devLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Much higher limit for development
        skip: (req) => {
            // Skip rate limiting for localhost
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

// Serve static files from React app in production
if (config.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
}

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
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
        NODE_ENV: config.NODE_ENV,
        PORT: PORT,
        timestamp: new Date().toISOString()
    });
});

// Serve React app for all other routes in production
if (config.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: config.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Papillon Hotels AI Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${config.NODE_ENV}`);
    console.log(`🤖 Gemini Model: ${process.env.GEMINI_MODEL}`);
    console.log(`🔧 Document AI Project: ${process.env.DOCUMENT_AI_PROJECT_ID}`);
    console.log(`📱 Server accessible on all network interfaces (0.0.0.0:${PORT})`);
}); 