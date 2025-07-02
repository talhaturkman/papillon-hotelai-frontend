import React, { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

function TrainingTab({ token, onAuthError }) {
  const [hotel, setHotel] = useState('Zeugma');
  const [language, setLanguage] = useState('tr');
  const [kind, setKind] = useState('General');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleApiError = useCallback((err) => {
    console.error("API Error in TrainingTab:", err);
    if (err.response && err.response.status === 401) {
      if (onAuthError) {
        onAuthError(); // This calls the logout function from AdminPanel
      }
      return true; // Error was handled
    }
    return false; // Error was not handled
  }, [onAuthError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Lütfen bir dosya seçin.');
      return;
    }

    setUploading(true);
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('hotel', hotel);
    formData.append('language', language);
    formData.append('kind', kind);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/knowledge/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setMessage(response.data.message || 'Yükleme başarılı!');
      setFile(null); // Clear file input after successful upload
      e.target.reset(); // Reset the form
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err.response?.data?.error || 'Dosya yüklenirken bir hata oluştu.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="training-tab" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="hotel-select">Otel</label>
            <select id="hotel-select" value={hotel} onChange={(e) => setHotel(e.target.value)}>
              <option value="Zeugma">Papillon Zeugma</option>
              <option value="Belvil">Papillon Belvil</option>
              <option value="Ayscha">Papillon Ayscha</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="language-select">Dil</label>
            <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="ru">Русский</option>
            </select>
          </div>
           <div className="form-group">
            <label htmlFor="kind-select">Bilgi Türü</label>
            <select id="kind-select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="General">Genel Bilgi</option>
              <option value="Daily">Günlük Aktivite</option>
              <option value="SPA">SPA Menüsü</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="file-upload">PDF Dosyası</label>
          <input 
            id="file-upload" 
            type="file" 
            accept=".pdf" 
            onChange={(e) => setFile(e.target.files[0])} 
          />
        </div>
        <div>
          <button type="submit" disabled={uploading || !file} className="submit-button">
            {uploading ? 'Yükleniyor...' : 'AI Modelini Eğit'}
          </button>
        </div>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
}

export default TrainingTab; 