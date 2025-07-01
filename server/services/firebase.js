const admin = require('firebase-admin');
const path = require('path');

class FirebaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.admin = admin; // Expose the admin SDK
        this.initializationPromise = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            let credential;
            
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
                try {
                    console.log('��� Loading Firebase credentials from Secret Manager...');
                    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
                    credential = admin.credential.cert(serviceAccount);
                    console.log('✅ Using Firebase Secret Manager credentials');
                } catch (secretError) {
                    console.error('❌ Error parsing Secret Manager JSON:', secretError.message);
                    throw secretError;
                }
            }
            else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && require('fs').existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
                try {
                    const absolutePath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
                    console.log(`��� Loading Firebase credentials from: ${absolutePath}`);
                    const serviceAccount = require(absolutePath);
                    credential = admin.credential.cert(serviceAccount);
                    console.log('✅ Using Firebase JSON credentials file');
                } catch (jsonError) {
                    console.error('❌ Error reading JSON file:', jsonError.message);
                    throw jsonError;
                }
            }
            else {
                console.log('��� JSON file not found, trying environment variables...');
                const serviceAccount = {
                    type: "service_account",
                    project_id: process.env.FIREBASE_PROJECT_ID,
                    client_email: process.env.FIREBASE_CLIENT_EMAIL,
                    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                };
                
                if (!serviceAccount.private_key || !serviceAccount.client_email || !serviceAccount.project_id) {
                    console.warn('⚠️ Missing Firebase environment variables - Firebase features disabled');
                    this.isInitialized = false;
                    return;
                }
                
                credential = admin.credential.cert(serviceAccount);
                console.log('✅ Using Firebase environment variables');
            }

            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: credential,
                    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0930707875'}-default-rtdb.firebaseio.com`
                });
            }

            this.db = admin.firestore();
            this.isInitialized = true;
            console.log('✅ Firebase service initialized successfully');
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            console.warn('⚠️ Firebase features will be disabled - server will continue without Firebase');
            this.isInitialized = false;
        }
    }

    ensureInitialized() {
        if (!this.initializationPromise) {
            this.initializationPromise = this.initialize().catch(err => {
                this.initializationPromise = null; 
                console.error("Firebase initialization failed permanently for this attempt.", err);
            });
        }
        return this.initializationPromise;
    }

    async storeChatLog(conversationData) {
        await this.ensureInitialized();
        if (!this.isInitialized) return { success: false };
        try {
            const chatlogRef = this.db.collection('chatlog').doc();
            await chatlogRef.set({ ...conversationData, id: chatlogRef.id, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            return { success: true, id: chatlogRef.id };
        } catch (error) {
            console.error('❌ Error storing chat log:', error);
            throw error;
        }
    }

    async getChatHistory(sessionId = null, limit = 100) {
        await this.ensureInitialized();
        if (!this.isInitialized) return [];
        try {
            let query = this.db.collection('chatlog').orderBy('createdAt', 'desc');
            if (sessionId) query = query.where('sessionId', '==', sessionId);
            const snapshot = await query.limit(limit).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('❌ Error getting chat history:', error);
            throw error;
        }
    }

    async logQuestionForAnalysis(data) {
        await this.ensureInitialized();
        if (!this.isInitialized) return;
        try {
            if (!data.message || data.message.trim() === '') return;
            const logRef = this.db.collection('questions_log').doc();
            await logRef.set({ ...data, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        } catch (error) {
            console.error('❌ Error logging question for analysis:', error);
        }
    }

    async getAllQuestions(limit = 1000) {
        await this.ensureInitialized();
        if (!this.isInitialized) return [];
        try {
            const snapshot = await this.db.collection('questions_log').orderBy('createdAt', 'desc').limit(limit).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('❌ Error getting all questions:', error);
            return [];
        }
    }

    async getRecentQuestions(minutes = 5) {
        await this.ensureInitialized();
        if (!this.isInitialized) return { size: 0 };
        try {
            return await this.db.collection('questions_log').where('createdAt', '>=', new Date(Date.now() - minutes * 60 * 1000)).get();
        } catch (error) {
            console.warn(`⚠️ Could not get recent questions:`, error.message);
            return { size: 0 };
        }
    }

    chunkText(text, maxLength = 2000) {
        if (!text) return [];
        const chunks = [];
        let i = 0;
        while (i < text.length) {
            chunks.push(text.substring(i, i + maxLength));
            i += maxLength;
        }
        return chunks;
    }

    async storeKnowledge(hotel, language, kind, content, documentDate = null) {
        await this.ensureInitialized();
        if (!this.isInitialized) return { success: false, error: 'Firebase not initialized' };

        const kindDocRef = this.db.collection('knowledge_base').doc('Papillon')
            .collection(hotel).doc(language)
            .collection('kinds').doc(kind);

        const chunksCollectionRef = kindDocRef.collection('chunks');
        const chunks = this.chunkText(content);
        
        console.log(`[Firestore] Storing ${chunks.length} chunks to path: Papillon/${hotel}/${language}/kinds/${kind}/chunks`);

        const snapshot = await chunksCollectionRef.get();
        if (!snapshot.empty) {
            console.log(`[Firestore] Deleting ${snapshot.size} old chunks from /${kind}/...`);
            const deleteBatch = this.db.batch();
            snapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
        }
        
        const writeBatch = this.db.batch();
        chunks.forEach((chunk, index) => {
            const docRef = chunksCollectionRef.doc(`chunk_${index}`);
            const data = { text: chunk };
            if (kind === 'daily' && documentDate) {
                data.date = admin.firestore.Timestamp.fromDate(documentDate);
            }
            writeBatch.set(docRef, data);
        });

        await kindDocRef.set({ 
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            chunkCount: chunks.length,
            ...(documentDate && { documentDate: admin.firestore.Timestamp.fromDate(documentDate) })
        }, { merge: true });

        await writeBatch.commit();
        console.log(`[Firestore] Successfully stored ${chunks.length} new chunks.`);
        return { success: true, chunks: chunks.length };
    }

    async searchKnowledge(hotel, language) {
        await this.ensureInitialized();
        if (!this.isInitialized) return { success: false, content: '' };

        const languagePriorities = [language, 'en', 'tr', 'de', 'ru'].filter((v, i, a) => a.indexOf(v) === i);
        let foundGeneral = null;
        let foundDaily = null;
        let foundSpa = null;

        const getDates = () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return {
                today: admin.firestore.Timestamp.fromDate(today),
                yesterday: admin.firestore.Timestamp.fromDate(yesterday)
            };
        };
        const { today, yesterday } = getDates();

        const searchInLanguage = async (lang) => {
            const kindsCollectionRef = this.db.collection('knowledge_base').doc('Papillon')
                .collection(hotel).doc(lang)
                .collection('kinds');

            const generalChunks = (await kindsCollectionRef.doc('general').collection('chunks').get()).docs.map(doc => doc.data().text);
            const dailyChunksSnapshot = await kindsCollectionRef.doc('daily').collection('chunks').get();
            const spaChunks = (await kindsCollectionRef.doc('spa').collection('chunks').get()).docs.map(doc => doc.data().text);

            let todayContent = [];
            let yesterdayContent = [];
            if (!dailyChunksSnapshot.empty) {
                dailyChunksSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.date) {
                        if (data.date.isEqual(today)) todayContent.push(data.text);
                        else if (data.date.isEqual(yesterday)) yesterdayContent.push(data.text);
                    }
                });
            }
            return {
                general: generalChunks.join('\n\n'),
                dailyToday: todayContent.join('\n\n'),
                dailyYesterday: yesterdayContent.join('\n\n'),
                spa: spaChunks.join('\n\n'),
            };
        };

        for (const lang of languagePriorities) {
            const results = await searchInLanguage(lang);
            if (!foundGeneral && results.general) {
                foundGeneral = results.general;
                console.log(`[Knowledge Search] SUCCESS: Found GENERAL info in fallback language: ${lang}`);
            }
            if (!foundDaily && (results.dailyToday || results.dailyYesterday)) {
                foundDaily = { today: results.dailyToday, yesterday: results.dailyYesterday };
                 console.log(`[Knowledge Search] SUCCESS: Found DAILY info in fallback language: ${lang}`);
            }
            if (!foundSpa && results.spa) {
                foundSpa = results.spa;
                console.log(`[Knowledge Search] SUCCESS: Found SPA info in fallback language: ${lang}`);
            }
            if (foundGeneral && foundDaily && foundSpa) break;
        }

        let finalContent = '';
        if (foundGeneral) {
            finalContent += `### General Information ###\n${foundGeneral}\n\n`;
        }
        if (foundDaily) {
            if (foundDaily.today) {
                finalContent += `### Daily Information (Today) ###\n${foundDaily.today}\n\n`;
            }
            if (foundDaily.yesterday) {
                finalContent += `### Daily Information (Yesterday) ###\n${foundDaily.yesterday}\n\n`;
            }
        }
        if (foundSpa) {
            finalContent += `### SPA Information ###\n${foundSpa}\n\n`;
        }
        
        console.log(`[Knowledge Search] Final check. General: ${!!foundGeneral}, Daily: ${!!foundDaily}, SPA: ${!!foundSpa}. Length: ${finalContent.length}`);
        return { success: finalContent.length > 0, content: finalContent };
    }

    async getAvailableHotels() {
        await this.ensureInitialized();
        if (!this.isInitialized) return [];
        try {
            const collections = await this.db.collection('knowledge_base').doc('Papillon').listCollections();
            return collections.map(col => col.id);
        } catch (error) {
            console.error('❌ Error getting available hotels:', error);
            return [];
        }
    }

    async storeChatConversation(sessionId, messages, metadata = {}) {
        await this.ensureInitialized();
        if (!this.isInitialized) return;
        try {
            const conversationRef = this.db.collection('chats').doc(sessionId);
            await conversationRef.set({ metadata, messages, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (error) {
            console.error('❌ Error storing chat conversation:', error);
        }
    }

    async getChatConversation(sessionId) {
        await this.ensureInitialized();
        if (!this.isInitialized) return null;
        try {
            const doc = await this.db.collection('chats').doc(sessionId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('❌ Error getting chat conversation:', error);
            return null;
        }
    }
}

async function getSpaCatalog(hotel, language) {
    try {
        const docRef = db.collection('knowledge').doc(`${hotel}_${language}_spa`);
        const doc = await docRef.get();
        if (doc.exists) {
            console.log(`Retrieved SPA catalog for ${hotel} in ${language}`);
            return doc.data().content;
        } else {
            console.log(`No SPA catalog found for ${hotel} in ${language}`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching SPA catalog:", error);
        return null;
    }
}

async function storeChatConversation(sessionId, messages) {
    // ... existing code ...
    // ... existing code ...
}

module.exports = {
    searchKnowledge,
    getHotel,
    getSpaCatalog,
    storeChatConversation,
    logQuestionForAnalysis
}; 
