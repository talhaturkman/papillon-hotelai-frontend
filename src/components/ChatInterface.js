import React, { useEffect, useState } from 'react';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [detectedLanguage, setDetectedLanguage] = useState('tr');

  useEffect(() => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      const content = lastUserMessage.content.toLowerCase();
      if (content.includes('english')) {
        setDetectedLanguage('en');
      } else if (content.includes('turkish')) {
        setDetectedLanguage('tr');
      } else {
        setDetectedLanguage('tr');
      }
    }
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Rest of the component code */}
    </div>
  );
};

export default ChatInterface; 