class SupportService {
    async handleSupportRequest(message, sessionId, hotel, language = 'tr') {
        try {
            // Get appropriate response based on language
            const responses = {
                'tr': `Size yardımcı olması için ${hotel} otelinin canlı destek ekibine yönlendiriyorum.`,
                'en': `I'm connecting you to the live support team at ${hotel} hotel to assist you.`,
                'de': `Ich verbinde Sie mit dem Live-Support-Team des Hotels ${hotel}, um Ihnen zu helfen.`,
                'ru': `Я соединяю вас с командой живой поддержки отеля ${hotel}, чтобы помочь вам.`
            };

            // Add support request metadata
            const metadata = {
                type: 'LIVE_SUPPORT_REQUEST',
                hotel: hotel,
                sessionId: sessionId,
                timestamp: new Date().toISOString(),
                originalMessage: message
            };

            // Log support request (you can implement this later if needed)
            console.log('📞 Support request:', metadata);

            return responses[language] || responses['en'];
        } catch (error) {
            console.error('❌ Support handling error:', error);
            // Return a generic error message in English if something goes wrong
            return "I apologize, but I'm having trouble connecting you to support. Please try again in a moment.";
        }
    }
}

module.exports = new SupportService();
