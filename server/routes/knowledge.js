const express = require('express');
const router = express.Router();
const firebaseService = require('../services/firebase');
const pdfProcessor = require('../services/pdfProcessor');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminRouter = require('./admin'); // Import to get auth middleware

// Configure multer for file uploads
const uploadsPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsPath),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// The upload/training endpoint, protected by authentication
router.post('/upload', adminRouter.auth(), upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { hotel, language, kind } = req.body;
    const originalFilename = req.file.originalname;
    const filePath = req.file.path;

    if (!hotel || !language || !kind) {
        fs.unlinkSync(filePath);
        return res.status(400).send('Missing hotel, language, or kind.');
    }

    try {
        let documentDate = null;
        if (kind === 'daily') {
            const dateMatch = originalFilename.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (dateMatch) {
                const day = parseInt(dateMatch[1], 10);
                const month = parseInt(dateMatch[2], 10);
                const year = parseInt(dateMatch[3], 10);
                documentDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
                console.log(`[Upload] Parsed date ${documentDate.toISOString()} from filename: ${originalFilename}`);
            } else {
                console.warn(`[Upload] Daily info filename has no date. Using today's date.`);
                documentDate = new Date();
                documentDate.setUTCHours(0, 0, 0, 0);
            }
        }

        console.log(`[Upload] Processing ${kind} file for ${hotel}/${language}: ${originalFilename}`);
        const textContent = await pdfProcessor.processPdf(filePath);

        if (!textContent) {
            throw new Error('PDF processing returned no content.');
        }

        await firebaseService.storeKnowledge(hotel, language, kind, textContent, documentDate);
        
        fs.unlinkSync(filePath); // Clean up the uploaded file after processing

        res.status(200).json({
            success: true,
            message: 'Knowledge base updated successfully.',
            documentDate: documentDate ? documentDate.toISOString() : null
        });
    } catch (error) {
        console.error('❌ Upload endpoint error:', error);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); // Ensure cleanup on error
        }
        res.status(500).json({ success: false, message: 'Training failed', error: error.message });
    }
});

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