const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentAI = require('../services/documentai');
const firebaseService = require('../services/firebase');
const pdfProcessor = require('../services/pdfProcessor');
const path = require('path');

// Import analytics routes
const analyticsRoutes = require('./analytics');

// Configure multer for file uploads
const uploadsPath = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
const fs = require('fs');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

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
    
    console.log(`🔐 Admin login attempt: ${username}`);
    
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        // Generate session token
        const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        sessions.set(sessionToken, {
            username: username,
            loginTime: Date.now(),
            expiry: sessionExpiry
        });
        
        console.log(`✅ Admin login successful: ${username}`);
        
        res.json({
            success: true,
            message: 'Giriş başarılı',
            token: sessionToken,
            user: {
                username: username,
                role: 'admin'
            }
        });
    } else {
        console.log(`❌ Admin login failed: ${username}`);
        res.status(401).json({
            success: false,
            message: 'Kullanıcı adı veya şifre hatalı'
        });
    }
});

// Admin logout endpoint
router.post('/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token && sessions.has(token)) {
        sessions.delete(token);
        console.log(`🚪 Admin logged out`);
    }
    
    res.json({
        success: true,
        message: 'Çıkış yapıldı'
    });
});

// Middleware to check admin authentication
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Oturum gerekli'
        });
    }
    
    const session = sessions.get(token);
    
    if (!session || session.expiry < Date.now()) {
        if (session && session.expiry < Date.now()) {
            sessions.delete(token);
        }
        return res.status(401).json({
            success: false,
            message: 'Oturum süresi doldu'
        });
    }
    
    req.user = session;
    next();
};

// Check authentication status
router.get('/check-auth', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: {
            username: req.user.username,
            role: 'admin'
        }
    });
});

// Training endpoint - now protected
router.post('/train', requireAuth, upload.single('document'), async (req, res) => {
    try {
        const { hotel, language } = req.body;
        const file = req.file;

        console.log(`🎓 Training request: ${hotel} (${language})`);

        if (!hotel || !language || !file) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: hotel, language, or document'
            });
        }

        // Validate hotel selection
        const validHotels = ['Belvil', 'Zeugma', 'Ayscha', 'Hepsi'];
        if (!validHotels.includes(hotel)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid hotel selection. Must be one of: Belvil, Zeugma, Ayscha, Hepsi'
            });
        }

        // Process PDF and extract content
        const fileBuffer = fs.readFileSync(file.path);
        const extractedContent = await documentAI.processDocument(fileBuffer, file.mimetype);
        
        if (!extractedContent || !extractedContent.success || !extractedContent.text) {
            return res.status(400).json({
                success: false,
                message: 'Could not extract content from document'
            });
        }

        // Determine which hotels to update
        const hotelsToUpdate = hotel === 'Hepsi' ? ['Belvil', 'Zeugma', 'Ayscha'] : [hotel];

        // Save to Firebase for each hotel
        const results = [];
        for (const hotelName of hotelsToUpdate) {
            try {
                console.log(`📦 Attempting to store knowledge for ${hotelName} (${language})`);
                console.log(`📦 Content length: ${extractedContent.text.length} characters`);
                console.log(`📦 Calling firebaseService.storeKnowledge...`);
                
                const result = await firebaseService.storeKnowledge(
                    hotelName,
                    language,
                    extractedContent.text,
                    {
                        originalFilename: file.originalname,
                        pages: extractedContent.pages,
                        chunks: extractedContent.chunks,
                        processedAt: new Date().toISOString(),
                        fileSize: file.size
                    }
                );
                
                console.log(`✅ storeKnowledge returned:`, result);
                results.push({ hotel: hotelName, success: true, result });
                console.log(`✅ Knowledge saved for ${hotelName} (${language})`);
            } catch (error) {
                console.error(`❌ Error saving knowledge for ${hotelName}:`, error);
                console.error(`❌ Error stack:`, error.stack);
                console.error(`❌ Error name:`, error.name);
                console.error(`❌ Error message:`, error.message);
                results.push({ hotel: hotelName, success: false, error: error.message });
            }
        }

        // Check if any saves were successful
        const successfulSaves = results.filter(r => r.success);
        if (successfulSaves.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to save knowledge to any hotel'
            });
        }

        res.json({
            success: true,
            message: `Training completed successfully for ${successfulSaves.length} hotel(s)`,
            results: results,
            extractedTextLength: extractedContent.text.length,
            processingInfo: extractedContent.processingInfo
        });

    } catch (error) {
        console.error('❌ Training error:', error);
        res.status(500).json({
            success: false,
            message: 'Training failed',
            error: error.message
        });
    }
});

// PDF analysis endpoint - now protected
router.post('/pdf-info', requireAuth, upload.single('document'), async (req, res) => {
    try {
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Get PDF information
        const fileBuffer = fs.readFileSync(file.path);
        const pdfInfo = await pdfProcessor.getPDFInfo(fileBuffer);
        
        res.json({
            success: true,
            message: `PDF has ${pdfInfo.totalPages} pages and ${pdfInfo.estimatedChunks} estimated chunks`,
            pages: pdfInfo.totalPages,
            estimatedChunks: pdfInfo.estimatedChunks,
            needsSplitting: pdfInfo.needsSplitting,
            maxPagesPerChunk: pdfInfo.maxPagesPerChunk
        });

    } catch (error) {
        console.error('❌ PDF info error:', error);
        res.status(500).json({
            success: false,
            message: 'PDF analysis failed',
            error: error.message
        });
    }
});

// Get knowledge statistics - now protected
router.get('/knowledge-stats', requireAuth, async (req, res) => {
    try {
        const hotels = ['Belvil', 'Zeugma', 'Ayscha'];
        const languages = ['tr', 'en', 'de', 'ru'];
        const stats = {};

        for (const hotel of hotels) {
            stats[hotel] = {};
            for (const language of languages) {
                try {
                    const knowledge = await firebaseService.searchKnowledge(null, hotel, language);
                    stats[hotel][language] = {
                        hasData: knowledge.length > 0,
                        lastUpdated: knowledge[0]?.metadata?.lastUpdated || null
                    };
                } catch (error) {
                    stats[hotel][language] = {
                        hasData: false,
                        error: error.message
                    };
                }
            }
        }

        res.json({
            success: true,
            stats: stats,
            supportedHotels: hotels,
            supportedLanguages: languages
        });

    } catch (error) {
        console.error('❌ Knowledge stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get knowledge statistics'
        });
    }
});

// Upload and process file - now protected
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const { hotel, language, category } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        if (!hotel || !language || !category) {
            return res.status(400).json({ 
                success: false, 
                error: 'Hotel, language, and category are required' 
            });
        }

        console.log(`📤 Processing upload: ${file.originalname} for ${hotel}-${language}-${category}`);

        let processedText = '';
        let processingResult = null;

        if (file.mimetype === 'application/pdf') {
            // Process PDF with Document AI
            processingResult = await documentAI.processDocument(file.buffer, file.mimetype);
            
            if (processingResult.success) {
                processedText = processingResult.text;
                console.log(`✅ PDF processed: ${processingResult.pages} pages, ${processingResult.chunks || 1} chunks`);
            } else {
                return res.status(500).json({ 
                    success: false, 
                    error: `Document AI processing failed: ${processingResult.error}` 
                });
            }
        } else if (file.mimetype === 'text/plain') {
            // Handle text files
            processedText = file.buffer.toString('utf-8');
            processingResult = {
                success: true,
                text: processedText,
                pages: 1
            };
            console.log(`✅ Text file processed: ${processedText.length} characters`);
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Unsupported file type. Only PDF and TXT files are allowed.' 
            });
        }

        // Save to Firebase
        await firebaseService.storeKnowledge(
            hotel,
            language,
            processedText,
            {
                category: category,
                originalFilename: file.originalname,
                uploadDate: new Date().toISOString(),
                pages: processingResult.pages || 1,
                chunks: processingResult.chunks || 1,
                fileSize: file.size,
                processed: true
            }
        );

        console.log(`💾 Saved to Firebase: ${hotel}-${language}`);

        // Return comprehensive response
        res.json({ 
            success: true, 
            message: 'File processed and saved successfully',
            docId: `${hotel}-${language}`,
            extractedText: processedText,
            pages: processingResult.pages || 1,
            chunks: processingResult.chunks || 1,
            tables: processingResult.tables || [],
            entities: processingResult.entities || [],
            filename: file.originalname
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// OCR correction endpoint - now protected
router.post('/correct-ocr', requireAuth, async (req, res) => {
    try {
        const { text, hotel, language, category } = req.body;

        if (!text) {
            return res.status(400).json({ 
                success: false, 
                error: 'Text is required for correction' 
            });
        }

        console.log(`🔧 Applying OCR corrections for ${hotel}-${language}-${category}`);

        // Apply advanced cleaning using DocumentAI service
        const correctedText = documentAI.advancedTextCleaning(text);

        res.json({
            success: true,
            correctedText,
            originalLength: text.length,
            correctedLength: correctedText.length,
            message: 'OCR corrections applied successfully'
        });

    } catch (error) {
        console.error('❌ OCR correction error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Save corrected text endpoint
router.post('/save-corrected', async (req, res) => {
    try {
        const { text, hotel, language, category } = req.body;

        if (!text || !hotel || !language || !category) {
            return res.status(400).json({ 
                success: false, 
                error: 'Text, hotel, language, and category are required' 
            });
        }

        console.log(`💾 Saving corrected text for ${hotel}-${language}-${category}`);

        // Save corrected text to Firebase
        const docId = `papillon_${hotel}_${language}_${category}_corrected_${Date.now()}`;
        
        await firebaseService.addKnowledge(docId, {
            hotel,
            language,
            category,
            content: text,
            filename: 'corrected_text.txt',
            uploadDate: new Date().toISOString(),
            processed: true,
            corrected: true,
            pages: 1,
            chunks: 1
        });

        console.log(`✅ Corrected text saved: ${docId}`);

        res.json({
            success: true,
            docId,
            message: 'Corrected text saved successfully'
        });

    } catch (error) {
        console.error('❌ Save corrected text error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Analyze text quality endpoint
router.post('/analyze-quality', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ 
                success: false, 
                error: 'Text is required for analysis' 
            });
        }

        const analysis = analyzeTextQuality(text);

        res.json({
            success: true,
            analysis
        });

    } catch (error) {
        console.error('❌ Text quality analysis error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Text quality analysis function
function analyzeTextQuality(text) {
    const issues = [];
    const suggestions = [];
    let score = 100;

    // Check for area measurement errors
    const areaMeasurements = text.match(/\d{3,}\s*m\s*[²2]/g);
    if (areaMeasurements) {
        issues.push('Suspicious area measurements detected (3+ digit numbers)');
        suggestions.push('Check area measurements: ' + areaMeasurements.join(', '));
        score -= 15;
    }

    // Check for unwanted characters
    const unwantedChars = text.match(/[Ⓡ®™]|wwww|E\s*生产\s*DE\s*ADJ/g);
    if (unwantedChars) {
        issues.push('Unwanted characters detected');
        suggestions.push('These characters will be cleaned: ' + [...new Set(unwantedChars)].join(', '));
        score -= 10;
    }

    // Check for broken numbers
    const brokenNumbers = text.match(/\d+\s+\d+/g);
    if (brokenNumbers) {
        issues.push('Broken numbers detected');
        suggestions.push('Numbers to fix: ' + brokenNumbers.slice(0, 5).join(', '));
        score -= 10;
    }

    // Check for missing table structure
    const hasTabularData = text.includes('|') || text.match(/\w+\s+\w+\s+\w+\s+\w+/g);
    if (!hasTabularData && text.length > 1000) {
        issues.push('Table structures may be missing');
        suggestions.push('Manually check menu and price lists');
        score -= 15;
    }

    // Check for excessive line breaks
    const excessiveLineBreaks = text.match(/\n{4,}/g);
    if (excessiveLineBreaks) {
        issues.push('Excessive line breaks detected');
        suggestions.push('Text formatting needs improvement');
        score -= 5;
    }

    // Check for encoding issues
    const encodingIssues = text.match(/[^\x00-\x7F\u00C0-\u017F\u0100-\u024F]/g);
    if (encodingIssues && encodingIssues.length > 10) {
        issues.push('Potential encoding issues detected');
        suggestions.push('Text may contain non-standard characters');
        score -= 10;
    }

    return {
        score: Math.max(0, score),
        issues,
        suggestions,
        characterCount: text.length,
        wordCount: text.split(/\s+/).length,
        lineCount: text.split('\n').length
    };
}

// Get knowledge by filters
router.get('/knowledge', async (req, res) => {
    try {
        const { hotel, language, category } = req.query;
        
        console.log(`📚 Fetching knowledge for: ${hotel}-${language}-${category}`);
        
        const knowledge = await firebaseService.getKnowledge({ hotel, language, category });
        
        res.json({ 
            success: true, 
            knowledge: knowledge || [],
            count: knowledge ? knowledge.length : 0
        });
    } catch (error) {
        console.error('❌ Get knowledge error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Add text knowledge manually
router.post('/add-knowledge', async (req, res) => {
    try {
        const { content, hotel, language, category } = req.body;
        
        if (!content || !hotel || !language || !category) {
            return res.status(400).json({ 
                success: false, 
                error: 'Content, hotel, language, and category are required' 
            });
        }

        const docId = `papillon_${hotel}_${language}_${category}_manual_${Date.now()}`;
        
        await firebaseService.addKnowledge(docId, {
            hotel,
            language,
            category,
            content,
            filename: 'manual_entry.txt',
            uploadDate: new Date().toISOString(),
            processed: true,
            manual: true
        });

        console.log(`✅ Manual knowledge added: ${docId}`);

        res.json({ 
            success: true, 
            docId,
            message: 'Knowledge added successfully' 
        });
    } catch (error) {
        console.error('❌ Add knowledge error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Delete knowledge
router.delete('/knowledge/:docId', async (req, res) => {
    try {
        const { docId } = req.params;
        
        await firebaseService.deleteKnowledge(docId);
        
        console.log(`🗑️ Knowledge deleted: ${docId}`);

        res.json({ 
            success: true, 
            message: 'Knowledge deleted successfully' 
        });
    } catch (error) {
        console.error('❌ Delete knowledge error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Mount analytics routes with authentication
router.use('/analytics', requireAuth, analyticsRoutes);

module.exports = router; 