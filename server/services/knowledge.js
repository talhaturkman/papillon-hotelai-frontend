const firebaseService = require('./firebase');

class KnowledgeService {
    async getRelevantKnowledge(message, hotel = null) {
        try {
            if (!hotel) return null;
            
            // Get knowledge from Firebase
            const result = await firebaseService.searchKnowledge(hotel, 'en');
            if (!result.success) return null;

            let relevantContent = '';

            // Check if message is about spa
            if (message.toLowerCase().includes('spa')) {
                if (result.content.includes('### SPA Information ###')) {
                    const spaSection = result.content.split('### SPA Information ###')[1].split('###')[0].trim();
                    relevantContent += spaSection;
                }
            }

            // Add general information if no specific content found
            if (!relevantContent && result.content.includes('### General Information ###')) {
                const generalSection = result.content.split('### General Information ###')[1].split('###')[0].trim();
                relevantContent += generalSection;
            }

            return relevantContent || null;
        } catch (error) {
            console.error('❌ Error getting relevant knowledge:', error);
            return null;
        }
    }
}

module.exports = new KnowledgeService();