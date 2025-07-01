import React, { useState } from 'react';
import axios from 'axios';
import TrainingTab from './TrainingTab';
import AnalyticsTab from './AnalyticsTab';
import AdminPanelLogin from './AdminPanelLogin';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('adminToken'));
  const [authToken, setAuthToken] = useState(localStorage.getItem('adminToken') || '');
  const [activeTab, setActiveTab] = useState('training');

  const [selectedHotel, setSelectedHotel] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedKind, setSelectedKind] = useState('general');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const hotels = [
    { value: 'Belvil', label: 'Belvil' },
    { value: 'Zeugma', label: 'Zeugma' },
    { value: 'Ayscha', label: 'Ayscha' }
  ];

  const languages = [
    { value: 'tr', label: 'Türkçe' },
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'ru', label: 'Русский' }
  ];

  const kinds = [
    { value: 'general', label: 'Genel Bilgiler' },
    { value: 'daily', label: 'Günlük Bilgiler' },
    { value: 'spa', label: 'SPA Kataloğu' }
  ];

  const handleLoginSuccess = (token) => {
    localStorage.setItem('adminToken', token);
    setAuthToken(token);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAuthToken('');
    setIsLoggedIn(false);
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHotel || !selectedLanguage || !selectedKind || !selectedFile) {
      setMessage('Lütfen tüm alanları doldurun.');
      setMessageType('error');
      return;
    }

    setIsUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('hotel', selectedHotel);
    formData.append('language', selectedLanguage);
    formData.append('kind', selectedKind);
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/knowledge/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.data.success) {
        setMessage('Eğitim başarılı!');
        setMessageType('success');
        setSelectedFile(null);
      } else {
        setMessage(response.data.message || 'Eğitim sırasında bir hata oluştu.');
        setMessageType('error');
      }
    } catch (error) {
      if (error.response?.status === 401) handleLogout();
      setMessage(error.response?.data?.message || 'Eğitim sırasında bir hata oluştu.');
      setMessageType('error');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isLoggedIn) {
    return <AdminPanelLogin onLoginSuccess={handleLoginSuccess} />;
  }
  
  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div className="logo">
          <span className="butterfly-logo">&#x1F98B;</span>
          <h1>Papillon AI Admin Panel</h1>
        </div>
        <p className="subtitle">Yapay zeka eğitimi ve analiz yönetimi</p>
        <button onClick={handleLogout} className="logout-button">Çıkış Yap</button>
      </header>
      <div className="tabs">
        <button className={`tab-button ${activeTab === 'training' ? 'active' : ''}`} onClick={() => setActiveTab('training')}>Eğitim</button>
        <button className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</button>
      </div>
      <main className="admin-content">
        {activeTab === 'training' ? (
          <TrainingTab
            selectedHotel={selectedHotel}
            setSelectedHotel={setSelectedHotel}
            hotels={hotels}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            languages={languages}
            selectedKind={selectedKind}
            setSelectedKind={setSelectedKind}
            kinds={kinds}
            selectedFile={selectedFile}
            handleFileChange={handleFileChange}
            handleSubmit={handleSubmit}
            isUploading={isUploading}
            message={message}
            messageType={messageType}
          />
        ) : (
          <AnalyticsTab authToken={authToken} />
        )}
      </main>
    </div>
  );
}

export default AdminPanel;
