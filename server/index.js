const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes - temporarily commented out for debugging
// const chatRoutes = require('./routes/chat');
// const adminRoutes = require('./routes/admin'); 
// const knowledgeRoutes = require('./routes/knowledge');

const app = express();
const PORT = process.env.PORT || 8080;

console.log('Ì¥ß Starting basic server without routes for debugging...');

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

// API Routes - temporarily commented out for debugging
// app.use('/api/chat', chatRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/knowledge', knowledgeRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: PORT,
        message: 'Basic server running - routes temporarily disabled for debugging'
    });
});

// Debug endpoint for environment variables
app.get('/api/debug/env', (req, res) => {
    res.json({
        GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY ? 'SET' : 'NOT_SET',
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        GEMINI_MODEL: process.env.GEMINI_MODEL,
        NODE_ENV: process.env.NODE_ENV,
        PORT: PORT,
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ? 'SET' : 'NOT_SET',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Server is working!',
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
    console.log('Ì∫Ä Papillon Hotels AI Server running on port ' + PORT);
    console.log('Ìºç Environment: ' + process.env.NODE_ENV);
    console.log('Ì¥ñ Gemini Model: ' + process.env.GEMINI_MODEL);
    console.log('Ì≥± Server accessible on all network interfaces (0.0.0.0:' + PORT + ')');
    console.log('‚ö†Ô∏è Routes temporarily disabled for debugging');
});
