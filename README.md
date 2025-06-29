# 🏨 Papillon Hotels AI Assistant

Papillon Hotels için geliştirilmiş yapay zeka asistanı. Misafirlerin oteller hakkındaki sorularını yanıtlayan ve sürekli öğrenebilen akıllı sistem.

## 🚀 Özellikler

### Misafir Arayüzü
- **Çok Dilli Destek**: Türkçe, İngilizce, Almanca, Rusça
- **Akıllı Sohbet**: ChatGPT benzeri doğal dil işleme
- **Otel Bilgileri**: Belvil, Zeugma, Ayscha otellerine özel bilgiler
- **Konum Bilgileri**: Yakın hastane, eczane, market gibi sorgular
- **Gerçek Zamanlı**: Anlık yanıt verme

### Admin Paneli
- **PDF/Metin Yükleme**: Document AI ile OCR işleme
- **Kategorize Eğitim**: Otel ve dil bazında bilgi saklama
- **Toplu Eğitim**: Tüm oteller için aynı anda eğitim
- **Firebase Entegrasyonu**: Bulut tabanlı bilgi saklama

## 🛠️ Teknoloji Stack

### Backend
- **Node.js + Express**: API server
- **Google Gemini 2.0 Flash**: AI model
- **Google Document AI**: PDF OCR işleme
- **Firebase Firestore**: Bilgi veritabanı
- **Google Translate API**: Çoklu dil desteği

### Frontend
- **React.js**: Modern web arayüzü
- **Axios**: API iletişimi
- **React Router**: Sayfa yönlendirme
- **Responsive Design**: Mobil uyumlu tasarım

## 📋 Kurulum

### 1. Bağımlılıkları Yükle
```bash
npm run install-deps
```

### 2. Ortam Değişkenlerini Ayarla
`.env` dosyasını düzenleyin:
```env
# Google Cloud API anahtarları
GOOGLE_CLOUD_API_KEY=AIzaSyBiqxFAooCoJX1y-_IgDbVAtoaZ2SVKmxk
DOCUMENT_AI_PROJECT_ID=e530cb7924639d3f
DOCUMENT_AI_LOCATION=eu

# Firebase ayarları (backend açtıktan sonra eklenecek)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key
```

### 3. Uygulamayı Başlat
```bash
# Geliştirme modu (frontend + backend)
npm run dev

# Sadece backend
npm run server

# Sadece frontend
npm run client
```

## 🏗️ Proje Yapısı

```
papillon-hotels-ai/
├── server/
│   ├── services/
│   │   ├── firebase.js      # Firebase bilgi yönetimi
│   │   ├── gemini.js        # AI chat servisi
│   │   └── documentai.js    # PDF işleme
│   ├── routes/
│   │   ├── chat.js          # Misafir chat API'ları
│   │   ├── admin.js         # Admin eğitim API'ları
│   │   └── knowledge.js     # Bilgi arama API'ları
│   └── index.js             # Ana server dosyası
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.js    # Misafir chat arayüzü
│   │   │   ├── AdminPanel.js       # Admin eğitim paneli
│   │   │   └── Navigation.js       # Navigasyon menüsü
│   │   ├── App.js           # Ana React komponenti
│   │   └── index.js         # React giriş noktası
│   └── public/
├── .env                     # Ortam değişkenleri
└── README.md               # Bu dosya
```

## 💾 Firebase Veritabanı Yapısı

```
knowledge_base/
└── Papillon/
    ├── Belvil/
    │   ├── tr/             # Türkçe bilgiler
    │   ├── en/             # İngilizce bilgiler
    │   ├── de/             # Almanca bilgiler
    │   └── ru/             # Rusça bilgiler
    ├── Zeugma/
    │   └── (aynı dil yapısı)
    └── Ayscha/
        └── (aynı dil yapısı)
```

## 🎯 Kullanım

### Misafir Arayüzü
1. `/chat` sayfasına gidin
2. Otel hakkında soru sorun
3. AI hangi otel ve dilde yanıt vereceğini belirler
4. Anlık yanıt alın

**Örnek Sorular:**
- "Belvil otelinin havuz saatleri nedir?"
- "Zeugma'ya en yakın hastane nerede?"
- "Hello, can you tell me about Ayscha hotel rooms?"

### Admin Paneli
1. `/admin` sayfasına gidin
2. Otel seçin (Belvil, Zeugma, Ayscha veya Hepsi)
3. Dil seçin (Türkçe, İngilizce, Almanca, Rusça)
4. PDF veya TXT dosyası yükleyin
5. "Eğitimi Başlat" butonuna tıklayın

## 🔄 Gelecek Özellikler

- **Canlı Destek Entegrasyonu**
- **WhatsApp Bot Desteği**
- **Online Rezervasyon Sistemi**
- **Oda Müsaitlik Durumu**
- **Analiz Dashboard'u**
- **Konuşma Kayıtları ve İstatistikler**

## 🔧 API Endpoints

### Chat API
- `POST /api/chat/message` - Mesaj gönder
- `GET /api/chat/history/:sessionId` - Sohbet geçmişi

### Admin API
- `POST /api/admin/train` - AI eğitimi
- `GET /api/admin/stats` - Eğitim istatistikleri

### Knowledge API
- `GET /api/knowledge/search` - Bilgi arama
- `GET /api/knowledge/config` - Desteklenen oteller/diller

## 📝 Lisans

Bu proje Papillon Hotels için özel olarak geliştirilmiştir.

## 🤝 Destek

Herhangi bir sorun veya öneriniz için lütfen iletişime geçin. 