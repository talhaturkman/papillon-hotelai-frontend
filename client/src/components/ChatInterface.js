import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import MapComponent from './MapComponent';
import LocationPermission from './LocationPermission';
import VoiceControls from './VoiceControls';

// Add this constant at the top after imports
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

// Persist conversation session across page reloads
const LOCAL_SESSION_KEY = 'papillon_session_id';
const LOCAL_MESSAGES_KEY = 'papillon_messages_cache';

// Format AI response with enhanced markdown support
function formatMessage(text) {
  return text
    // Clean up multiple asterisks first
    .replace(/\*{3,}/g, '**')
    
    // Headers
    .replace(/### (.*?)(\n|$)/g, '<h3 style="font-size: 1.1rem; font-weight: 700; margin: 1.2rem 0 0.6rem 0; color: #2c3e50;">$1</h3>')
    .replace(/## (.*?)(\n|$)/g, '<h2 style="font-size: 1.2rem; font-weight: 700; margin: 1.2rem 0 0.6rem 0; color: #2c3e50;">$1</h2>')
    
    // Bold text (handle multiple formats)
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: #1a202c;">$1</strong>')
    
    // Italic text (avoid conflicts with bold)
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em style="font-style: italic; color: #4a5568;">$1</em>')
    
    // Numbered lists with better styling
    .replace(/^\d+\.\s+(.*?)$/gm, '<div style="margin: 0.4rem 0; padding-left: 1.2rem; display: flex; align-items: flex-start;"><span style="font-weight: 700; color: #4299e1; margin-right: 0.8rem; min-width: 1.2rem;">•</span><span>$1</span></div>')
    
    // Bullet lists with better styling  
    .replace(/^[-•]\s+(.*?)$/gm, '<div style="margin: 0.4rem 0; padding-left: 1.2rem; display: flex; align-items: flex-start;"><span style="font-weight: 700; color: #48bb78; margin-right: 0.8rem; min-width: 1.2rem;">•</span><span>$1</span></div>')
    
    // Double line breaks become paragraph breaks
    .replace(/\n\n/g, '<div style="margin: 1rem 0;"></div>')
    
    // Single line breaks
    .replace(/\n/g, '<br/>');
}

function ChatInterface() {
  // Load cached messages if any
  const cachedMessages = (() => {
    try {
      const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
      if (raw) {
        return JSON.parse(raw).map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {}
    return [{
      id: 1,
      role: 'assistant',
      content: 'Merhaba!',
      timestamp: new Date()
    }];
  })();

  const [messages, setMessages] = useState(cachedMessages);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(LOCAL_SESSION_KEY) || null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [pendingLocationQuery, setPendingLocationQuery] = useState(null);
  const [showLocationRequest, setShowLocationRequest] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('tr');
  const [voiceOutput, setVoiceOutput] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Cache messages locally for persistence
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages));
  }, [messages]);

  // Check if message is location-based (synced with backend logic)
  const isLocationQuery = (message) => {
    const lowerMessage = message.toLowerCase();
    console.log(`🔍 Frontend: Quick location check: "${message}"`);
    
    // Simplified frontend detection - just look for obvious location keywords
    // Real AI-powered detection happens on backend
    const locationKeywords = [
      // Obvious location words
      'nerede', 'yakın', 'mesafe', 'nasıl gidilir', 'en yakın',
      'where', 'near', 'nearby', 'closest', 'nearest', 'distance', 'how to get',
      'wo', 'nähe', 'nächste', 'entfernung', 'wie komme ich',
      'где', 'рядом', 'ближайший', 'расстояние', 'как добраться',
      // Place-related words
      'restoran', 'hastane', 'market', 'eczane', 'lunapark', 'plaj',
      'restaurant', 'hospital', 'pharmacy', 'amusement', 'beach', 'park',
      'krankenhaus', 'apotheke', 'strand', 'freizeitpark',
      'больница', 'ресторан', 'аптека', 'пляж', 'парк'
    ];
    
    const hasLocationKeyword = locationKeywords.some(keyword => lowerMessage.includes(keyword));
    
    console.log(`🎯 Frontend simple result: "${message}" → ${hasLocationKeyword}`);
    
    // Frontend just does basic detection - backend AI will make final decision
    return hasLocationKeyword;
  };

  const sendMessage = async (customLocation = null) => {
    const currentInput = inputValue.trim();
    if (!currentInput && !pendingLocationQuery) return;
    if (isLoading) return;

    // Determine which message to use
    const messageToProcess = pendingLocationQuery || currentInput;
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageToProcess,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Clear any previous location request
    setShowLocationRequest(false);
    setPendingLocationQuery(null);
    
    // Check if this is a location query and if we need user location
    if (isLocationQuery(messageToProcess) && !userLocation && !customLocation) {
      console.log('🗺️ Location query detected, requesting user permission...');
      setPendingLocationQuery(messageToProcess);
      setShowLocationRequest(true);
      setInputValue('');
      return;
    }

    setInputValue('');
    setIsLoading(true);

    try {
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const requestData = {
        message: messageToProcess,
        chatHistory: chatHistory,
        sessionId: sessionId || undefined
      };

      // Add user location if available
      if (userLocation || customLocation) {
        requestData.userLocation = customLocation || userLocation;
        console.log('📍 Sending user location with request:', requestData.userLocation);
      }

      const response = await axios.post(`${API_BASE_URL}/api/chat/message`, requestData);

      console.log('📨 API Response:', response.data);
      console.log('🗺️ Places data in response:', response.data.placesData);
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
        placesData: response.data.placesData
      };

      console.log('💬 Assistant message with places:', assistantMessage);
      console.log('🔍 Will show map?', !!assistantMessage.placesData?.isLocationQuery);
      setMessages(prev => [...prev, assistantMessage]);

      // Persist sessionId if new
      if (response.data.sessionId && response.data.sessionId !== sessionId) {
        setSessionId(response.data.sessionId);
        localStorage.setItem(LOCAL_SESSION_KEY, response.data.sessionId);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen tekrar deneyin.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Clear pending query if it was processed
      if (customLocation) {
        setPendingLocationQuery(null);
        setShowLocationRequest(false);
      }
    }
  };

  // Handle location permission granted
  const handleLocationReceived = (location) => {
    console.log('✅ Location permission granted:', location);
    setUserLocation(location);
    setShowLocationRequest(false);
    
    // Process the pending query with user location
    if (pendingLocationQuery) {
      sendMessage(location);
    }
  };

  // Handle location permission denied
  const handleLocationDenied = (reason) => {
    console.log('❌ Location permission denied:', reason);
    setShowLocationRequest(false);
    
    // Process the pending query without location (fallback to hotel location)
    if (pendingLocationQuery) {
      sendMessage();
    }
  };

  // Handle voice input
  const handleVoiceInput = (transcript) => {
    console.log('🎤 Voice input received:', transcript);
    setInputValue(transcript);
    
    // Send the voice message directly with transcript
    if (transcript && transcript.trim()) {
      console.log('🚀 Sending voice message:', transcript);
      sendVoiceMessage(transcript);
    }
  };

  const sendVoiceMessage = async (voiceText) => {
    if (isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: voiceText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue(''); // Clear input after sending
    setIsLoading(true);

    try {
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const requestData = {
        message: voiceText,
        chatHistory: chatHistory,
        sessionId: sessionId || undefined
      };

      // Add user location if available
      if (userLocation) {
        requestData.userLocation = userLocation;
        console.log('📍 Sending user location with voice request:', requestData.userLocation);
      }

      const response = await axios.post(`${API_BASE_URL}/api/chat/message`, requestData);

      console.log('📨 Voice API Response:', response.data);
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
        placesData: response.data.placesData
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Persist sessionId if new
      if (response.data.sessionId && response.data.sessionId !== sessionId) {
        setSessionId(response.data.sessionId);
        localStorage.setItem(LOCAL_SESSION_KEY, response.data.sessionId);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen tekrar deneyin.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle voice output
  const handleVoiceOutput = useCallback((voiceFunctions) => {
    setVoiceOutput(voiceFunctions);
  }, []);

  // Auto-speak AI responses (disabled to prevent conflicts)
  /*
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && voiceOutput && !isLoading) {
      // Extract plain text from formatted HTML
      const plainText = lastMessage.content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace HTML entities
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Only speak if text is not empty and not too long
      // Also check if user has interacted with TTS before (to respect browser policies)
      if (plainText && plainText.length < 500) {
        // Don't auto-speak on page load, only after user has used voice features
        if (messages.length > 2) { // More than just initial greeting
          setTimeout(() => {
            try {
              voiceOutput.speakText(plainText);
            } catch (error) {
              console.log('🔊 Auto-TTS failed (expected on first load):', error.message);
            }
          }, 800); // Longer delay to ensure message is rendered
        }
      }
    }
  }, [messages.length, voiceOutput?.speakText, isLoading]); // Only depend on message count and specific function
  */

  // Detect language from messages
  useEffect(() => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      // Simple language detection based on keywords
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
  }, [messages.length]); // Only depend on message count, not entire messages array

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <span className="butterfly-logo">🦋</span>
        <h1>PapillonAI</h1>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.role === 'assistant' ? (
              <>
                <div dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
                {message.placesData && (
                  <MapComponent placesData={message.placesData} />
                )}
              </>
            ) : (
              message.content
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="message assistant loading">
            Yazıyor...
          </div>
        )}

        {showLocationRequest && (
          <div className="message assistant">
            <LocationPermission
              onLocationReceived={handleLocationReceived}
              onLocationDenied={handleLocationDenied}
            />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <VoiceControls
          onVoiceInput={handleVoiceInput}
          onVoiceOutput={handleVoiceOutput}
          isLoading={isLoading}
          language={detectedLanguage}
          lastAssistantMessage={messages.length > 0 ? messages.filter(m => m.role === 'assistant').pop()?.content || '' : ''}
        />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Chat..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !inputValue.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}

export default ChatInterface; 