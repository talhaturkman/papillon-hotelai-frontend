const express = require('express');
const router = express.Router();
const firebaseService = require('../services/firebase');

// Search knowledge base
router.get('/search', async (req, res) => {
    try {
        const { query, hotel, language } = req.query;

        const results = await firebaseService.searchKnowledge(query, hotel, language);

        res.json({
            success: true,
            results: results,
            count: results.length
        });

    } catch (error) {
        console.error('❌ Knowledge search error:', error);
        res.status(500).json({ error: 'Failed to search knowledge base' });
    }
});

// Get available hotels and languages
router.get('/config', async (req, res) => {
    try {
        const hotels = ['Belvil', 'Zeugma', 'Ayscha'];
        const languages = [
            { code: 'tr', name: 'Türkçe' },
            { code: 'en', name: 'English' },
            { code: 'de', name: 'Deutsch' },
            { code: 'ru', name: 'Русский' }
        ];

        res.json({
            success: true,
            hotels: hotels,
            languages: languages
        });

    } catch (error) {
        console.error('❌ Knowledge config error:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
    }
});

module.exports = router; 