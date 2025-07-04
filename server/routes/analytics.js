const express = require('express');
const router = express.Router();
const questionAnalytics = require('../services/questionAnalytics');

// LOOP KORUMASI: Route seviyesinde rate limiting
let lastClearCacheTime = null;
let lastFullAnalyzeTime = null;
const routeCooldown = 10 * 1000; // 10 saniye bekleme süresi

// Get top 10 most asked questions
router.get('/top-questions', async (req, res) => {
    try {
        // Artık async fonksiyon, await ile çağırıyoruz
        const result = await questionAnalytics.getTopQuestionsCache();
        res.json(result);
    } catch (error) {
        console.error('❌ Analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Analiz verileri alınamadı',
            message: error.message
        });
    }
});

// Clear analytics cache endpoint
router.delete('/clear-cache', async (req, res) => {
    try {
        console.log('🧹 Received cache clear request');
        
        // LOOP KORUMASI: Çok sık çağrılıyorsa bekle
        if (lastClearCacheTime && (Date.now() - lastClearCacheTime) < routeCooldown) {
            console.log('⚠️ Clear cache called too frequently, skipping...');
            return res.status(429).json({
                success: false,
                error: 'Çok sık çağrılıyor, lütfen bekleyin',
                retryAfter: Math.ceil((routeCooldown - (Date.now() - lastClearCacheTime)) / 1000)
            });
        }
        
        lastClearCacheTime = Date.now();
        
        // Clear the local cache
        console.log('🗑️ Clearing local cache...');
        questionAnalytics.clearCache();
        
        // Force a complete refresh of the data
        console.log('🔄 Forcing complete data refresh...');
        const result = await questionAnalytics.analyzeQuestions(true);
        
        console.log('📊 Fresh analysis result:', {
            success: result.success,
            questionCount: result.questions?.length || 0,
            lastUpdated: result.lastUpdated
        });
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to refresh analytics after cache clear');
        }
        
        res.json({
            success: true,
            message: 'Analytics cache başarıyla temizlendi',
            questions: result.questions,
            lastUpdated: result.lastUpdated,
            totalQuestions: result.questions.length
        });
    } catch (error) {
        console.error('❌ Cache clear error:', error);
        res.status(500).json({
            success: false,
            error: 'Cache temizlenirken hata oluştu',
            message: error.message
        });
    }
});

// Get real-time question stats
router.get('/stats', async (req, res) => {
    try {
        console.log('📈 Received stats request');
        
        const result = await questionAnalytics.analyzeQuestions(false);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to get stats');
        }
        
        const stats = {
            totalQuestions: result.questions.length,
            lastUpdated: result.lastUpdated,
            topCategories: {},
            topFacilities: {},
            languages: {},
            hotels: {}
        };
        
        // Calculate stats from questions
        result.questions.forEach(q => {
            // Category stats
            const category = q.category || 'general';
            stats.topCategories[category] = (stats.topCategories[category] || 0) + q.count;
            
            // Facility stats
            if (q.facility) {
                stats.topFacilities[q.facility] = (stats.topFacilities[q.facility] || 0) + q.count;
            }
            
            // Language stats
            q.languages?.forEach(lang => {
                stats.languages[lang] = (stats.languages[lang] || 0) + q.count;
            });
            
            // Hotel stats
            q.hotels?.forEach(hotel => {
                stats.hotels[hotel] = (stats.hotels[hotel] || 0) + q.count;
            });
        });
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'İstatistikler alınamadı',
            message: error.message
        });
    }
});

// Tam analiz endpointi
router.post('/full-analyze', async (req, res) => {
    try {
        // LOOP KORUMASI: Çok sık çağrılıyorsa bekle
        if (lastFullAnalyzeTime && (Date.now() - lastFullAnalyzeTime) < routeCooldown) {
            console.log('⚠️ Full analyze called too frequently, skipping...');
            return res.status(429).json({
                success: false,
                error: 'Çok sık çağrılıyor, lütfen bekleyin',
                retryAfter: Math.ceil((routeCooldown - (Date.now() - lastFullAnalyzeTime)) / 1000)
            });
        }
        
        lastFullAnalyzeTime = Date.now();
        
        questionAnalytics.clearCache();
        const result = await questionAnalytics.analyzeQuestions(true);
        res.json({
            success: true,
            questions: result.questions,
            lastUpdated: result.lastUpdated,
            totalQuestions: result.questions.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
