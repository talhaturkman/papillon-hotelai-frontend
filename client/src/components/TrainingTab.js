import React from 'react';

function TrainingTab({ 
  selectedHotel, setSelectedHotel,
  selectedLanguage, setSelectedLanguage,
  selectedKind, setSelectedKind,
  selectedFile, setSelectedFile,
  isUploading, isAnalyzing,
  message, messageType, pdfInfo,
  hotels, languages, kinds, authToken,
  handleFileChange, analyzePDF, handleSubmit, handleLogout
}) {
  
  return (
    <div className="training-tab">
      <div className="tab-header">
        <h2>📚 AI Eğitim Merkezi</h2>
        <p>Yapay zeka eğitimi için PDF veya metin dosyası yükleyin</p>
        <small>Büyük PDFler otomatik olarak 15 sayfalık parçalara bölünür</small>
      </div>

      <div className="admin-container">
        <form onSubmit={handleSubmit} className="upload-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="hotel">Otel Seçimi:</label>
              <select
                id="hotel"
                value={selectedHotel}
                onChange={(e) => setSelectedHotel(e.target.value)}
                required
              >
                <option value="">Otel seçin...</option>
                {hotels.map(hotel => (
                  <option key={hotel.value} value={hotel.value}>
                    {hotel.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="language">Dil Seçimi:</label>
              <select
                id="language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                required
              >
                <option value="">Dil seçin...</option>
                {languages.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="kind">Bilgi Türü:</label>
              <select
                id="kind"
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value)}
                required
              >
                <option value="">Bilgi türü seçin...</option>
                {kinds.map(kind => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="file">Dosya Seçimi:</label>
            <input
              type="file"
              id="file"
              onChange={handleFileChange}
              accept=".pdf,.txt"
              required
            />
            {selectedFile && (
              <div className="file-info">
                Seçilen: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          {selectedFile && selectedFile.type === 'application/pdf' && (
            <div className="pdf-analysis">
              <button
                type="button"
                onClick={analyzePDF}
                disabled={isAnalyzing}
                className="analyze-button"
              >
                {isAnalyzing ? 'Analiz ediliyor...' : 'PDF Analiz Et'}
              </button>
              
              {pdfInfo && (
                <div className="pdf-info">
                  <h4>PDF Bilgileri:</h4>
                  <ul>
                    <li><strong>Sayfa sayısı:</strong> {pdfInfo.pages || pdfInfo.totalPages}</li>
                    <li><strong>Tahmini chunk sayısı:</strong> {pdfInfo.estimatedChunks}</li>
                    <li><strong>Dosya boyutu:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading || !selectedHotel || !selectedLanguage || !selectedFile}
            className="submit-button"
          >
            {isUploading ? 'Eğitim Başlatıyor...' : 'Eğitimi Başlat'}
          </button>
        </form>

        {message && (
          <div className={'message ' + messageType}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainingTab; 