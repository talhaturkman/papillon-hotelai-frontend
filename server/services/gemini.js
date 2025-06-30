const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing');
    }

    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });

    console.log(`��� [GeminiService] Initialised with model: ${this.modelName}`);
  }

  async generateResponse(messages = [], knowledgeContext = null, detectedLanguage = 'tr') {
    try {
      const systemPrompt =
        "Sen Papillon Hotels'in yapay zeka asistanısın. Papillon Hotels'in 3 oteli var: Belvil, Zeugma ve Ayscha.\n" +
        'SADECE TÜRKÇE yanıt ver. Kısa ve net cevapla.\n' +
        'Otel belirtilmeden otel-spesifik soru gelirse "Hangi Papillon otelinde konaklamaktasınız? Belvil, Zeugma, Ayscha?" diye sor.';

      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Elbette, size yardımcı olmaya hazırım.' }] },
      ];

      if (messages.length) {
        const last = messages[messages.length - 1];
        contents.push({ role: last.role === 'user' ? 'user' : 'model', parts: [{ text: last.content }] });
      }

      const generationConfig = { temperature: 0.7, maxOutputTokens: 1024 };

      const result = await this.model.generateContent({ contents, generationConfig });
      const text = result?.response?.text?.();
      if (!text) throw new Error('Empty response from Gemini API');

      console.log(`✅ [GeminiService] Response generated (${text.length} chars)`);
      return { success: true, response: text };
    } catch (error) {
      console.error('❌ [GeminiService] Error:', error?.message || error);
      return { success: false, error: 'AI service temporarily unavailable. Please try again.' };
    }
  }

  detectLanguage(text) {
    const trRegex = /[çğıöşüÇĞIİÖŞÜ]|\b(bir|ve|de|için|hakkında|nerede)\b/i;
    const enRegex = /\b(the|and|for|are|with|have|this|will|you|that|but|not|what|all|were|they|we)\b/i;
    if (trRegex.test(text)) return 'tr';
    if (enRegex.test(text)) return 'en';
    return 'en';
  }

  extractHotelName(text) {
    const hotels = ['belvil', 'zeugma', 'ayscha'];
    const lower = text.toLowerCase();
    const found = hotels.find(h => lower.includes(h));
    return found ? found.charAt(0).toUpperCase() + found.slice(1) : null;
  }

  isLocationQuery(text) {
    const keywords = ['nerede', 'nasıl gidilir', 'distance', 'nearby', 'hastane', 'pharmacy', 'market', 'restaurant', 'atm'];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }
}

module.exports = new GeminiService();
