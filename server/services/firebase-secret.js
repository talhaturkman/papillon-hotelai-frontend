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
            
            // Try Secret Manager first (Cloud Run)
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
                console.log('🔍 Loading Firebase credentials from Secret Manager...');
                const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
                credential = admin.credential.cert(serviceAccount);
                console.log('✅ Using Firebase Secret Manager credentials');
            }
            // Fallback to file
            else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                const serviceAccount = require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS));
                credential = admin.credential.cert(serviceAccount);
                console.log('✅ Using Firebase file credentials');
            }
            else {
                throw new Error('No Firebase credentials found');
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
            console.warn('⚠️ Firebase features disabled');
            this.isInitialized = false;
        }
    }

    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.isInitialized;
    }
}

module.exports = new FirebaseService(); 