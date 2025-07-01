const express = require('express');
const router = express.Router();
const analyticsRoutes = require('./analytics');

// Admin credentials (in production, use environment variables or database)
const ADMIN_CREDENTIALS = {
    username: process.env.ADMIN_USERNAME || 'papillon_admin',
    password: process.env.ADMIN_PASSWORD || 'Papillon2024!'
};

// Simple session storage (in production, use Redis or database)
const sessions = new Map();

// Admin login endpoint
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        sessions.set(sessionToken, { username, expiry: sessionExpiry });
        
        console.log(`✅ Admin login successful: ${username}`);
        res.json({ success: true, token: sessionToken });
    } else {
        res.status(401).json({ success: false, message: 'Kullanıcı adı veya şifre hatalı' });
    }
});

// Admin logout endpoint
router.post('/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && sessions.has(token)) {
        sessions.delete(token);
    }
    res.json({ success: true, message: 'Çıkış yapıldı' });
});

// Middleware to check admin authentication
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = token ? sessions.get(token) : null;
    
    if (session && session.expiry >= Date.now()) {
    req.user = session;
    next();
    } else {
        if (session) sessions.delete(token);
        res.status(401).json({ success: false, message: 'Oturum geçersiz veya süresi dolmuş' });
    }
};

// Check authentication status
router.get('/check-auth', requireAuth, (req, res) => {
    res.json({ success: true, user: { username: req.user.username } });
});

// Mount analytics routes and protect them
router.use('/analytics', requireAuth, analyticsRoutes);

// A simple utility to get the auth middleware
router.auth = () => requireAuth;

module.exports = router; 
