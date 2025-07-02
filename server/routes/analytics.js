const express = require('express');
const router = express.Router();
const questionAnalytics = require('../services/questionAnalytics');

// Get top 10 most asked questions
router.get('/top-questions', async (req, res) => {
    try {
        console.log('📊 Received analytics request:', req.query);
        
        const forceRefresh = req.query.force === 'true';
        console.log(`🔄 Force refresh: ${forceRefresh}`);
        
        // Add detailed logging
        console.log('🔍 Starting analytics process...');
        
        let result;
        try {
            result = await questionAnalytics.analyzeQuestions(forceRefresh);
            console.log('📊 Raw result from analyzeQuestions:', result);
        } catch (analyzeError) {
            console.error('❌ Error in analyzeQuestions:', analyzeError);
            throw analyzeError;
        }
        
        if (!result) {
            console.error('❌ No result returned from analyzeQuestions');
            throw new Error('Analytics service returned no data');
        }

        console.log('📊 Raw analytics result:', JSON.stringify({
            success: result.success,
            questionCount: result.questions?.length || 0,
            lastUpdated: result.lastUpdated,
            error: result.error
        }, null, 2));
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to analyze questions');
        }

        if (!result.questions || !Array.isArray(result.questions)) {
            console.error('❌ Invalid questions array in result:', result.questions);
            throw new Error('Invalid questions data returned from analytics');
        }
        
        // Limit to top 10 questions
        let topQuestions;
        try {
            topQuestions = result.questions.slice(0, 10);
            console.log('📊 Top questions:', JSON.stringify(topQuestions, null, 2));
        } catch (sliceError) {
            console.error('❌ Error slicing questions:', sliceError);
            throw sliceError;
        }
        
        console.log(`📈 Returning ${topQuestions.length} top questions`);
        
        res.json({
            success: true,
            questions: topQuestions,
            lastUpdated: result.lastUpdated
        });
        
    } catch (error) {
        console.error('❌ Analytics error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Analiz verileri alınamadı',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Clear analytics cache endpoint
router.delete('/clear-cache', async (req, res) => {
    try {
        console.log('🧹 Received cache clear request');
        
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
            lastUpdated: result.lastUpdated
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

module.exports = router;
