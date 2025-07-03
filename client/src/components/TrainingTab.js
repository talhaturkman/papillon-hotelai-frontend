import React, { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

// Restoran verileri
const restaurantData = {
  Belvil: [
    'Belle Vue (Ana Restoran)',
    'Bloom Lounge',
    'Food Court',
    'Blue Bar',
    'Kanji',
    'Dolce Vita',
    'Mirage Pastane',
    'Bloom (Steak & Wine)',
    'Bloom (Akdeniz)',
    'Mirage (İtalyan)'
  ],
  Zeugma: [
    'Mosaic (Ana Restoran)',
    'Papy Çocuk Restoranı',
    'Asma',
    'Food Court',
    'Macrina',
    'PA&CO',
    'Beer House',
    'Farfalle',
    'The Gourmet Street',
    'Haru',
    'Mey\'Hane',
    'Meyhane (Türk)'
  ],
  Ayscha: [
    'Ayscha Ana Restoran',
    'Martini Bar',
    'Beach Snack',
    'Cafe Harmony',
    'PA&CO',
    'Food Court',
    'Taco',
    'Villa Snack Restoran',
    'Surf & Turf',
    'Safran',
    'Mikado',
    'Coral',
    'Viccolo'
  ],
  Papillon: [
    'Tüm Restoranlar (Genel Bilgi)'
  ]
};

function TrainingTab({ token, onAuthError }) {
  const [hotel, setHotel] = useState('Zeugma');
  const [language, setLanguage] = useState('tr');
  const [kind, setKind] = useState('General');
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // F&B seçildiğinde ve otel değiştiğinde restoran listesini güncelle
  const availableRestaurants = restaurantData[hotel] || [];

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

    // F&B seçildiğinde restoran seçimi zorunlu
    if (kind === 'FB' && !selectedRestaurant) {
      setError('F&B kategorisi için lütfen bir restoran seçin.');
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
    if (kind === 'FB' && selectedRestaurant) {
      formData.append('restaurant', selectedRestaurant);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/knowledge/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setMessage(response.data.message || 'Yükleme başarılı!');
      setFile(null); // Clear file input after successful upload
      setSelectedRestaurant(''); // Clear restaurant selection
      e.target.reset(); // Reset the form
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err.response?.data?.error || 'Dosya yüklenirken bir hata oluştu.');
      }
    } finally {
      setUploading(false);
    }
  };

  // Otel değiştiğinde restoran seçimini sıfırla
  const handleHotelChange = (e) => {
    setHotel(e.target.value);
    setSelectedRestaurant('');
  };

  // Kategori değiştiğinde restoran seçimini sıfırla
  const handleKindChange = (e) => {
    setKind(e.target.value);
    setSelectedRestaurant('');
  };

  return (
    <div className="training-tab" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="hotel-select">Otel</label>
            <select id="hotel-select" value={hotel} onChange={handleHotelChange}>
              <option value="Papillon">Tümü</option>
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
            <select id="kind-select" value={kind} onChange={handleKindChange}>
              <option value="General">Genel Bilgi</option>
              <option value="Daily">Günlük Aktivite</option>
              <option value="SPA">SPA Menüsü</option>
              <option value="FB">F&B</option>
            </select>
          </div>
        </div>

        {/* F&B seçildiğinde restoran listesi göster */}
        {kind === 'FB' && (
          <div className="form-group">
            <label htmlFor="restaurant-select">Restoran</label>
            <select 
              id="restaurant-select" 
              value={selectedRestaurant} 
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              required
            >
              <option value="">Restoran seçin...</option>
              {availableRestaurants.map((restaurant, index) => (
                <option key={index} value={restaurant}>
                  {restaurant}
                </option>
              ))}
            </select>
            {hotel !== 'Papillon' && (
              <div style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.9rem', 
                color: '#666',
                backgroundColor: '#f8f9fa',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #e9ecef'
              }}>
                <strong>📋 {hotel} Otelindeki Restoranlar:</strong>
                <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                  {availableRestaurants.map((restaurant, index) => (
                    <li key={index} style={{ marginBottom: '0.25rem' }}>{restaurant}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="file-upload">Eğitim Dosyası</label>
          <input 
            id="file-upload" 
            type="file" 
            accept=".pdf,.docx,.txt,.xlsx" 
            onChange={(e) => setFile(e.target.files[0])} 
          />
        </div>
        <div>
          <button type="submit" disabled={uploading || !file || (kind === 'FB' && !selectedRestaurant)} className="submit-button">
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