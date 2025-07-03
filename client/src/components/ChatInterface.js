import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import MapComponent from './MapComponent';
import LocationPermission from './LocationPermission';
import VoiceControls from './VoiceControls';
import './ChatInterface.css';

const API_BASE_URL = 'http://localhost:5002';
const LOCAL_SESSION_KEY = 'papillon_session_id';
const LOCAL_MESSAGES_KEY = 'papillon_messages_cache';

function formatMessage(text) {
  if (!text) return '';
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #4299e1; text-decoration: underline;">$1</a>')
    .replace(/\*{3,}/g, '**')
    .replace(/### (.*?)(\n|$)/g, '<h3 style="font-size: 1.1rem; font-weight: 700; margin: 1.2rem 0 0.6rem 0; color: #2c3e50;">$1</h3>')
    .replace(/## (.*?)(\n|$)/g, '<h2 style="font-size: 1.2rem; font-weight: 700; margin: 1.2rem 0 0.6rem 0; color: #2c3e50;">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: #1a202c;">$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em style="font-style: italic; color: #4a5568;">$1</em>')
    .replace(/^\d+\.\s+(.*?)$/gm, '<div style="margin: 0.4rem 0; padding-left: 1.2rem; display: flex; align-items: flex-start;"><span style="font-weight: 700; color: #4299e1; margin-right: 0.8rem; min-width: 1.2rem;">•</span><span>$1</span></div>')
    .replace(/^[-•]\s+(.*?)$/gm, '<div style="margin: 0.4rem 0; padding-left: 1.2rem; display: flex; align-items: flex-start;"><span style="font-weight: 700; color: #48bb78; margin-right: 0.8rem; min-width: 1.2rem;">•</span><span>$1</span></div>')
    .replace(/\n\n/g, '<div style="margin: 1rem 0;"></div>')
    .replace(/\n/g, '<br/>');
}

function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(LOCAL_SESSION_KEY) || null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [pendingLocationQuery, setPendingLocationQuery] = useState(null);
  const [showLocationRequest, setShowLocationRequest] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('tr');
  const [voiceOutput, setVoiceOutput] = useState(null);
  const messagesEndRef = useRef(null);
  const [spokenMessageIds, setSpokenMessageIds] = useState(new Set());
  const [lastInputMethod, setLastInputMethod] = useState('text');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  const isLocationQuery = (message) => {
    const lowerMessage = message.toLowerCase();
    const locationKeywords = ['nerede', 'yakın', 'mesafe', 'nasıl gidilir', 'en yakın', 'where', 'near', 'nearby', 'closest', 'nearest', 'distance', 'how to get', 'wo', 'nähe', 'nächste', 'entfernung', 'wie komme ich', 'где', 'рядом', 'ближайший', 'расстояние', 'как добраться', 'restoran', 'hastane', 'market', 'eczane', 'lunapark', 'plaj', 'restaurant', 'hospital', 'pharmacy', 'amusement', 'beach', 'park', 'krankenhaus', 'apotheke', 'strand', 'freizeitpark', 'больница', 'ресторан', 'аптека', 'пляж', 'парк'];
    return locationKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  const sendMessage = async (customLocation = null) => {
    const currentInput = inputValue.trim();
    if (!currentInput && !pendingLocationQuery) return;
    if (isLoading) return;
    setLastInputMethod('text');
    const messageToProcess = pendingLocationQuery || currentInput;
    const userMessage = { id: Date.now(), role: 'user', content: messageToProcess, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setShowLocationRequest(false);
    setPendingLocationQuery(null);
    if (isLocationQuery(messageToProcess) && !userLocation && !customLocation) {
      setPendingLocationQuery(messageToProcess);
      setShowLocationRequest(true);
      setInputValue('');
      return;
    }
    setInputValue('');
    setIsLoading(true);
    try {
      const history = messages.map(msg => ({ role: msg.role, content: msg.content }));
      const requestData = { message: messageToProcess, history: history, sessionId: sessionId || undefined };
      if (userLocation || customLocation) {
        requestData.userLocation = customLocation || userLocation;
      }
      const response = await axios.post(`${API_BASE_URL}/api/chat`, requestData);
      const assistantMessage = { id: Date.now() + 1, role: 'assistant', content: response.data.response, timestamp: new Date(), placesData: response.data.placesData, offerSupport: response.data.offerSupport };
      setMessages(prev => [...prev, assistantMessage]);
      if (response.data.sessionId && response.data.sessionId !== sessionId) {
        setSessionId(response.data.sessionId);
        localStorage.setItem(LOCAL_SESSION_KEY, response.data.sessionId);
      }
    } catch (error) {
      console.error('Chat error:', error);
      let errorContent = 'Üzgünüm, bir sorun oluştu. Lütfen tekrar deneyin.';
      
      if (error.response?.status === 503) {
        errorContent = 'AI servisi geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.';
      } else if (error.response?.data?.error) {
        errorContent = error.response.data.error;
      }
      
      const errorMessage = { id: Date.now() + 1, role: 'assistant', content: errorContent, timestamp: new Date() };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      if (customLocation) {
        setPendingLocationQuery(null);
        setShowLocationRequest(false);
      }
    }
  };

  const sendVoiceMessage = useCallback(async (voiceText) => {
    if (isLoading) return;
    setLastInputMethod('voice');
    const userMessage = { id: Date.now(), role: 'user', content: voiceText, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    try {
      const history = messages.map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', content: msg.content }));
      const requestData = { message: voiceText, history: history, session_id: sessionId };
      const response = await axios.post(`${API_BASE_URL}/api/chat`, requestData);
      if (response.data.sessionId && response.data.sessionId !== sessionId) {
        setSessionId(response.data.sessionId);
        localStorage.setItem(LOCAL_SESSION_KEY, response.data.sessionId);
      }
      const assistantMessage = { id: Date.now() + 1, role: 'assistant', content: response.data.response, timestamp: new Date(), placesData: response.data.placesData, offerSupport: response.data.offerSupport };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      let errorContent = 'Üzgünüm, bir sorun oluştu. Lütfen tekrar deneyin.';
      
      if (error.response?.status === 503) {
        errorContent = 'AI servisi geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.';
      } else if (error.response?.data?.error) {
        errorContent = error.response.data.error;
      }
      
      const errorMessage = { id: Date.now() + 1, role: 'assistant', content: errorContent, timestamp: new Date() };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, sessionId]);

  const handleVoiceInput = useCallback((transcript) => {
    if (transcript.trim()) {
      sendVoiceMessage(transcript.trim());
    }
  }, [sendVoiceMessage]);

  const handleVoiceOutput = useCallback((voiceFunctions) => {
    setVoiceOutput(voiceFunctions);
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && !isLoading && voiceOutput && !spokenMessageIds.has(lastMessage.id) && lastInputMethod === 'voice' && messages.length > 1) {
      const cleanText = lastMessage.content.replace(/<[^>]*>/g, '').trim();
      if (cleanText) {
        setSpokenMessageIds(prevSet => new Set(prevSet).add(lastMessage.id));
          setTimeout(() => {
          voiceOutput.speakText(cleanText);
        }, 300);
      }
    }
  }, [messages, isLoading, voiceOutput, spokenMessageIds, lastInputMethod]);

  const handleLocationReceived = (location) => {
    console.log('📍 Location received:', location);
    setUserLocation(location);
    setShowLocationRequest(false);
    if (pendingLocationQuery) {
      // If it's a hotel location, we want to pass it directly
      if (location.isHotelLocation) {
        console.log('📍 Using hotel location for query');
        sendMessage(location);
      } else {
        console.log('📍 Using user location for query');
      sendMessage(location);
      }
    }
  };

  const handleLocationDenied = () => {
    console.log('❌ Location access denied');
    setShowLocationRequest(false);
    // Don't send the message here - let the user choose hotel location instead
    // This prevents the infinite loop
  };

  const handleSupportResponse = async (accepted) => {
    const originalMessage = messages.find(m => m.offerSupport);
    if (!originalMessage) return;

    // Create a new messages array without the original message that had the buttons
    const updatedMessages = messages.filter(m => !m.offerSupport);

    if (accepted) {
      // Backend'den gelen otel bilgisini kullan
      const lastSupportMsg = messages.find(m => m.offerSupport);
      const hotel = lastSupportMsg && lastSupportMsg.hotel ? lastSupportMsg.hotel : "Ayscha";
      const whatsAppLink = `https://wa.me/905333044416`;

      // Open WhatsApp immediately in a new tab
      window.open(whatsAppLink, '_blank', 'noopener,noreferrer');

      const userMessage = { id: Date.now(), role: 'user', content: 'Yes, I want to connect to live support.', timestamp: new Date() };
      const systemMessageContent = `Great! I am redirecting you to live support for the ${hotel} hotel.`;
      const systemMessage = { id: Date.now() + 1, role: 'assistant', content: systemMessageContent, timestamp: new Date() };
      setMessages([...updatedMessages, userMessage, systemMessage]);
    } else {
      const userMessage = { id: Date.now(), role: 'user', content: 'No, thanks.', timestamp: new Date() };
      
      const systemMessageContent = `Understood. Is there anything else I can help you with?`;
      const systemMessage = { id: Date.now() + 1, role: 'assistant', content: systemMessageContent, timestamp: new Date() };
      setMessages([...updatedMessages, userMessage, systemMessage]);
    }
  };

  const handleHotelSelection = (selectedHotel) => {
    // Kullanıcı otel seçince yeni bir canlı destek onayı mesajı başlat
    const confirmMsg = {
      id: Date.now(),
      role: 'assistant',
      content: detectedLanguage === 'tr' ? `Canlı desteğe bağlanmak istiyor musunuz?` :
               detectedLanguage === 'en' ? `Do you want to connect to live support?` :
               detectedLanguage === 'de' ? `Möchten Sie mit dem Live-Support verbunden werden?` :
               detectedLanguage === 'ru' ? `Вы хотите подключиться к службе поддержки?` :
               `Do you want to connect to live support?`,
      offerSupport: true,
      hotel: selectedHotel,
      needHotelSelection: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, confirmMsg]);
  };

  useEffect(() => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      const content = lastUserMessage.content.toLowerCase();
      if (/\b(hello|hi|thank|please|where|what|how)\b/.test(content)) {
        setDetectedLanguage('en');
      } else if (/\b(hallo|danke|bitte|wo|was|wie)\b/.test(content)) {
        setDetectedLanguage('de');
      } else if (/\b(привет|спасибо|где|что|как)\b/.test(content)) {
        setDetectedLanguage('ru');
      } else {
        setDetectedLanguage('tr');
      }
    }
  }, [messages.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chat-header" style={{ flexShrink: 0, padding: '10px', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <span className="butterfly-logo" style={{ fontSize: '24px' }} dangerouslySetInnerHTML={{ __html: '&#x1F98B;' }} />
          <h1 style={{ margin: 0, fontSize: '1.2em' }}>PapillonAI</h1>
        </div>
      </div>
      <div className="chat-messages" style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem' }}>
        {/* Static, visual-only greeting message */}
        <div className="message assistant">
          Merhaba!
        </div>

        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.role === 'assistant' ? (
              <>
                <div dangerouslySetInnerHTML={{ __html: formatMessage((message.content || '').replace('[DESTEK_TALEBI]', '')) }} />
                {message.placesData && <MapComponent placesData={message.placesData} />}
                {message.offerSupport && message.needHotelSelection === true && (
                  <div className="support-actions">
                    <button onClick={() => handleHotelSelection('Belvil')} className="support-button support-button-yes">Belvil</button>
                    <button onClick={() => handleHotelSelection('Zeugma')} className="support-button support-button-yes">Zeugma</button>
                    <button onClick={() => handleHotelSelection('Ayscha')} className="support-button support-button-yes">Ayscha</button>
                  </div>
                )}
                {message.offerSupport && message.needHotelSelection === false && (
                  <div className="support-actions">
                    <button onClick={() => handleSupportResponse(true)} className="support-button support-button-yes">&#x2713;</button>
                    <button onClick={() => handleSupportResponse(false)} className="support-button support-button-no">&#x2717;</button>
                  </div>
                )}
              </>
            ) : (
              message.content
            )}
          </div>
        ))}
        {isLoading && <div className="message assistant loading">Yazıyor...</div>}
        {showLocationRequest && (
          <div className="message assistant">
            <LocationPermission onLocationReceived={handleLocationReceived} onLocationDenied={handleLocationDenied} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div 
        className="chat-input-container"
      >
        <form
          className="chat-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
        <VoiceControls
          onVoiceInput={handleVoiceInput}
          onVoiceOutput={handleVoiceOutput}
            language={detectedLanguage}
            isSpeaking={voiceOutput?.isSpeaking}
          isLoading={isLoading}
        />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Chat..."
          disabled={isLoading}
        />
          <button type="submit" className="send-button" disabled={isLoading || !inputValue.trim()}>
          ➤
        </button>
        </form>
      </div>
    </div>
  );
}

export default ChatInterface; 
