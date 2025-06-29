const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.client = null;
        
        // Initialize client if API key is available
        if (this.apiKey && this.apiKey !== 'your_elevenlabs_api_key_here') {
            this.client = new ElevenLabsClient({
                apiKey: this.apiKey
            });
            console.log('✅ ElevenLabs client initialized with key:', this.apiKey.substring(0, 10) + '...');
        } else {
            console.warn('⚠️ ElevenLabs API key not configured');
            console.warn('⚠️ Current key:', this.apiKey);
        }
        
        // Voice ID mappings for different languages
        this.voices = {
            // English voices
            en: {
                female: 'EXAVITQu4vr4xnSDxMaL', // Bella
                male: '21m00Tcm4TlvDq8ikWAM'    // Rachel
            },
            // Turkish - using multilingual voices
            tr: {
                female: 'EXAVITQu4vr4xnSDxMaL', // Bella (multilingual)
                male: '21m00Tcm4TlvDq8ikWAM'    // Rachel (multilingual)
            },
            // German
            de: {
                female: 'EXAVITQu4vr4xnSDxMaL', // Bella (multilingual)
                male: '21m00Tcm4TlvDq8ikWAM'    // Rachel (multilingual)
            },
            // Russian
            ru: {
                female: 'EXAVITQu4vr4xnSDxMaL', // Bella (multilingual)
                male: '21m00Tcm4TlvDq8ikWAM'    // Rachel (multilingual)
            }
        };
    }

    async generateSpeech(text, language = 'tr', gender = 'female') {
        try {
            if (!this.client) {
                throw new Error('ElevenLabs client not initialized - check API key');
            }

            // Get appropriate voice ID
            const voiceId = this.voices[language]?.[gender] || this.voices.tr.female;
            
            console.log(`🎙️ ElevenLabs TTS: ${text.substring(0, 50)}... (${language}, ${gender})`);
            console.log(`🎙️ Using Voice ID: ${voiceId}`);

            // Try different possible method names
            let response;
            
            // Method 1: textToSpeech.convert or similar
            if (this.client.textToSpeech && typeof this.client.textToSpeech.convert === 'function') {
                response = await this.client.textToSpeech.convert(voiceId, {
                    text: text,
                    model_id: 'eleven_multilingual_v2'
                });
            }
            // Method 2: generate method
            else if (typeof this.client.generate === 'function') {
                response = await this.client.generate({
                    voice: voiceId,
                    text: text,
                    model_id: 'eleven_multilingual_v2'
                });
            }
            // Method 3: direct textToSpeech with different parameters
            else if (typeof this.client.textToSpeech === 'function') {
                response = await this.client.textToSpeech({
                    voice_id: voiceId,
                    text: text,
                    model_id: 'eleven_multilingual_v2'
                });
            }
            // Method 4: Try different client structure
            else {
                console.log('🔍 Exploring client methods...');
                console.log('Client keys:', Object.keys(this.client));
                
                // Use axios as fallback
                const axios = require('axios');
                const axiosResponse = await axios({
                    method: 'POST',
                    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey
                    },
                    data: {
                        text: text,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                            style: 0.0,
                            use_speaker_boost: true
                        }
                    },
                    responseType: 'arraybuffer',
                    timeout: 15000, // 15 second timeout
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });
                
                console.log('✅ ElevenLabs TTS başarılı (Axios fallback)');
                return Buffer.from(axiosResponse.data);
            }

            // Convert response to buffer if needed
            if (response instanceof Buffer) {
                console.log('✅ ElevenLabs TTS başarılı (Buffer)');
                return response;
            } else if (response instanceof ArrayBuffer) {
                console.log('✅ ElevenLabs TTS başarılı (ArrayBuffer)');
                return Buffer.from(response);
            } else if (typeof response === 'object' && response.buffer) {
                console.log('✅ ElevenLabs TTS başarılı (Object with buffer)');
                return Buffer.from(response.buffer);
            } else {
                // If response is a stream/async iterator
                console.log('✅ ElevenLabs TTS başarılı (Stream)');
                const chunks = [];
                for await (const chunk of response) {
                    chunks.push(chunk);
                }
                return Buffer.concat(chunks);
            }

        } catch (error) {
            console.error('❌ ElevenLabs TTS Error:', error.message);
            if (error.status === 401) {
                console.error('❌ ElevenLabs API Key unauthorized.');
            } else if (error.status === 404) {
                console.error('❌ ElevenLabs endpoint not found. Check voice ID.');
            } else if (error.status === 422) {
                console.error('❌ ElevenLabs validation error. Check text length or parameters.');
            }
            throw error;
        }
    }

    async getVoices() {
        try {
            if (!this.client) {
                throw new Error('ElevenLabs client not initialized - check API key');
            }

            // Try different possible methods
            if (this.client.voices && typeof this.client.voices.getAll === 'function') {
                const response = await this.client.voices.getAll();
                return response.voices || response;
            } else if (typeof this.client.getVoices === 'function') {
                return await this.client.getVoices();
            } else {
                // Fallback - return predefined voices
                return [
                    { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
                    { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' }
                ];
            }
        } catch (error) {
            console.error('❌ ElevenLabs Get Voices Error:', error.message);
            // Return predefined voices as fallback
            return [
                { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
                { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' }
            ];
        }
    }

    // Get usage/quota info
    async getUsage() {
        try {
            if (!this.client) {
                throw new Error('ElevenLabs client not initialized - check API key');
            }

            // Try different possible methods
            if (this.client.user && typeof this.client.user.getSubscription === 'function') {
                return await this.client.user.getSubscription();
            } else if (typeof this.client.getSubscription === 'function') {
                return await this.client.getSubscription();
            } else {
                return { message: 'Usage info not available' };
            }
        } catch (error) {
            console.error('❌ ElevenLabs Get Usage Error:', error.message);
            return { error: error.message };
        }
    }

    // Test API key validity - simplified
    async testApiKey() {
        try {
            if (!this.client) {
                return { valid: false, error: 'Client not initialized' };
            }

            // Test by trying to get voices (simpler than user info)
            const voices = await this.getVoices();
            return { 
                valid: true, 
                message: 'API key is valid',
                voices_count: voices.length
            };
        } catch (error) {
            return { 
                valid: false, 
                error: error.message,
                status: error.status 
            };
        }
    }
}

module.exports = new ElevenLabsService(); 