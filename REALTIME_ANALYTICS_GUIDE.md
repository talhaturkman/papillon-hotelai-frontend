# Gerçek Zamanlı Analytics Sistemi

## ��� Sistem Değişiklikleri

### Önceki Sistem (Toplu Analiz)
- Tüm sorular toplu olarak analiz ediliyordu
- Analytics panosuna her girişte uzun bekleme süreleri
- Cache 5 dakika geçerliydi

### Yeni Sistem (Gerçek Zamanlı Analiz)
- Her soru geldiğinde anında analiz ediliyor
- Analytics panosu anında güncelleniyor
- Cache 2 dakika geçerli (daha hızlı güncelleme)
- Sadece gerçek sorular (isQuestion: true) analiz ediliyor

## ��� İşleyiş Akışı

### 1. Soru Geldiğinde (Chat Route)
```
Kullanıcı Soru Gönderir
    ↓
Firebase'e Kaydet (preprocessed: false)
    ↓
Anında isQuestion Kontrolü
    ↓
Eğer Soru İse:
    - categorizeQuestion() çağır
    - Firebase'i güncelle (isQuestion: true, categorization)
    - preprocessed: true yap
Eğer Soru Değilse:
    - Firebase'i güncelle (isQuestion: false)
    - preprocessed: true yap
```

### 2. Analytics Panosu Açıldığında
```
Analytics Endpoint Çağrılır
    ↓
Cache Kontrolü (2 dakika)
    ↓
Sadece isQuestion: true olan soruları al
    ↓
Gruplandır ve döndür
```

## ��� Yeni Endpoint'ler

### 1. Top Questions (Güncellenmiş)
```
GET /api/analytics/top-questions
GET /api/analytics/top-questions?force=true
```

**Response:**
```json
{
  "success": true,
  "questions": [...],
  "lastUpdated": "2024-01-01T12:00:00.000Z",
  "totalQuestions": 25,
  "cacheInfo": {
    "cached": false,
    "cacheAge": "2024-01-01T12:00:00.000Z"
  }
}
```

### 2. Stats Endpoint (Yeni)
```
GET /api/analytics/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalQuestions": 25,
    "lastUpdated": "2024-01-01T12:00:00.000Z",
    "topCategories": {
      "facility": 10,
      "location": 8,
      "time": 7
    },
    "topFacilities": {
      "pool": 5,
      "restaurant": 4,
      "spa": 3
    },
    "languages": {
      "tr": 15,
      "en": 6,
      "de": 3,
      "ru": 1
    },
    "hotels": {
      "Belvil": 12,
      "Zeugma": 8,
      "Ayscha": 5
    }
  }
}
```

### 3. Cache Clear (Güncellenmiş)
```
DELETE /api/analytics/clear-cache
```

## ��� Test Etme

### 1. Test Scripti Çalıştır
```bash
node test-realtime-analytics.js
```

### 2. Manuel Test
```bash
# 1. Mevcut analytics'i kontrol et
curl http://localhost:3000/api/analytics/top-questions

# 2. Soru gönder
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Belvil otelinde havuz var mı?", "session_id": "test-123"}'

# 3. Analytics'i tekrar kontrol et
curl http://localhost:3000/api/analytics/top-questions?force=true

# 4. Stats'ı kontrol et
curl http://localhost:3000/api/analytics/stats
```

## ��� Backend Logları

### Soru Analizi Logları
```
��� Starting real-time analysis for question: abc123
❓ Is question "Belvil otelinde havuz var mı?": true
��� Categorization for "Belvil otelinde havuz var mı?": { category: 'facility', facility: 'pool', intent: '...' }
✅ Question abc123 analyzed and categorized in real-time
```

### Analytics Logları
```
��� Received analytics request: { force: 'true' }
��� Starting analytics process...
��� Retrieved 50 questions from Firebase
✅ Filtered 25 real questions out of 50 total
✅ Processed 25 valid real questions
✅ Grouped into 15 question groups
��� Returning 10 top questions
```

## ⚡ Performans İyileştirmeleri

### 1. Cache Optimizasyonu
- Cache süresi 5 dakikadan 2 dakikaya düşürüldü
- Yeni soru geldiğinde cache otomatik invalidate ediliyor

### 2. Filtreleme
- Sadece `isQuestion: true` olan sorular analiz ediliyor
- Gereksiz AI çağrıları önleniyor

### 3. Gerçek Zamanlı İşleme
- Her soru anında işleniyor
- Analytics panosu açıldığında bekleme yok

## ��� Sorun Giderme

### Soru Analiz Edilmiyor
1. Backend loglarında `[isQuestion]` loglarını kontrol et
2. Firebase'de sorunun `preprocessed: false` olduğunu kontrol et
3. `isQuestion` fonksiyonunun çağrıldığını kontrol et

### Analytics Boş Görünüyor
1. Firebase'de `isQuestion: true` olan sorular var mı kontrol et
2. Cache'i temizle: `DELETE /api/analytics/clear-cache`
3. Force refresh yap: `GET /api/analytics/top-questions?force=true`

### Performans Sorunları
1. Cache süresini artır (questionAnalytics.js'de `cacheValidityPeriod`)
2. Soru sayısını sınırla (getAllQuestions limit parametresi)
3. Batch işleme ekle

## ��� Monitoring

### Önemli Metrikler
- Gerçek zamanlı analiz süresi
- Cache hit/miss oranı
- Top questions güncelleme sıklığı
- AI çağrı sayısı

### Log Monitoring
- `[isQuestion]` logları: Soru analizi
- `���` logları: Analytics işlemleri
- `✅` logları: Başarılı işlemler
- `❌` logları: Hatalar
