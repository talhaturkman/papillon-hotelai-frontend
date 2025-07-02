import React, { useState } from 'react';
import TrainingTab from './TrainingTab';
import AnalyticsTab from './AnalyticsTab';
import AdminPanelLogin from './AdminPanelLogin';

function AdminPanel() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [activeTab, setActiveTab] = useState('training');

  const handleLoginSuccess = (newToken) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    console.log("Authentication error detected. Logging out.");
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  if (!token) {
    return <AdminPanelLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', backgroundColor: 'white', color: '#333', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '1rem 2rem', 
        backgroundColor: 'white', 
        borderBottom: '1px solid #ddd',
        flexShrink: 0
      }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 600 }}>🦋 Papillon AI Panel</h1>
        <button onClick={handleLogout} style={{
          padding: '0.5rem 1rem',
          border: 'none',
          borderRadius: '6px',
          backgroundColor: '#e53e3e',
          color: 'white',
          cursor: 'pointer',
          fontWeight: 500
        }}>
          Çıkış Yap
        </button>
      </header>
      
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ padding: '0 2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', flexShrink: 0 }}>
            <button 
              onClick={() => setActiveTab('training')}
              style={{
                padding: '1rem',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeTab === 'training' ? 600 : 400,
                borderBottom: activeTab === 'training' ? '3px solid #3182ce' : '3px solid transparent',
                color: activeTab === 'training' ? '#3182ce' : '#555',
                marginBottom: '-1px'
              }}
            >
              AI Training
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              style={{
                padding: '1rem',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeTab === 'analytics' ? 600 : 400,
                borderBottom: activeTab === 'analytics' ? '3px solid #3182ce' : '3px solid transparent',
                color: activeTab === 'analytics' ? '#3182ce' : '#555',
                marginBottom: '-1px'
              }}
            >
              Analytics
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
            {activeTab === 'training' ? (
              <TrainingTab token={token} onAuthError={handleLogout} />
            ) : (
              <AnalyticsTab token={token} onAuthError={handleLogout} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminPanel;
