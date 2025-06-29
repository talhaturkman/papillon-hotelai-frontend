# 📄 PDF Chunking Sistemi

## 🎯 Sorun ve Çözüm

**Sorun**: Google Document AI ücretsiz versiyonunda sayfa limiti var (max 15 sayfa)
**Çözüm**: Büyük PDF'leri otomatik olarak 15'er sayfalık parçalara bölen akıllı sistem

## 🔧 Nasıl Çalışıyor

### 1. **Otomatik Tespit**
- PDF 15 sayfadan fazlaysa sistem otomatik olarak algılar
- Kaç parçaya bölüneceğini hesaplar

### 2. **Akıllı Bölme**
- `pdf-lib` kütüphanesi ile PDF'i sayfa sayfa böler
- Her chunk maksimum 15 sayfa içerir
- Sayfa sıraları korunur (1-15, 16-30, vs.)

### 3. **Sıralı İşleme**
- Her chunk ayrı ayrı Document AI'a gönderilir
- Chunk'lar arasında 2 saniye bekleme (rate limiting için)
- Başarısız chunk'lar atlanır, başarılılar birleştirilir

### 4. **Akıllı Birleştirme**
- Tüm chunk'lardan çıkan metinler birleştirilir
- Sayfa geçişleri işaretlenir
- Metadata korunur

## 🌐 Yeni API Endpoints

### 1. PDF Analiz
```bash
POST /api/admin/pdf-info
```
**Kullanım**: PDF'i işlemeden önce kaç chunk'a bölüneceğini gösterir

**Örnek Response**:
```json
{
  "success": true,
  "filename": "hotel-info.pdf",
  "fileSize": "2.5 MB",
  "totalPages": 33,
  "needsSplitting": true,
  "estimatedChunks": 3,
  "maxPagesPerChunk": 15,
  "message": "Bu PDF 3 parçaya bölünecek (her parça max 15 sayfa)"
}
```

### 2. Eğitim (Güncellendi)
```bash
POST /api/admin/train
```
**Yeni Özellikler**:
- Büyük PDF'ler otomatik bölünür
- Chunk bilgileri response'a eklenir
- 50MB'a kadar dosya desteği

## 💻 Web Arayüzü Güncellemeleri

### Admin Panel (/admin)
1. **PDF Analiz Butonu**: PDF seçtikten sonra "🔍 PDF Analiz Et" butonu görünür
2. **Chunk Bilgileri**: PDF'in kaç parçaya bölüneceği gösterilir
3. **İlerleme Feedback**: Eğitim sırasında chunk bilgileri gösterilir

## 🧪 Test Senaryoları

### Küçük PDF (≤15 sayfa)
```
📄 PDF has 10 pages, splitting into chunks of 15 pages
📄 PDF is within page limit, no splitting needed
✅ PDF split into 1 chunks successfully
```

### Büyük PDF (33 sayfa)
```
📄 PDF has 33 pages, splitting into chunks of 15 pages
📄 Creating chunk 1/3: pages 1-15
📄 Creating chunk 2/3: pages 16-30
📄 Creating chunk 3/3: pages 31-33
✅ PDF split into 3 chunks successfully
📄 Processing chunk 1/3 (pages 1-15)
⏳ Waiting 2 seconds before next chunk...
📄 Processing chunk 2/3 (pages 16-30)
⏳ Waiting 2 seconds before next chunk...
📄 Processing chunk 3/3 (pages 31-33)
✅ Successfully processed 3/3 chunks
```

## ⚠️ Document AI Processor Kurulumu

**Önemli**: Sistem çalışması için Google Cloud Console'dan Document AI processor oluşturmanız gerekiyor.

### Adımlar:
1. [Google Cloud Console](https://console.cloud.google.com/) → Document AI
2. "Create Processor" → "Document OCR"
3. Location: "eu" seçin
4. Processor ID'sini kopyalayın
5. `.env` dosyasında güncelleyin:

```env
DOCUMENT_AI_PROCESSOR_ID=projects/e530cb7924639d3f/locations/eu/processors/YOUR_PROCESSOR_ID
```

## 🎯 Kullanım Örnekleri

### 1. Basit Test
```bash
# 33 sayfalık PDF'in chunk bilgilerini al
curl -X POST -F "document=@hotel-guide-33pages.pdf" http://localhost:5000/api/admin/pdf-info
```

### 2. Eğitim
```bash
# 33 sayfalık PDF ile eğitim yap
curl -X POST -F "hotel=Belvil" -F "language=tr" -F "document=@hotel-guide-33pages.pdf" http://localhost:5000/api/admin/train
```

## 📊 Avantajlar

1. **Otomatik**: Manual müdahale gerektirmez
2. **Güvenli**: Chunk'lar arasında rate limiting
3. **Esnek**: Başarısız chunk'lar sistemi durdurmaz
4. **Şeffaf**: Her adım loglanır ve kullanıcıya bildirilir
5. **Ölçeklenebilir**: İstediğiniz sayfa limitini ayarlayabilirsiniz

## 🔧 Konfigürasyon

`server/services/pdfProcessor.js` dosyasında:
```javascript
this.maxPagesPerChunk = 15; // Bu değeri değiştirebilirsiniz
```

## 🚀 Sonuç

Artık 33 sayfalık PDF'lerinizi rahatça yükleyip eğitebilirsiniz! Sistem otomatik olarak:
- PDF'i 3 parçaya böler (15+15+3)
- Her parçayı Document AI ile işler
- Sonuçları birleştirip Firebase'e kaydeder
- Yapay zekayı eğitir

**Test etmek için**: Admin paneline gidin, 33 sayfalık PDF'inizi seçin ve "PDF Analiz Et" butonuna tıklayın! 🎉 