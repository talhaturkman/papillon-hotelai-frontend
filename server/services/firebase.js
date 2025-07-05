const admin = require('firebase-admin');
const path = require('path');
const translationService = require('./translation');

class FirebaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.admin = admin; // Expose the admin SDK
        this.initializationPromise = null;
    }

    // Helper method for getting today and yesterday dates
    getDates() {
        // Get the actual current date from the system
        const now = new Date();
        
        // For debugging
        console.log(`[Knowledge Search] System date check:`, {
            rawNow: now.toISOString(),
            localTime: now.toLocaleString(),
            systemTimezone: now.getTimezoneOffset()
        });

        // Get UTC date components from local time
        const utcYear = now.getUTCFullYear();
        const utcMonth = now.getUTCMonth();
        const utcDate = now.getUTCDate();
        
        // Create dates using UTC time
        const todayUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate));
        const yesterdayUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate - 1));

        // Create local dates for display
        const today = new Date(todayUTC);
        const yesterday = new Date(yesterdayUTC);

        // Create timestamp ranges
        const todayStart = admin.firestore.Timestamp.fromDate(todayUTC);
        const todayEnd = admin.firestore.Timestamp.fromDate(new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000 - 1));
        const yesterdayStart = admin.firestore.Timestamp.fromDate(yesterdayUTC);
        const yesterdayEnd = admin.firestore.Timestamp.fromDate(new Date(yesterdayUTC.getTime() + 24 * 60 * 60 * 1000 - 1));

        // For debugging
        console.log(`[Knowledge Search] Date ranges:`, {
            localToday: today.toLocaleString(),
            localYesterday: yesterday.toLocaleString(),
            todayStart: new Date(todayStart.seconds * 1000).toISOString(),
            todayEnd: new Date(todayEnd.seconds * 1000).toISOString(),
            yesterdayStart: new Date(yesterdayStart.seconds * 1000).toISOString(),
            yesterdayEnd: new Date(yesterdayEnd.seconds * 1000).toISOString()
        });

        return {
            todayStart,
            todayEnd,
            yesterdayStart,
            yesterdayEnd,
            todayDate: todayUTC.toISOString().split('T')[0],
            yesterdayDate: yesterdayUTC.toISOString().split('T')[0]
        };
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            let credential;
            
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
                try {
                    console.log('🔐 Loading Firebase credentials from Secret Manager...');
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
                    console.log(`🔐 Loading Firebase credentials from: ${absolutePath}`);
                    const serviceAccount = require(absolutePath);
                    credential = admin.credential.cert(serviceAccount);
                    console.log('✅ Using Firebase JSON credentials file');
                } catch (jsonError) {
                    console.error('❌ Error reading JSON file:', jsonError.message);
                    throw jsonError;
                }
            }
            else {
                console.log('🔐 JSON file not found, trying environment variables...');
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

    async logQuestionForAnalysis(questionData) {
        await this.ensureInitialized();
        if (!this.isInitialized) return null;
        try {
            const docRef = await this.db.collection('questions_log').add({
                ...questionData,
                createdAt: new Date().toISOString(),
                preprocessed: false,
                isQuestion: false,
                category: 'general',
                facility: null
            });
            console.log(`📝 Question logged for analysis: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error('Failed to log question:', error);
            return null;
        }
    }

    async getAllQuestions(limit = 2000) {
        await this.ensureInitialized();
        if (!this.isInitialized) return [];
        try {
            const allQuestions = [];
            let query = this.db.collection('questions_log').orderBy('createdAt', 'desc');
            
            // First batch
            let snapshot = await query.limit(limit).get();
            
            console.log(`📊 Retrieved ${snapshot.size} documents in first batch`);
            
            // Process each document
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`\n📄 Document ${doc.id}:`, JSON.stringify(data, null, 2));
                
                // Skip invalid data
                if (!data) {
                    console.log(`⚠️ Skipping invalid document: ${doc.id}`);
                    return;
                }

                // Normalize the data
                const normalizedQuestion = {
                    id: doc.id,
                    message: data.message || data.text || '',
                    timestamp: data.createdAt || data.timestamp || new Date().toISOString(),
                    language: data.detectedLanguage || data.language || 'unknown',
                    hotel: data.detectedHotel || data.hotel || 'Unknown',
                    category: data.category || 'general',
                    facility: data.facility || null,
                    isQuestion: data.isQuestion || false,
                    preprocessed: data.preprocessed || false,
                    sessionId: data.sessionId || 'default'
                };

                console.log(`✅ Normalized question:`, JSON.stringify(normalizedQuestion, null, 2));

                // Only add questions with actual content
                if (normalizedQuestion.message.trim()) {
                    allQuestions.push(normalizedQuestion);
                } else {
                    console.log(`⚠️ Skipping empty message in document: ${doc.id}`);
                }
            });
            
            // If we got a full batch, there might be more
            while (snapshot.docs.length === limit && allQuestions.length < 5000) {
                const lastDoc = snapshot.docs[snapshot.docs.length - 1];
                snapshot = await query.startAfter(lastDoc).limit(limit).get();
                
                console.log(`📊 Retrieved ${snapshot.size} documents in next batch`);
                
                // Process additional documents
                snapshot.forEach(doc => {
                    const data = doc.data();
                    console.log(`\n📄 Document ${doc.id}:`, JSON.stringify(data, null, 2));
                    
                    if (!data) {
                        console.log(`⚠️ Skipping invalid document: ${doc.id}`);
                        return;
                    }

                    const normalizedQuestion = {
                        id: doc.id,
                        message: data.message || data.text || '',
                        timestamp: data.createdAt || data.timestamp || new Date().toISOString(),
                        language: data.detectedLanguage || data.language || 'unknown',
                        hotel: data.detectedHotel || data.hotel || 'Unknown',
                        category: data.category || 'general',
                        facility: data.facility || null,
                        isQuestion: data.isQuestion || false,
                        preprocessed: data.preprocessed || false,
                        sessionId: data.sessionId || 'default'
                    };

                    console.log(`✅ Normalized question:`, JSON.stringify(normalizedQuestion, null, 2));

                    if (normalizedQuestion.message.trim()) {
                        allQuestions.push(normalizedQuestion);
                    } else {
                        console.log(`⚠️ Skipping empty message in document: ${doc.id}`);
                    }
                });
            }
            
            console.log(`\n📊 Final summary:`);
            console.log(`Total questions retrieved: ${allQuestions.length}`);
            if (allQuestions.length > 0) {
                console.log('Sample of first 3 normalized questions:', JSON.stringify(allQuestions.slice(0, 3), null, 2));
            }

            return allQuestions;
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

    /**
     * Section-based (semantic) chunking for PDF, Word, Excel and plain text.
     * Chunks by detected section headers (e.g. 'A la carte', 'Spa', 'Genel Bilgiler', etc.).
     * If no headers found, falls back to fixed-length chunking.
     * Returns array of { title, text } objects.
     */
    chunkText(text, maxLength = 2000) {
        if (!text) return [];
        // Tüm metni tek bir chunk olarak döndür
        return [{ text }];
    }

    async storeKnowledge(hotel, language, kind, content, documentDate = null, sectionName = null) {
        await this.ensureInitialized();
        if (!this.isInitialized) return { success: false, error: 'Firebase not initialized' };

        const normalizedHotel = (hotel === 'Papillon' || hotel === 'Tümü') ? 'All' : hotel;
        const normalizedKind = kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();

        console.log('[storeKnowledge] called with:', { kind, normalizedKind, sectionName });

        // Menü için: kinds/Menu dokümanında her restoran bir field olarak tutulacak
        if (normalizedKind === 'Menu' && sectionName) {
            const menuDocRef = this.db.collection('knowledge_base').doc('Papillon')
                .collection(normalizedHotel).doc(language)
                .collection('kinds').doc('Menu');
            await menuDocRef.set({ [sectionName]: content, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            console.log(`[Firestore] Menü için kaydedildi: Papillon/${normalizedHotel}/${language}/kinds/Menu (field: ${sectionName})`);
            return { success: true };
        }

        // SPA için: kinds/Spa dokümanında her spa/alan bir field olarak tutulacak
        if (normalizedKind === 'Spa' && sectionName) {
            const spaDocRef = this.db.collection('knowledge_base').doc('Papillon')
                .collection(normalizedHotel).doc(language)
                .collection('kinds').doc('Spa');
            await spaDocRef.set({ [sectionName]: content, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            console.log(`[Firestore] SPA için kaydedildi: Papillon/${normalizedHotel}/${language}/kinds/Spa (field: ${sectionName})`);
            return { success: true };
        }

        // For daily content, ensure we always have a date
        if (normalizedKind === 'Daily') {
            if (!documentDate) {
                // If no date provided, use current UTC date
                const now = new Date();
                documentDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                console.log(`[Firestore] No date provided for daily content, using current UTC date:`, documentDate.toISOString());
            } else {
                // If date provided, ensure it's set to UTC midnight
                const year = documentDate.getFullYear();
                const month = documentDate.getMonth();
                const date = documentDate.getDate();
                documentDate = new Date(Date.UTC(year, month, date));
            }
            
            console.log(`[Firestore] Storing daily content for date:`, {
                utcDate: documentDate.toISOString(),
                localDate: new Date(documentDate).toLocaleString()
            });
        }

        // General, Daily için artan isimli doküman olarak kaydet
        if (['General', 'Daily'].includes(normalizedKind)) {
            const kindDocRef = this.db.collection('knowledge_base').doc('Papillon')
                .collection(normalizedHotel).doc(language)
                .collection('kinds').doc(normalizedKind);
            // ... chunk kodu burada kalabilir, SPA ve Menu için chunks tamamen kaldırıldı
        }

        return { success: true };
    }

    async searchKnowledge(hotel, language) {
        await this.ensureInitialized();
        if (!this.isInitialized) return { success: false, content: '' };

        // Normalize hotel name to match Firestore structure
        let normalizedHotel = hotel ? hotel.charAt(0).toUpperCase() + hotel.slice(1).toLowerCase() : null;
        if (hotel === 'Papillon' || hotel === 'Tümü') normalizedHotel = 'All';
        console.log(`[Knowledge Search] Starting search for hotel: ${hotel} (normalized: ${normalizedHotel}), language: ${language}`);

        if (!normalizedHotel || !['Belvil', 'Zeugma', 'Ayscha', 'All'].includes(normalizedHotel)) {
            console.log(`[Knowledge Search] Invalid hotel name: ${hotel}`);
            return { success: false, content: '' };
        }

        const languagePriorities = [language, 'en', 'tr', 'de', 'ru'].filter((v, i, a) => a.indexOf(v) === i);
        console.log(`[Knowledge Search] Language priority order: ${languagePriorities.join(', ')}`);
        
        let foundGeneral = null, foundGeneralLang = null;
        let foundDaily = null, foundDailyLang = null;
        let foundSpa = null, foundSpaLang = null;
        let foundFB = null, foundFBLang = null; // F&B kategorisi için
        let foundSpaChunks = {}; // SPA chunks'ları saklamak için
        let foundMenuChunks = {}; // Menu chunks'ları saklamak için

        const dates = this.getDates();
        const { todayStart, todayEnd, yesterdayStart, yesterdayEnd, todayDate, yesterdayDate } = dates;

        const searchInLanguage = async (lang) => {
            const path = `knowledge_base/Papillon/${normalizedHotel}/${lang}/kinds`;
            console.log(`[Knowledge Search] Checking path: ${path}`);
            
            const kindsCollectionRef = this.db.collection('knowledge_base').doc('Papillon')
                .collection(normalizedHotel).doc(lang)
                .collection('kinds');

            try {
                // Check if the general document exists first
                const generalDoc = await kindsCollectionRef.doc('General').get();
                console.log(`[Knowledge Search] General doc exists: ${generalDoc.exists}`);
                if (generalDoc.exists) {
                    console.log(`[Knowledge Search] General doc data:`, generalDoc.data());
                }
                
                // Get general chunks
                const generalChunksSnapshot = await kindsCollectionRef.doc('General').collection('chunks').get();
                const generalChunks = generalChunksSnapshot.docs.map(doc => doc.data().text);
                console.log(`[Knowledge Search] Found ${generalChunks.length} general chunks`);
                
                // Get daily chunks
                const dailyChunksSnapshot = await kindsCollectionRef.doc('Daily').collection('chunks').get();
                console.log(`[Knowledge Search] Found ${dailyChunksSnapshot.size} daily chunks`);
                
                // Log all daily chunks dates for debugging
                if (!dailyChunksSnapshot.empty) {
                    console.log(`[Knowledge Search] All daily chunks in ${lang}:`, 
                        dailyChunksSnapshot.docs.map(doc => {
                            const data = doc.data();
                            return {
                                id: doc.id,
                                date: data.date ? new Date(data.date.seconds * 1000).toISOString() : 'no date',
                                seconds: data.date?.seconds
                            };
                        })
                    );

                    // Log date ranges for comparison
                    console.log(`[Knowledge Search] Date ranges for comparison:`, {
                        todayStart: new Date(todayStart.seconds * 1000).toISOString(),
                        todayStartSeconds: todayStart.seconds,
                        todayEnd: new Date(todayEnd.seconds * 1000).toISOString(),
                        todayEndSeconds: todayEnd.seconds,
                        yesterdayStart: new Date(yesterdayStart.seconds * 1000).toISOString(),
                        yesterdayStartSeconds: yesterdayStart.seconds,
                        yesterdayEnd: new Date(yesterdayEnd.seconds * 1000).toISOString(),
                        yesterdayEndSeconds: yesterdayEnd.seconds
                    });
                }
                
                // Get spa chunks - yeni düzende tek doküman, alanlar
                let spaChunks = [];
                let spaChunksByName = {};
                try {
                    const spaDoc = await kindsCollectionRef.doc('Spa').get();
                    if (spaDoc.exists) {
                        const spaData = spaDoc.data();
                        if (spaData && typeof spaData === 'object') {
                            for (const [spaName, text] of Object.entries(spaData)) {
                                if (spaName !== 'updatedAt' && text) {
                                    spaChunksByName[spaName] = [{ text }];
                                    spaChunks.push(text);
                                    console.log(`[Knowledge Search] Found spa for: ${spaName}`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(`[Knowledge Search] Error reading SPA data:`, error);
                    spaChunks = [];
                    spaChunksByName = {};
                }
                console.log(`[Knowledge Search] Found ${spaChunks.length} total SPA chunks`);

                // Get menu chunks - yeni düzende tek doküman, alanlar
                let menuChunks = [];
                let menuChunksByRestaurant = {};
                try {
                    const menuDoc = await kindsCollectionRef.doc('Menu').get();
                    if (menuDoc.exists) {
                        const menuData = menuDoc.data();
                        if (menuData && typeof menuData === 'object') {
                            for (const [restaurant, text] of Object.entries(menuData)) {
                                if (restaurant !== 'updatedAt' && text) {
                                    menuChunksByRestaurant[restaurant] = [{ text }];
                                    menuChunks.push(text);
                                    console.log(`[Knowledge Search] Found menu for restaurant: ${restaurant}`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(`[Knowledge Search] Error reading Menu data:`, error);
                    menuChunks = [];
                    menuChunksByRestaurant = {};
                }
                console.log(`[Knowledge Search] Found ${menuChunks.length} total Menu chunks`);

                let todayContent = [];
                let yesterdayContent = [];
                if (!dailyChunksSnapshot.empty) {
                    dailyChunksSnapshot.forEach(doc => {
                        const data = doc.data();
                            if (!data.date) {
                                console.warn(`[Knowledge Search] ⚠️ Daily chunk found without date:`, {
                                    id: doc.id,
                                    text: data.text?.substring(0, 100) + '...' // Log first 100 chars of content
                                });
                                return;
                            }
                            if (data.text && data.date) {
                                const chunkDate = new Date(data.date.seconds * 1000);
                                console.log(`[Knowledge Search] Analyzing daily chunk date:`, {
                                    id: doc.id,
                                    chunkDate: chunkDate.toISOString(),
                                    chunkSeconds: data.date.seconds,
                                    todayStartSeconds: todayStart.seconds,
                                    todayEndSeconds: todayEnd.seconds,
                                    yesterdayStartSeconds: yesterdayStart.seconds,
                                    yesterdayEndSeconds: yesterdayEnd.seconds
                                });

                                // Check if date falls within today's or yesterday's range
                                if (data.date.seconds >= todayStart.seconds && data.date.seconds <= todayEnd.seconds) {
                                    todayContent.push(data.text);
                                    console.log(`[Knowledge Search] ✅ Found today's (${todayDate}) chunk:`, { 
                                        id: doc.id, 
                                        timestamp: chunkDate.toISOString() 
                                    });
                                }
                                else if (data.date.seconds >= yesterdayStart.seconds && data.date.seconds <= yesterdayEnd.seconds) {
                                    yesterdayContent.push(data.text);
                                    console.log(`[Knowledge Search] ✅ Found yesterday's (${yesterdayDate}) chunk:`, { 
                                        id: doc.id, 
                                        timestamp: chunkDate.toISOString() 
                                    });
                                } else {
                                    console.log(`[Knowledge Search] ❌ Daily chunk outside target dates:`, { 
                                        id: doc.id, 
                                        chunkDate: chunkDate.toISOString(),
                                        today: new Date(todayStart.seconds * 1000).toISOString(),
                                        yesterday: new Date(yesterdayStart.seconds * 1000).toISOString()
                                    });
                                }
                            }
                    });
                }
                
                console.log(`[Knowledge Search] Daily content - Today (${todayDate}): ${todayContent.length} chunks, Yesterday (${yesterdayDate}): ${yesterdayContent.length} chunks`);
                
                const result = {
                    general: generalChunks.join('\n'),
                    dailyToday: todayContent.join('\n'),
                    dailyYesterday: yesterdayContent.join('\n'),
                    spa: spaChunks.join('\n'),
                    menu: menuChunks.join('\n'), // Menü bilgisi ekle
                    dates: {
                        today: todayDate,
                        yesterday: yesterdayDate,
                        hasTodayContent: todayContent.length > 0,
                        hasYesterdayContent: yesterdayContent.length > 0
                    },
                    menuChunks: menuChunksByRestaurant, // Restoran bazlı menü chunk'ları
                    spaChunks: spaChunksByName // Spa bazlı spa chunk'ları
                };

                // Log final content summary
                console.log(`[Knowledge Search] Content found:`, {
                    general: result.general.length > 0,
                    dailyToday: result.dailyToday.length > 0,
                    dailyYesterday: result.dailyYesterday.length > 0,
                    spa: result.spa.length > 0,
                    menu: result.menu.length > 0,
                    dates: result.dates
                });

                return result;
            } catch (error) {
                console.error(`[Knowledge Search] Error searching in ${path}:`, error);
                return {
                    general: '',
                    dailyToday: '',
                    dailyYesterday: '',
                    spa: '',
                    menu: '',
                    dates: {
                        today: todayDate,
                        yesterday: yesterdayDate,
                        hasTodayContent: false,
                        hasYesterdayContent: false
                    },
                    menuChunks: {},
                    spaChunks: {}
                };
            }
        };

        for (const lang of languagePriorities) {
            console.log(`[Knowledge Search] Trying language: ${lang}`);
            const results = await searchInLanguage(lang);
            
            if (!foundGeneral && results.general) {
                foundGeneral = results.general;
                foundGeneralLang = lang;
                console.log(`[Knowledge Search] SUCCESS: Found GENERAL info in language: ${lang}`);
            }
            if (!foundDaily && (results.dailyToday || results.dailyYesterday)) {
                foundDaily = { 
                    today: results.dailyToday, 
                    yesterday: results.dailyYesterday,
                    dates: results.dates 
                };
                foundDailyLang = lang;
                console.log(`[Knowledge Search] SUCCESS: Found DAILY info in language: ${lang}`);
            }
            if (!foundSpa && results.spa) {
                foundSpa = results.spa;
                foundSpaLang = lang;
                foundSpaChunks = results.spaChunks || {};
                console.log(`[Knowledge Search] SUCCESS: Found SPA info in language: ${lang}`);
            }
            if (!foundFB && results.menu) {
                foundFB = results.menu;
                foundFBLang = lang;
                foundMenuChunks = results.menuChunks || {};
                console.log(`[Knowledge Search] SUCCESS: Found Menu info in language: ${lang}`);
            }
            if (foundGeneral && foundDaily && foundSpa && foundFB) break;
        }

        // Çeviri fallback: Eğer bulunan chunk kullanıcının dilinde değilse, çevir
        if (foundGeneral && foundGeneralLang !== language) {
            console.log(`[Knowledge Search] Translating GENERAL info from ${foundGeneralLang} to ${language}`);
            foundGeneral = await translationService.translateText(foundGeneral, language);
        }
        if (foundDaily && foundDailyLang !== language) {
            if (foundDaily.today) {
                console.log(`[Knowledge Search] Translating DAILY TODAY info from ${foundDailyLang} to ${language}`);
                foundDaily.today = await translationService.translateText(foundDaily.today, language);
            }
            if (foundDaily.yesterday) {
                console.log(`[Knowledge Search] Translating DAILY YESTERDAY info from ${foundDailyLang} to ${language}`);
                foundDaily.yesterday = await translationService.translateText(foundDaily.yesterday, language);
            }
        }
        if (foundSpa && foundSpaLang !== language) {
            console.log(`[Knowledge Search] Translating SPA info from ${foundSpaLang} to ${language}`);
            foundSpa = await translationService.translateText(foundSpa, language);
        }
        if (foundFB && foundFBLang !== language) {
            console.log(`[Knowledge Search] Translating Menu info from ${foundFBLang} to ${language}`);
            foundFB = await translationService.translateText(foundFB, language);
        }

        let finalContent = '';
        if (foundGeneral) {
            finalContent += `### General Information ###\n${foundGeneral}\n\n`;
        }
        if (foundDaily) {
            if (foundDaily.today) {
                finalContent += `### Daily Information (${foundDaily.dates.today}) ###\n${foundDaily.today}\n\n`;
            } else {
                console.log(`[Knowledge Search] No information available for today (${foundDaily.dates.today})`);
            }
            if (foundDaily.yesterday) {
                finalContent += `### Daily Information (${foundDaily.dates.yesterday}) ###\n${foundDaily.yesterday}\n\n`;
            }
        }
        if (foundSpa) {
            finalContent += `### SPA Information ###\n${foundSpa}\n\n`;
        }
        if (foundFB) {
            console.log('[DEBUG] foundFB:', foundFB);
            finalContent += `### Menu Information ###\n${foundFB}\n\n`;
        }
        // LOG CONTEXT
        console.log('[Knowledge Search] LLM context (first 2000 chars):', finalContent.substring(0, 2000));
        
        const success = finalContent.length > 0;
        const dailyDates = foundDaily?.dates || { today: todayDate, yesterday: yesterdayDate, hasTodayContent: false, hasYesterdayContent: false };
        
        console.log(`[Knowledge Search] Final check. General: ${!!foundGeneral}, Daily: ${!!foundDaily}, SPA: ${!!foundSpa}, Menu: ${!!foundFB}. Length: ${finalContent.length}`);
        return { 
            success, 
            content: finalContent,
            dates: dailyDates,
            menuChunks: foundMenuChunks,
            spaChunks: foundSpaChunks
        };
    }

    async getAvailableHotels() {
        await this.ensureInitialized();
        if (!this.isInitialized) return [];
        try {
            const collections = await this.db.collection('knowledge_base').doc('Papillon').listCollections();
            // 'All' koleksiyonunu da dahil et
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

    async getSessionQuestions(sessionId) {
        await this.ensureInitialized();
        if (!this.isInitialized) return [];
        try {
            // Simplified query that doesn't require a composite index
            const questionsRef = this.db.collection('questions_log');
            const snapshot = await questionsRef
                .where('sessionId', '==', sessionId)
                .get();

            if (snapshot.empty) {
                return [];
            }

            // Sort in memory instead of in the query
            return snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .sort((a, b) => {
                    const timeA = a.timestamp ? new Date(a.timestamp) : new Date(0);
                    const timeB = b.timestamp ? new Date(b.timestamp) : new Date(0);
                    return timeB - timeA; // descending order
                });
        } catch (error) {
            console.error('Failed to get session questions:', error);
            return [];
        }
    }

    async updateQuestionHotel(questionId, hotel) {
        try {
            const questionRef = this.db.collection('questions_log').doc(questionId);
            await questionRef.update({
                detectedHotel: hotel,
                updatedAt: new Date().toISOString()
            });
            console.log(`✅ Updated hotel context for question ${questionId}`);
            return true;
        } catch (error) {
            console.error('Failed to update question hotel:', error);
            return false;
        }
    }

    async getRecentHotelUpdates(minutes = 5) {
        try {
            const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
            const questionsRef = this.db.collection('questions_log');
            
            // First get all recently updated documents
            const snapshot = await questionsRef
                .where('updatedAt', '>=', cutoffTime.toISOString())
                .get();

            // Then filter for hotel updates in memory
            const updatedDocs = snapshot.docs.filter(doc => {
                const data = doc.data();
                return data.detectedHotel !== null && data.detectedHotel !== undefined;
            });

            return {
                size: updatedDocs.length,
                docs: updatedDocs
            };
        } catch (error) {
            console.error('Failed to get recent hotel updates:', error);
            return { size: 0, docs: [] };
        }
    }

    async updateQuestionAnalytics(questionId, analyticsData) {
        await this.ensureInitialized();
        if (!this.isInitialized) return false;
        try {
            await this.db.collection('questions_log').doc(questionId).update(analyticsData);
            return true;
        } catch (error) {
            console.error('Failed to update question analytics:', error);
            return false;
        }
    }

    // Session context yönetimi
    async setSessionContext(sessionId, context) {
        await this.ensureInitialized();
        if (!this.isInitialized) return;
        try {
            await this.db.collection('sessionContexts').doc(sessionId).set(context, { merge: true });
        } catch (error) {
            console.error('❌ Error setting session context:', error);
        }
    }

    async getSessionContext(sessionId) {
        await this.ensureInitialized();
        if (!this.isInitialized) return {};
        try {
            const doc = await this.db.collection('sessionContexts').doc(sessionId).get();
            return doc.exists ? doc.data() : {};
        } catch (error) {
            console.error('❌ Error getting session context:', error);
            return {};
        }
    }
}

module.exports = new FirebaseService();
