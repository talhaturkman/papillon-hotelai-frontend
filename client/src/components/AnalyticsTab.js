import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// API Base URL for backend communication
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

function AnalyticsTab({ authToken }) {
  const [loading, setLoading] = useState(false);
  const [questionsData, setQuestionsData] = useState([]);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (autoRefreshEnabled) {
      const interval = setInterval(() => {
        console.log('🔄 Auto-refreshing analytics...');
        loadAnalytics(false); // Don't force refresh, let backend decide
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefreshEnabled]);

  // Load analytics data on component mount
  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');

    try {
      const url = forceRefresh 
        ? `${API_BASE_URL}/api/admin/analytics/top-questions?force=true` 
        : `${API_BASE_URL}/api/admin/analytics/top-questions`;
        
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.data.success) {
        setQuestionsData(response.data.questions || []);
        setLastUpdated(response.data.lastUpdated || new Date().toISOString());
        console.log(`✅ Analytics loaded: ${response.data.questions?.length || 0} questions ${response.data.fromCache ? '(cached)' : '(fresh)'}`);
      } else {
        setError('Analiz verileri alınamadı');
      }
    } catch (error) {
      console.error('Analytics error:', error);
      setError('Analiz verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadAnalytics();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadAnalytics]);

  const handleForceRefresh = () => {
    console.log('🔥 Force refresh triggered');
    loadAnalytics(true);
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
    console.log(`🔄 Auto-refresh ${!autoRefreshEnabled ? 'enabled' : 'disabled'}`);
  };

  const clearCache = async () => {
    setLoading(true);
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/admin/analytics/clear-cache`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.data.success) {
        console.log('🧹 Cache cleared successfully');
        // Immediately load fresh analytics after clearing cache
        await loadAnalytics(true);
      } else {
        setError('Cache temizlenirken hata oluştu');
      }
    } catch (error) {
      console.error('Cache clear error:', error);
      setError('Cache temizlenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analytics-tab">
      <div className="tab-header">
        <h2>📊 Sohbet Analizi</h2>
        <p>Misafir etkileşimlerinden elde edilen veriler</p>
        
        <div className="analytics-controls">
          <div className="controls-left">
            <button
              onClick={handleForceRefresh}
              disabled={loading}
              className="refresh-button"
            >
              {loading ? '🔄 Yükleniyor...' : '🔥 Zorla Yenile'}
            </button>
            
            <button
              onClick={clearCache}
              disabled={loading}
              className="clear-cache-button"
            >
              {loading ? '🔄 Temizleniyor...' : '🧹 Cache Temizle'}
            </button>
            
            <button
              onClick={toggleAutoRefresh}
              className={`auto-refresh-button ${autoRefreshEnabled ? 'enabled' : 'disabled'}`}
            >
              {autoRefreshEnabled ? '⏸️ Otomatik Güncellemeyi Durdur' : '▶️ Otomatik Güncelleme'}
            </button>
          </div>
          
          <div className="controls-right">
            {lastUpdated && (
              <span className="last-updated">
                Son güncelleme: {new Date(lastUpdated).toLocaleTimeString('tr-TR')}
              </span>
            )}
            
            {autoRefreshEnabled && (
              <span className="auto-refresh-status">
                🔄 Otomatik güncelleme aktif (30s)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="analytics-content">
        {/* Top Questions Section */}
        <div className="analytics-section">
          <h3>🔥 En Çok Sorulan Sorular (Top 5)</h3>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {loading ? (
            <div className="loading-placeholder">
              <div className="loading-spinner"></div>
              <p>Sorular analiz ediliyor...</p>
            </div>
          ) : (
            <div className="questions-list">
              {questionsData.length > 0 ? (
                questionsData.map((item, index) => (
                  <div key={index} className="question-item">
                    <div className="question-rank">#{index + 1}</div>
                    <div className="question-content">
                      <div className="question-text">{item.question}</div>
                      <div className="question-stats">
                        <span className="question-count">
                          🔢 {item.count} kez soruldu
                        </span>
                        <span className="question-percentage">
                          📊 Toplam soruların %{item.percentage}
                        </span>
                        {item.hotels && item.hotels.length > 0 && (
                          <span className="question-hotels">
                            🏨 {item.hotels.join(', ')}
                          </span>
                        )}
                        {item.languages && item.languages.length > 0 && (
                          <span className="question-languages">
                            🌐 {item.languages.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                !loading && (
                  <div className="no-data">
                    <p>📭 Henüz analiz edilecek soru bulunamadı</p>
                    <small>Misafirler sorular sordukça burada görünecek</small>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Coming Soon Sections */}
        <div className="analytics-section coming-soon">
          <h3>🚀 Yakında Gelecek Özellikler</h3>
          <div className="coming-soon-grid">
            <div className="feature-card">
              <h4>📈 Soru Trendleri</h4>
              <p>Zaman içinde soruların değişimi</p>
            </div>
            <div className="feature-card">
              <h4>🏨 Otel Bazlı İstatistikler</h4>
              <p>Her otelin en çok sorulan soruları</p>
            </div>
            <div className="feature-card">
              <h4>🌍 Dil Analizi</h4>
              <p>Hangi dilde ne tür sorular soruluyor</p>
            </div>
            <div className="feature-card">
              <h4>📍 Konum Analizleri</h4>
              <p>En çok aranan yerler ve destinasyonlar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsTab; 