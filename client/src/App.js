import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import ChatInterface from './components/ChatInterface';
import AdminPanel from './components/AdminPanel';
import Navigation from './components/Navigation';
import LocationPermission from './components/LocationPermission';
import './App.css';

// A simple, clean theme for our app
const theme = createTheme({
  palette: {
    primary: {
      main: '#000000',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* MUI's CSS reset for consistency */}
      <Router>
        <MainContent />
      </Router>
    </ThemeProvider>
  );
}

function MainContent() {
  const location = useLocation();
  const isAdminView = location.pathname.startsWith('/admin');

  return (
    <div className={`app-container ${isAdminView ? 'admin-view' : ''}`}>
      <Routes>
        <Route path="/chat" element={<div className="chat-container"><ChatInterface /></div>} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/location" element={<LocationPermission />} />
        <Route path="/" element={<div className="chat-container"><ChatInterface /></div>} />
      </Routes>
    </div>
  );
}

export default App; 