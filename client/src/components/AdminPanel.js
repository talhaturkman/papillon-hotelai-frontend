import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import TrainingTab from './TrainingTab';
import AnalyticsTab from './AnalyticsTab';

// API Base URL for backend communication
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

function AdminPanel() {
  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authToken, setAuthToken] = useState(localStorage.getItem('adminToken') || '');
  const [loginCredentials, setLoginCredentials] = useState({
    username: '',
    password: ''
  });
  const [loginError, setLoginError] = useState('');

  // Tab management
  const [activeTab, setActiveTab] = useState('training');

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
    { value: 'Hepsi', label: 'Tum Oteller' }
  ];

  const languages = [
    { value: 'tr', label: 'Turkce' },
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'ru', label: 'Russian' }
  ];

  // Check authentication on component mount
  useEffect(() => {
    if (authToken) {
      checkAuthStatus();
    }
  }, [authToken]);

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
        console.log('Admin authenticated');
      } else {
        handleLogout();
      }
    } catch (error) {
      console.log('Authentication check failed');
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
        console.log('Admin login successful');
      } else {
        setLoginError(response.data.message || 'Giris basarisiz');
      }
    } catch (error) {
      setLoginError(error.response?.data?.message || 'Giris sirasinda hata olustu');
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
      console.log('Logout request failed, continuing...');
    }

    setAuthToken('');
    localStorage.removeItem('adminToken');
    setIsLoggedIn(false);
    console.log('Admin logged out');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setPdfInfo(null);
    setMessage('');
  };

  // Analyze PDF
  const analyzePDF = async () => {
    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      setMessage('Lutfen once bir PDF dosyasi secin.');
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
        setMessage('PDF analizi tamamlandi! ' + response.data.message);
        setMessageType('success');
      } else {
        setMessage('PDF analiz edilemedi.');
        setMessageType('error');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
        return;
      }
      setMessage('PDF analiz sirasinda hata olustu.');
      setMessageType('error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedHotel || !selectedLanguage || !selectedFile) {
      setMessage('Lutfen tum alanlari doldurun.');
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
        let successMsg = 'Egitim basarili!';
        if (response.data.processingInfo && response.data.processingInfo.chunks > 1) {
          successMsg += ' PDF ' + response.data.processingInfo.chunks + ' parcada islendi.';
        }
        setMessage(successMsg);
        setMessageType('success');
        
        setSelectedHotel('');
        setSelectedLanguage('');
        setSelectedFile(null);
        setPdfInfo(null);
      } else {
        setMessage('Egitim sirasinda bir hata olustu.');
        setMessageType('error');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
        return;
      }
      setMessage('Egitim sirasinda bir hata olustu.');
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
          <div className="lock-icon"></div>
          <h2>Admin Panel Girisi</h2>
          <p>Papillon Hotels Yonetim Paneli</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Kullanici Adi:</label>
            <input
              type="text"
              id="username"
              value={loginCredentials.username}
              onChange={(e) => setLoginCredentials({
                ...loginCredentials,
                username: e.target.value
              })}
              required
              placeholder="Kullanici adinizi girin"
              disabled={isLoggingIn}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Sifre:</label>
            <input
              type="password"
              id="password"
              value={loginCredentials.password}
              onChange={(e) => setLoginCredentials({
                ...loginCredentials,
                password: e.target.value
              })}
              required
              placeholder="Sifrenizi girin"
              disabled={isLoggingIn}
            />
          </div>
          
          {loginError && (
            <div className="error-message">
              {loginError}
            </div>
          )}
          
          <button
            type="submit"
            className="login-button"
            disabled={isLoggingIn || !loginCredentials.username || !loginCredentials.password}
          >
            {isLoggingIn ? 'Giris yapiliyor...' : 'Giris Yap'}
          </button>
        </form>
        
        <div className="login-info">
          <p>Admin erisimi icin gecerli kimlik bilgileri gereklidir</p>
          <div className="credentials-hint">
            <small>Varsayilan: papillon_admin / Papillon2024!</small>
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
          <h1>🦋 Papillon AI Admin Panel</h1>
          <button onClick={handleLogout} className="logout-button">
            Çıkış Yap
          </button>
        </div>
        <p>Yapay zeka eğitimi ve analiz yönetimi</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
        >
          📚 Eğitim
        </button>
        <button 
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'training' && (
          <TrainingTab 
            selectedHotel={selectedHotel}
            setSelectedHotel={setSelectedHotel}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            isUploading={isUploading}
            isAnalyzing={isAnalyzing}
            message={message}
            messageType={messageType}
            pdfInfo={pdfInfo}
            hotels={hotels}
            languages={languages}
            authToken={authToken}
            handleFileChange={handleFileChange}
            analyzePDF={analyzePDF}
            handleSubmit={handleSubmit}
            handleLogout={handleLogout}
          />
        )}
        
        {activeTab === 'analytics' && (
          <AnalyticsTab authToken={authToken} />
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
