const express = require('express');
const router = express.Router();
const firebaseService = require('../services/firebase');
const pdfProcessor = require('../services/pdfProcessor');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminRouter = require('./admin'); // Import to get auth middleware
const mammoth = require('mammoth'); // Word için
const xlsx = require('xlsx'); // Excel için
const translationService = require('../services/translation');

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
    const sectionName = req.body.sectionName; // Artık genel isim
    const originalFilename = req.file.originalname;
    const filePath = req.file.path;
    const ext = path.extname(originalFilename).toLowerCase();

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

        let textContent = '';
        if (ext === '.pdf') {
            textContent = await pdfProcessor.processPdf(filePath);
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            textContent = result.value;
        } else if (ext === '.txt') {
            textContent = fs.readFileSync(filePath, 'utf8');
        } else if (ext === '.xlsx') {
            const workbook = xlsx.readFile(filePath);
            let allText = [];
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                rows.forEach(row => {
                    allText.push(row.join(' '));
                });
            });
            textContent = allText.join('\n');
        } else {
            fs.unlinkSync(filePath);
            return res.status(400).send('Unsupported file type.');
        }

        if (!textContent) {
            throw new Error('File processing returned no content.');
        }

        // Dil tespiti (mevcut translationService ile)
        let detectedLanguage = language;
        if (!language || language === 'auto') {
            const detection = await translationService.detectLanguage(textContent.slice(0, 500));
            detectedLanguage = detection.language;
        }

        // Eğer hotel 'Papillon' veya 'Tümü' ise, Firestore'a 'All' olarak kaydet
        const hotelForFirestore = (hotel === 'Papillon' || hotel === 'Tümü') ? 'All' : hotel;

        // F&B ve Menu kategorisi için restoran bilgisini de ekle
        let kindForFirestore = kind;
        let sectionNameForFirestore = null;
        if ((kind === 'FB' || kind === 'Menu' || kind === 'SPA') && sectionName) {
            kindForFirestore = kind;
            sectionNameForFirestore = sectionName.replace(/[^a-zA-Z0-9]/g, '_');
        }

        await firebaseService.storeKnowledge(hotelForFirestore, detectedLanguage, kindForFirestore, textContent, documentDate, sectionNameForFirestore);
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