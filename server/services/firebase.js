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
            // Use JSON file path if available, otherwise use environment variables
            const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            
            let credential;
            if (serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
                try {
                    // Use JSON file with absolute path
                    const absolutePath = path.resolve(serviceAccountPath);
                    console.log(`🔍 Loading Firebase credentials from: ${absolutePath}`);
                    const serviceAccount = require(absolutePath);
                    
                    // Validate required fields
                    if (!serviceAccount.private_key) {
                        throw new Error('private_key missing in JSON file');
                    }
                    if (!serviceAccount.client_email) {
                        throw new Error('client_email missing in JSON file');
                    }
                    if (!serviceAccount.project_id) {
                        throw new Error('project_id missing in JSON file');
                    }
                    
                    credential = admin.credential.cert(serviceAccount);
                    console.log('✅ Using Firebase JSON credentials file');
                } catch (jsonError) {
                    console.error('❌ Error reading JSON file:', jsonError.message);
                    throw jsonError;
                }
            } else {
                // Use environment variables
                console.log('🔍 JSON file not found, trying environment variables...');
                const serviceAccount = {
                    type: "service_account",
                    project_id: process.env.FIREBASE_PROJECT_ID,
                    client_email: process.env.FIREBASE_CLIENT_EMAIL,
                    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                };
                
                // Validate environment variables
                if (!serviceAccount.private_key) {
                    throw new Error('FIREBASE_PRIVATE_KEY environment variable missing');
                }
                if (!serviceAccount.client_email) {
                    throw new Error('FIREBASE_CLIENT_EMAIL environment variable missing');
                }
                if (!serviceAccount.project_id) {
                    throw new Error('FIREBASE_PROJECT_ID environment variable missing');
                }
                
                credential = admin.credential.cert(serviceAccount);
                console.log('✅ Using Firebase environment variables');
            }

            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: credential,
                    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
                });
            }

            this.db = admin.firestore();
            this.isInitialized = true;
            console.log('✅ Firebase service initialized successfully');
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            console.error('💡 Make sure you have valid Firebase credentials configured');
            throw error;
        }
    }

    // Store chat conversation in chatlog collection
    async storeChatLog(conversationData) {
        await this.ensureInitialized();

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
            throw error;
        }
    }

    // Get chat history for analytics
    async getChatHistory(sessionId = null, limit = 100) {
        await this.ensureInitialized();

        try {
            let query = this.db.collection('chatlog').orderBy('createdAt', 'desc');
            
            if (sessionId) {
                query = query.where('sessionId', '==', sessionId);
            }
            
            query = query.limit(limit);
            
            const snapshot = await query.get();
            const chats = [];
            
            snapshot.forEach(doc => {
                chats.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return chats;
        } catch (error) {
            console.error('❌ Error getting chat history:', error);
            throw error;
        }
    }

    // Store knowledge in Firebase with structure: knowledge_base > Papillon > Hotel > Language
    async storeKnowledge(hotel, language, content, metadata = {}) {
        console.log(`🔍 storeKnowledge called with hotel: ${hotel}, language: ${language}`);
        console.log(`🔍 Content length: ${content ? content.length : 'null'} characters`);
        console.log(`🔍 Metadata:`, metadata);
        
        await this.ensureInitialized();
        console.log(`🔍 Firebase initialization confirmed`);

        try {
            const docRef = this.db
                .collection('knowledge_base')
                .doc('Papillon')
                .collection(hotel)
                .doc(language);

            console.log(`🔍 Document reference created for: knowledge_base/Papillon/${hotel}/${language}`);

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

            console.log(`🔍 Knowledge data prepared, attempting to save...`);
            await docRef.set(knowledgeData, { merge: true });
            
            console.log(`✅ Knowledge stored: ${hotel} - ${language}`);
            return { success: true, message: 'Knowledge stored successfully' };
        } catch (error) {
            console.error('❌ Error storing knowledge:', error);
            throw error;
        }
    }

    // Search knowledge base for relevant information
    async searchKnowledge(query, hotel = null, language = null) {
        await this.ensureInitialized();

        try {
            let searchResults = [];

            if (hotel && language) {
                // Search specific hotel and language
                const docRef = this.db
                    .collection('knowledge_base')
                    .doc('Papillon')
                    .collection(hotel)
                    .doc(language);

                const doc = await docRef.get();
                if (doc.exists) {
                    searchResults.push({
                        hotel: hotel,
                        language: language,
                        content: doc.data().content,
                        metadata: doc.data().metadata
                    });
                }
            } else if (hotel && !language) {
                // Search specific hotel, all languages
                const languages = ['tr', 'en', 'de', 'ru'];
                
                for (const lang of languages) {
                    try {
                        const docRef = this.db
                            .collection('knowledge_base')
                            .doc('Papillon')
                            .collection(hotel)
                            .doc(lang);

                        const doc = await docRef.get();
                        if (doc.exists) {
                            searchResults.push({
                                hotel: hotel,
                                language: lang,
                                content: doc.data().content,
                                metadata: doc.data().metadata
                            });
                        }
                    } catch (error) {
                        console.warn(`Warning: Could not fetch ${hotel}-${lang}`);
                    }
                }
            } else {
                // Search all hotels and languages
                const hotels = ['Belvil', 'Zeugma', 'Ayscha'];
                const languages = ['tr', 'en', 'de', 'ru'];

                for (const hotelName of hotels) {
                    for (const lang of languages) {
                        try {
                            const docRef = this.db
                                .collection('knowledge_base')
                                .doc('Papillon')
                                .collection(hotelName)
                                .doc(lang);

                            const doc = await docRef.get();
                            if (doc.exists) {
                                searchResults.push({
                                    hotel: hotelName,
                                    language: lang,
                                    content: doc.data().content,
                                    metadata: doc.data().metadata
                                });
                            }
                        } catch (error) {
                            // Continue with other hotels/languages if one fails
                            console.warn(`Warning: Could not fetch ${hotelName}-${lang}`);
                        }
                    }
                }
            }

            console.log(`🔍 Knowledge search results: ${searchResults.length} documents found (hotel: ${hotel || 'all'}, language: ${language || 'all'})`);
            return searchResults;
        } catch (error) {
            console.error('❌ Error searching knowledge:', error);
            throw error;
        }
    }

    // Get all available hotels
    async getAvailableHotels() {
        await this.ensureInitialized();

        try {
            const papillonDoc = this.db.collection('knowledge_base').doc('Papillon');
            const collections = await papillonDoc.listCollections();
            
            return collections.map(collection => collection.id);
        } catch (error) {
            console.error('❌ Error getting hotels:', error);
            return ['Belvil', 'Zeugma', 'Ayscha']; // Return default hotels
        }
    }

    // Store chat conversation for analytics
    async storeChatConversation(sessionId, messages, metadata = {}) {
        await this.ensureInitialized();

        try {
            const docRef = this.db.collection('chat_conversations').doc(sessionId);
            
            await docRef.set({
                messages: messages,
                metadata: {
                    ...metadata,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return { success: true };
        } catch (error) {
            console.error('❌ Error storing conversation:', error);
            throw error;
        }
    }

    // Get all chat logs for analytics
    async getAllChatLogs() {
        await this.ensureInitialized();

        try {
            console.log('📊 Fetching all chat logs for analytics...');
            
            const snapshot = await this.db.collection('chatlog')
                .orderBy('createdAt', 'desc')
                .get();
            
            const chatLogs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                chatLogs.push({
                    id: doc.id,
                    userMessage: data.userMessage || data.message,
                    aiResponse: data.aiResponse || data.response,
                    sessionId: data.sessionId,
                    hotel: data.hotel || data.detectedHotel || 'Unknown',
                    language: data.language || data.detectedLanguage || 'unknown',
                    timestamp: data.createdAt,
                    metadata: data.metadata || {}
                });
            });

            console.log(`📊 Retrieved ${chatLogs.length} chat logs for analysis`);
            return chatLogs;
        } catch (error) {
            console.error('❌ Error getting all chat logs:', error);
            throw error;
        }
    }

    async ensureInitialized() {
        console.log(`🔍 ensureInitialized called, isInitialized: ${this.isInitialized}`);
        if (!this.isInitialized) {
            console.log(`🔍 Firebase not initialized, calling initialize()...`);
            await this.initialize();
            console.log(`🔍 Initialize completed, isInitialized: ${this.isInitialized}`);
        } else {
            console.log(`🔍 Firebase already initialized, skipping...`);
        }
    }
}

module.exports = new FirebaseService(); 