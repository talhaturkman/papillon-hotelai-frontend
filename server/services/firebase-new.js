const admin = require('firebase-admin');
const path = require('path');

class FirebaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            let credential;
            
            // Priority 1: Secret Manager JSON (Cloud Run)
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
                try {
                    console.log('🔍 Loading Firebase credentials from Secret Manager...');
                    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
                    
                    // Validate required fields
                    if (!serviceAccount.private_key || !serviceAccount.client_email || !serviceAccount.project_id) {
                        throw new Error('Required fields missing in Secret Manager JSON');
                    }
                    
                    credential = admin.credential.cert(serviceAccount);
                    console.log('✅ Using Firebase Secret Manager credentials');
                } catch (secretError) {
                    console.error('❌ Error parsing Secret Manager JSON:', secretError.message);
                    console.warn('⚠️ Falling back to other credential methods...');
                }
            }
            
            // Priority 2: JSON file path (local development)
            if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                try {
                    const fs = require('fs');
                    if (fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
                        const absolutePath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
                        console.log(`🔍 Loading Firebase credentials from: ${absolutePath}`);
                        const serviceAccount = require(absolutePath);
                        
                        credential = admin.credential.cert(serviceAccount);
                        console.log('✅ Using Firebase JSON credentials file');
                    }
                } catch (jsonError) {
                    console.error('❌ Error reading JSON file:', jsonError.message);
                    console.warn('⚠️ Falling back to environment variables...');
                }
            }
            
            // Priority 3: Individual environment variables (fallback)
            if (!credential) {
                console.log('🔍 Trying individual environment variables...');
                const serviceAccount = {
                    type: "service_account",
                    project_id: process.env.FIREBASE_PROJECT_ID,
                    client_email: process.env.FIREBASE_CLIENT_EMAIL,
                    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                };
                
                // Check if all required variables are present
                if (serviceAccount.private_key && serviceAccount.client_email && serviceAccount.project_id) {
                    credential = admin.credential.cert(serviceAccount);
                    console.log('✅ Using Firebase individual environment variables');
                } else {
                    console.warn('⚠️ Firebase credentials incomplete - Firebase features will be disabled');
                    this.isInitialized = false;
                    return;
                }
            }

            // Initialize Firebase with the credential
            if (credential) {
                if (!admin.apps.length) {
                    admin.initializeApp({
                        credential: credential,
                        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0930707875'}-default-rtdb.firebaseio.com`
                    });
                }

                this.db = admin.firestore();
                this.isInitialized = true;
                console.log('✅ Firebase service initialized successfully');
            } else {
                console.warn('⚠️ No valid Firebase credentials found - Firebase features disabled');
                this.isInitialized = false;
            }
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            console.warn('⚠️ Firebase features will be disabled - server will continue without Firebase');
            this.isInitialized = false;
            // Don't throw error - let server continue without Firebase
        }
    }

    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.isInitialized;
    }

    // Store chat conversation
    async storeChatLog(conversationData) {
        const initialized = await this.ensureInitialized();
        if (!initialized) {
            console.warn('⚠️ Firebase not initialized - chat log not stored');
            return { success: false, error: 'Firebase not available' };
        }

        try {
            const chatlogRef = this.db.collection('chatlog').doc();
            
            const chatData = {
                ...conversationData,
                id: chatlogRef.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await chatlogRef.set(chatData);
            
            console.log(`✅ Chat log stored: ${conversationData.sessionId}`);
            return { success: true, id: chatlogRef.id };
        } catch (error) {
            console.error('❌ Error storing chat log:', error);
            return { success: false, error: error.message };
        }
    }

    // Store knowledge 
    async storeKnowledge(hotel, language, content, metadata = {}) {
        const initialized = await this.ensureInitialized();
        if (!initialized) {
            console.warn('⚠️ Firebase not initialized - knowledge not stored');
            return { success: false, error: 'Firebase not available' };
        }

        try {
            const docRef = this.db
                .collection('knowledge_base')
                .doc('Papillon')
                .collection(hotel)
                .doc(language);

            const knowledgeData = {
                content: content,
                metadata: {
                    ...metadata,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                    hotel: hotel,
                    language: language
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await docRef.set(knowledgeData, { merge: true });
            
            console.log(`✅ Knowledge stored: ${hotel} - ${language}`);
            return { success: true, message: 'Knowledge stored successfully' };
        } catch (error) {
            console.error('❌ Error storing knowledge:', error);
            return { success: false, error: error.message };
        }
    }

    // Other methods that depend on Firebase return gracefully if not initialized
    async getChatHistory(sessionId = null, limit = 100) {
        const initialized = await this.ensureInitialized();
        if (!initialized) return [];
        
        // Implementation here...
        return [];
    }

    async searchKnowledge(query, hotel = null, language = null) {
        const initialized = await this.ensureInitialized();
        if (!initialized) return [];
        
        // Implementation here...
        return [];
    }
}

module.exports = new FirebaseService(); 