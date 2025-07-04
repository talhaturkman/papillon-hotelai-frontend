const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Firebase Admin SDK ile başlat - server klasöründeki JSON dosyasını kullanarak
let app;
try {
    console.log('🔑 Using Firebase service account from server directory...');
    const serviceAccountPath = path.join(__dirname, 'server', 'gen-lang-client-0930707875-602c49a9d911.json');
    const serviceAccount = require(serviceAccountPath);
    
    app = initializeApp({
        credential: cert(serviceAccount),
    });
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    process.exit(1);
}

const db = getFirestore();

async function deleteAllQuestionsLog() {
  const collectionRef = db.collection('questions_log');
  let totalDeleted = 0;
  while (true) {
    const snapshot = await collectionRef.limit(50).get();
    if (snapshot.empty) {
      break;
    }
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`Silinen döküman sayısı: ${totalDeleted}`);
  }
  console.log('Tüm dökümanlar silindi!');
}

deleteAllQuestionsLog().catch(console.error); 