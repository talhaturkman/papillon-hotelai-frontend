const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import routes
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const knowledgeRoutes = require('./routes/knowledge');

const app = express();
const PORT = process.env.PORT || 5002; // Cloud Run uses port 8080

// Trust proxy settings for proper IP detection
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// Security middleware
app.use(helmet());
app.options('*', cors()); // Enable pre-flight requests for all routes
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? [
        'https://ai.talhaturkman.com',           // Production frontend domain
        'https://gen-lang-client-0930707875.web.app',  // Firebase hosting backup
        'https://talhaturkman.com',              // Root domain
        'https://www.talhaturkman.com',          // WWW subdomain
        'https://papillonai.netlify.app',        // Netlify ana domain (örnek)
        // Kendi Netlify domaininizi aşağıya ekleyin:
        // 'https://senin-netlify-domainin.netlify.app',
    ] : [
        'http://localhost:3000', 
        'http://localhost:5173',
        'http://192.168.203.16:3000',  // User's mobile hotspot IP - verified
        'http://192.168.4.151:3000',   // Ethernet IP - port 3000
        'http://192.168.4.151:5173',   // Ethernet IP - port 5173  
        'http://192.168.7.2:3000',     // Other IP - port 3000
        'http://192.168.7.2:5173',     // Other IP - port 5173
        'http://192.168.137.1:3001',   // 🚀 Hotspot IP - port 3001 (Production Build HTTP)
        'https://192.168.137.1:3001',  // 🔐 Hotspot IP - port 3001 (Production Build HTTPS)
        'http://192.168.137.1:63659',   // ✨ Hotspot IP - port 63659 (Serve SPA)
        'http://192.168.137.1:3000',   // 🔥 Hotspot IP - port 3000 (CRITICAL!)
        'http://192.168.137.1:5173',   // Hotspot IP - port 5173
        /^https?:\/\/192\.168\.\d+\.\d+:(3000|3001|5173|63659)$/,
        'https://gen-lang-client-0930707875.web.app',  // Current Firebase hosting
        'https://ai.talhaturkman.com',           // Production frontend domain
        'https://papillonai-backend.loca.lt'     // Current tunnel
    ],
    credentials: true
}));

// Rate limiting - only in production or when needed
if (process.env.NODE_ENV === 'production') {
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
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
}

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/support', require('./routes/support')); // Canlı Destek Rotası

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
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
        timestamp: new Date().toISOString()
    });
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
});
}

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
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Papillon Hotels AI Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🤖 Gemini Model: ${process.env.GEMINI_MODEL}`);
    console.log(`🔧 Document AI Project: ${process.env.DOCUMENT_AI_PROJECT_ID}`);
    console.log(`📱 Server accessible on all network interfaces (0.0.0.0:${PORT})`);
});