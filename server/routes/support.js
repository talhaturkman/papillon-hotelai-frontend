const express = require('express');
const router = express.Router();

// @route   GET /api/support/whatsapp-link
// @desc    Generate a WhatsApp redirect link with session context
// @access  Public
router.get('/whatsapp-link', (req, res) => {
    const { session_id } = req.query;

    if (!session_id) {
        return res.status(400).json({ msg: 'Session ID is required' });
    }

    const whatsappNumber = process.env.WHATSAPP_BUSINESS_NUMBER;
    if (!whatsappNumber) {
        console.error('WHATSAPP_BUSINESS_NUMBER not found in .env file');
        return res.status(500).json({ msg: 'Server configuration error' });
    }

    const defaultMessage = `Merhaba, [ID: ${session_id}] numaralı görüşmemle ilgili destek almak istiyorum.`;
    const encodedMessage = encodeURIComponent(defaultMessage);
    
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    res.json({ link: whatsappLink });
});

module.exports = router; 