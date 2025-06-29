import React, { useState, useEffect, useRef, useCallback } from 'react';

// API Base URL for backend communication
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

// Language mapping for speech recognition (static)
const LANGUAGE_MAP = {
  'tr': 'tr-TR',
  'en': 'en-US', 
  'de': 'de-DE',
  'ru': 'ru-RU'
};

// Language mapping for ElevenLabs TTS
const TTS_LANGUAGE_MAP = {
  'tr-TR': 'tr',
  'en-US': 'en',
  'de-DE': 'de', 
  'ru-RU': 'ru',
  'tr': 'tr',
  'en': 'en',
  'de': 'de',
  'ru': 'ru'
};

const VoiceControls = ({ onVoiceInput, onVoiceOutput, isLoading, language = 'tr-TR', lastAssistantMessage = '' }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Check if Speech API is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      // Initialize Speech Recognition
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = LANGUAGE_MAP[language] || language;
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        console.log('🎤 Voice recognition started');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        console.log('🎤 Voice recognition ended');
      };

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎤 Voice input:', transcript);
        onVoiceInput(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('🎤 Voice recognition error:', event.error);
        setIsListening(false);
      };

      // Initialize Audio element for ElevenLabs TTS
      audioRef.current = new Audio();
      audioRef.current.onended = () => {
        setIsPlaying(false);
        console.log('✅ ElevenLabs TTS playback ended');
      };
      audioRef.current.onerror = (error) => {
        setIsPlaying(false);
        setTtsLoading(false);
        console.error('❌ ElevenLabs audio playback error:', error);
      };
    }
  }, []); // Empty dependency array to run only once

  // Update language when it changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANGUAGE_MAP[language] || language;
    }
  }, [language]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // ElevenLabs TTS speak function
  const speakText = useCallback(async (text) => {
    if (!text || ttsLoading || isPlaying) return;

    try {
      setTtsLoading(true);
      console.log('🎙️ ElevenLabs TTS Request:', text.substring(0, 50) + '...');

      // Map language for ElevenLabs
      const ttsLanguage = TTS_LANGUAGE_MAP[language] || 'tr';
      
      const response = await fetch(`${API_BASE_URL}/api/chat/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          language: ttsLanguage,
          gender: 'female'
        })
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      // Get audio blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play audio
      audioRef.current.src = audioUrl;
      audioRef.current.onloadeddata = () => {
        setTtsLoading(false);
        setIsPlaying(true);
        audioRef.current.play();
        console.log('✅ ElevenLabs TTS playback started');
      };

      // Clean up URL after playback
      audioRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        console.log('✅ ElevenLabs TTS playback completed');
      };

    } catch (error) {
      console.error('❌ ElevenLabs TTS Error:', error);
      setTtsLoading(false);
      setIsPlaying(false);
      
      // IMPROVED Fallback to browser TTS with better settings
      console.log('📢 Using improved browser TTS...');
      try {
        // Stop any current speech first
        window.speechSynthesis.cancel();
        
        // Wait for voices to load
        const waitForVoices = () => {
          return new Promise((resolve) => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              resolve(voices);
            } else {
              window.speechSynthesis.onvoiceschanged = () => {
                resolve(window.speechSynthesis.getVoices());
              };
            }
          });
        };

        const voices = await waitForVoices();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set language
        utterance.lang = LANGUAGE_MAP[language] || 'tr-TR';
        
        // Find the best voice for the language
        const languageCode = LANGUAGE_MAP[language] || 'tr-TR';
        let bestVoice = voices.find(voice => 
          voice.lang === languageCode && voice.name.includes('Female')
        );
        
        if (!bestVoice) {
          bestVoice = voices.find(voice => 
            voice.lang.startsWith(languageCode.split('-')[0])
          );
        }
        
        if (!bestVoice) {
          bestVoice = voices.find(voice => 
            voice.lang.includes(languageCode.split('-')[0])
          );
        }
        
        if (bestVoice) {
          utterance.voice = bestVoice;
          console.log('🔊 Using improved voice:', bestVoice.name, bestVoice.lang);
        }

        // IMPROVED voice settings for better quality
        utterance.rate = 0.85;  // Slower for clarity
        utterance.pitch = 1.1;  // Slightly higher pitch
        utterance.volume = 0.9; // Full volume
        
        utterance.onstart = () => {
          setIsPlaying(true);
          console.log('✅ Improved Browser TTS started');
        };
        
        utterance.onend = () => {
          setIsPlaying(false);
          console.log('✅ Improved Browser TTS ended');
        };
        
        utterance.onerror = (error) => {
          setIsPlaying(false);
          console.error('❌ Browser TTS error:', error);
        };
        
        window.speechSynthesis.speak(utterance);
        
      } catch (fallbackError) {
        console.error('❌ Browser TTS fallback failed:', fallbackError);
        setIsPlaying(false);
      }
    }
  }, [language, ttsLoading, isPlaying]);

  // Stop speaking function
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setTtsLoading(false);
      console.log('🔇 TTS stopped');
    }
    
    // Also stop browser TTS if running
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Expose speakText function to parent (stabilized)
  useEffect(() => {
    if (onVoiceOutput) {
      onVoiceOutput({ speakText, stopSpeaking, isPlaying: isPlaying || ttsLoading });
    }
  }, [onVoiceOutput, speakText, stopSpeaking, isPlaying, ttsLoading]);

  if (!isSupported) {
    return (
      <div className="voice-controls-unsupported">
        <span>🎤 Ses özelliği bu tarayıcıda desteklenmiyor</span>
      </div>
    );
  }

  return (
    <div className="voice-controls">
      {/* Voice Input Button */}
      <button
        className={`voice-input-btn ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopListening : startListening}
        disabled={isLoading}
        title={isListening ? 'Dinlemeyi durdur' : 'Konuşmaya başla'}
      >
        {isListening ? (
          <span className="listening-animation">
            🎤 <span className="pulse">●</span>
          </span>
        ) : (
          '🎤'
        )}
      </button>

      {/* Voice Output Button */}
      <button
        className={`voice-output-btn ${isPlaying || ttsLoading ? 'playing' : ''}`}
        onClick={(isPlaying || ttsLoading) ? stopSpeaking : () => {
          if (lastAssistantMessage && lastAssistantMessage.trim()) {
            // Clean HTML tags and format the message for TTS
            const cleanText = lastAssistantMessage
              .replace(/<[^>]*>/g, '') // Remove HTML tags
              .replace(/&nbsp;/g, ' ') // Replace HTML entities
              .replace(/\s+/g, ' ') // Normalize whitespace
              .replace(/\n+/g, ' ') // Replace line breaks with spaces
              .trim();
            
            if (cleanText) {
              console.log('🔊 Speaking last message with ElevenLabs:', cleanText.substring(0, 100) + '...');
              speakText(cleanText);
            } else {
              speakText('Son mesaj bulunamadı.');
            }
          } else {
            speakText('Henüz bir AI yanıtı yok.');
          }
        }}
        disabled={ttsLoading}
        title={
          ttsLoading ? 'Ses hazırlanıyor...' :
          isPlaying ? 'Konuşmayı durdur' : 
          'Son AI yanıtını seslendir (ElevenLabs)'
        }
      >
        {ttsLoading ? '⏳' : (isPlaying ? '🔇' : '🔊')}
      </button>

      {/* Simple Test Button */}
      <button
        className="voice-test-btn"
        onClick={() => speakText('Test. ElevenLabs ses sistemi çalışıyor.')}
        disabled={isPlaying || ttsLoading}
        title="ElevenLabs ses testi"
        style={{
          background: '#28a745',
          color: 'white',
          border: 'none',
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          fontSize: '12px',
          marginLeft: '5px'
        }}
      >
        {ttsLoading ? '⏳' : '▶'}
      </button>

      {/* Status Indicator */}
      {isListening && (
        <div className="voice-status">
          <span className="listening-text">Dinliyorum... 🎤</span>
        </div>
      )}
      
      {ttsLoading && (
        <div className="voice-status">
          <span className="tts-loading-text">ElevenLabs TTS hazırlanıyor... ⏳</span>
        </div>
      )}
    </div>
  );
};

export default VoiceControls; 