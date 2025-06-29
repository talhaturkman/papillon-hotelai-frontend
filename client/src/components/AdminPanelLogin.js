import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

// API Base URL for backend communication
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

function AdminPanelLogin() {
  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authToken, setAuthToken] = useState(localStorage.getItem('adminToken') || '');
  const [loginCredentials, setLoginCredentials] = useState({
    username: '',
    password: ''
  });
  const [loginError, setLoginError] = useState('');

  // Admin panel states
  const [selectedHotel, setSelectedHotel] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [pdfInfo, setPdfInfo] = useState(null);

  const hotels = [
    { value: 'Belvil', label: 'Belvil Hotel' },
    { value: 'Zeugma', label: 'Zeugma Hotel' },
    { value: 'Ayscha', label: 'Ayscha Hotel' },
    { value: 'Hepsi', label: 'Tüm Oteller' }
  ];

  const languages = [
    { value: 'tr', label: 'Türkçe' },
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'ru', label: 'Русский' }
  ];

  // Check authentication on component mount
  useEffect(() => {
    if (authToken) {
      checkAuthStatus();
    }
  }, []);

  // Check if current token is valid
  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/check-auth`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.data.success) {
        setIsLoggedIn(true);
        console.log('✅ Admin authenticated');
      } else {
        handleLogout();
      }
    } catch (error) {
      console.log('❌ Authentication check failed');
      handleLogout();
    }
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/login`, {
        username: loginCredentials.username,
        password: loginCredentials.password
      });

      if (response.data.success) {
        const token = response.data.token;
        setAuthToken(token);
        localStorage.setItem('adminToken', token);
        setIsLoggedIn(true);
        setLoginCredentials({ username: '', password: '' });
        console.log('✅ Admin login successful');
      } else {
        setLoginError(response.data.message || 'Giriş başarısız');
      }
    } catch (error) {
      setLoginError(error.response?.data?.message || 'Giriş sırasında hata oluştu');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (authToken) {
        await axios.post(`${API_BASE_URL}/api/admin/logout`, {}, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      }
    } catch (error) {
      console.log('Logout request failed, but continuing...');
    }

    setAuthToken('');
    localStorage.removeItem('adminToken');
    setIsLoggedIn(false);
    console.log('🚪 Admin logged out');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setPdfInfo(null);
    setMessage('');
  };

  // Analyze PDF to show chunk information
  const analyzePDF = async () => {
    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      setMessage('Lütfen önce bir PDF dosyası seçin.');
      setMessageType('error');
      return;
    }

    setIsAnalyzing(true);
    setMessage('');

    const formData = new FormData();
    formData.append('document', selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/pdf-info`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.data.success) {
        setPdfInfo(response.data);
        setMessage(`✅ PDF analizi tamamlandı! ${response.data.message}`);
        setMessageType('success');
      } else {
        setMessage('❌ PDF analiz edilemedi.');
        setMessageType('error');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
        return;
      }
      setMessage('❌ PDF analiz sırasında hata oluştu.');
      setMessageType('error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedHotel || !selectedLanguage || !selectedFile) {
      setMessage('Lütfen tüm alanları doldurun.');
      setMessageType('error');
      return;
    }

    setIsUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('hotel', selectedHotel);
    formData.append('language', selectedLanguage);
    formData.append('document', selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/train`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.data.success) {
        let successMsg = '✅ Eğitim başarılı!';
        if (response.data.processingInfo && response.data.processingInfo.chunks > 1) {
          successMsg += ` PDF ${response.data.processingInfo.chunks} parçada işlendi.`;
        }
        setMessage(successMsg);
        setMessageType('success');
        
        setSelectedHotel('');
        setSelectedLanguage('');
        setSelectedFile(null);
        setPdfInfo(null);
      } else {
        setMessage('❌ Eğitim sırasında bir hata oluştu.');
        setMessageType('error');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
        return;
      }
      setMessage('❌ Eğitim sırasında bir hata oluştu.');
      setMessageType('error');
    } finally {
      setIsUploading(false);
    }
  };

  // Login form component
  const LoginForm = () => (
    <div className="admin-login">
      <div className="login-container">
        <div className="login-header">
          <h2>🔐 Admin Panel Girişi</h2>
          <p>Papillon Hotels Yönetim Paneli</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Kullanıcı Adı:</label>
            <input
              type="text"
              id="username"
              value={loginCredentials.username}
              onChange={(e) => setLoginCredentials({
                ...loginCredentials,
                username: e.target.value
              })}
              required
              placeholder="Kullanıcı adınızı girin"
              disabled={isLoggingIn}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Şifre:</label>
            <input
              type="password"
              id="password"
              value={loginCredentials.password}
              onChange={(e) => setLoginCredentials({
                ...loginCredentials,
                password: e.target.value
              })}
              required
              placeholder="Şifrenizi girin"
              disabled={isLoggingIn}
            />
          </div>
          
          {loginError && (
            <div className="error-message">
              ❌ {loginError}
            </div>
          )}
          
          <button
            type="submit"
            className="login-button"
            disabled={isLoggingIn || !loginCredentials.username || !loginCredentials.password}
          >
            {isLoggingIn ? '🔄 Giriş yapılıyor...' : '🚪 Giriş Yap'}
          </button>
        </form>
        
        <div className="login-info">
          <p>💡 Admin erişimi için geçerli kimlik bilgileri gereklidir</p>
          <div className="credentials-hint">
            <small>Varsayılan: papillon_admin / Papillon2024!</small>
          </div>
        </div>
      </div>
    </div>
  );

  // If not logged in, show login form
  if (!isLoggedIn) {
    return <LoginForm />;
  }

  // Main admin panel
  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="header-content">
          <h1>🛠️ Admin Panel</h1>
          <button onClick={handleLogout} className="logout-button">
            🚪 Çıkış Yap
          </button>
        </div>
        <p>Yapay zeka eğitimi için PDF veya metin dosyası yükleyin</p>
        <small>📁 Büyük PDF'ler otomatik olarak 15 sayfalık parçalara bölünür</small>
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
                📄 Seçilen: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
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
                {isAnalyzing ? '🔄 Analiz ediliyor...' : '🔍 PDF Analiz Et'}
              </button>
              
              {pdfInfo && (
                <div className="pdf-info">
                  <h4>📊 PDF Bilgileri:</h4>
                  <ul>
                    <li><strong>Sayfa sayısı:</strong> {pdfInfo.pages}</li>
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
            {isUploading ? '🔄 Eğitim Başlatıyor...' : '🎓 Eğitimi Başlat'}
          </button>
        </form>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanelLogin; 