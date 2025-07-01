import React, { useState, useEffect, useRef, useCallback } from 'react';
const API_BASE_URL = 'http://localhost:5002';
const LANGUAGE_MAP = { 'tr': 'tr-TR', 'en': 'en-US', 'de': 'de-DE', 'ru': 'ru-RU' };
const VoiceControls = ({ onVoiceInput, onVoiceOutput, isLoading, language = 'tr' }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const ttsAudioQueue = useRef([]);
  const speakText = useCallback(async (text) => {
    ttsAudioQueue.current.push(text);
    if (isSpeakingRef.current) return;
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    while (ttsAudioQueue.current.length > 0) {
      const currentText = ttsAudioQueue.current.shift();
      try {
        const ttsLanguage = LANGUAGE_MAP[language]?.split('-')[0] || 'tr';
        const response = await fetch(`${API_BASE_URL}/api/chat/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: currentText, language: ttsLanguage }),
        });
        if (!response.ok) throw new Error('TTS API failed');
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        await new Promise((resolve, reject) => {
          audioRef.current.src = audioUrl;
          audioRef.current.onloadeddata = () => audioRef.current.play();
          audioRef.current.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
          audioRef.current.onerror = () => { URL.revokeObjectURL(audioUrl); reject(new Error('Audio playback error')); };
        });
      } catch (error) { console.error('TTS Error:', error); break; }
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [language]);
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    ttsAudioQueue.current = [];
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);
  useEffect(() => {
    onVoiceOutput({ speakText, stopSpeaking });
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event) => onVoiceInput(event.results[0][0].transcript);
      recognition.onerror = (event) => console.error('Speech Recognition Error:', event.error);
    } else { setIsSupported(false); }
    audioRef.current = new Audio();
  }, [onVoiceInput, onVoiceOutput, speakText, stopSpeaking]);
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANGUAGE_MAP[language] || 'tr-TR';
    }
  }, [language]);
  const handleMicClick = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else if (isListening) {
      recognitionRef.current?.stop();
    } else if (!isLoading) {
      recognitionRef.current?.start();
    }
  };
  if (!isSupported) { return null; }
  const getButtonState = () => {
    if (isLoading) return 'loading';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    return 'idle';
  };
  const buttonState = getButtonState();
  return (
    <button type="button" onClick={handleMicClick} className={`voice-btn-main state-${buttonState}`} disabled={isLoading}>
      <div className="voice-btn-icon-wrapper">
        {buttonState === 'idle' && <span dangerouslySetInnerHTML={{ __html: '&#x1F3A4;' }} />}
        {buttonState === 'listening' && <div className="pulse-animation"></div>}
        {buttonState === 'speaking' && <span dangerouslySetInnerHTML={{ __html: '&#x1F50A;' }} />}
        {buttonState === 'loading' && '...'}
      </div>
    </button>
  );
};
export default VoiceControls;
