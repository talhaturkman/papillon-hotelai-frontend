import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, CircularProgress, Typography, Box, Grid, Paper } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CachedIcon from '@mui/icons-material/Cached';
import StopIcon from '@mui/icons-material/Stop';
import './AnalyticsTab.css';

const AnalyticsTab = () => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchQuestions = async (force = false) => {
        try {
    setLoading(true);
            setError(null);
            const response = await axios.get(`/api/analytics/top-questions${force ? '?force=true' : ''}`);
      if (response.data.success) {
                setQuestions(response.data.questions);
                setLastUpdate(response.data.lastUpdated);
      } else {
                throw new Error(response.data.error || 'Failed to fetch questions');
      }
    } catch (error) {
            setError(error.message);
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
        fetchQuestions();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    // Ensure we split into exactly 5 questions per column
    const leftColumnQuestions = questions.slice(0, 5);
    const rightColumnQuestions = questions.slice(5, 10);

  return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ 
                mb: 1.5, 
                display: 'flex', 
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Typography variant="h6" sx={{ fontSize: '1.2rem', fontWeight: 500 }}>
                    En Çok Sorulan Sorular (Top {questions.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<RefreshIcon />}
                        onClick={() => fetchQuestions(true)}
                        sx={{ py: 0.5, px: 2 }}
                    >
                        ZORLA YENİLE
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        startIcon={<CachedIcon />}
                        onClick={() => fetchQuestions()}
                        sx={{ py: 0.5, px: 2 }}
                    >
                        CACHE TEMİZLE
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<StopIcon />}
                        sx={{ py: 0.5, px: 2 }}
                    >
                        OTOMATİK DURDUR
                    </Button>
                </Box>
            </Box>
            {lastUpdate && (
                <Typography variant="caption" color="textSecondary" sx={{ mb: 1.5, display: 'block', fontSize: '0.8rem' }}>
                    Son güncelleme: {lastUpdate}
                </Typography>
            )}

            <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                    {leftColumnQuestions.map((question, index) => (
                        <Paper
                            key={index}
                            elevation={1}
                            sx={{
                                p: 1.5,
                                mb: 1,
                                '&:hover': {
                                    boxShadow: 2
                                }
                            }}
                        >
                            <Typography variant="subtitle1" sx={{ mb: 0.75, fontWeight: 500, fontSize: '1rem', lineHeight: 1.3 }}>
                                {question.question}
                            </Typography>
                            <Box sx={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: 0.75,
                                '& > span': {
                                    fontSize: '0.85rem',
                                    color: 'text.secondary',
                                    display: 'flex',
                                    alignItems: 'center',
                                    '&:not(:last-child):after': {
                                        content: '"•"',
                                        mx: 0.75
                                    }
                                }
                            }}>
                                <span>Soru sayısı: {question.count} ({question.percentage}%)</span>
                                <span>Kategori: {question.category}</span>
                                {question.facility && <span>İlgili Alan: {question.facility}</span>}
                                {question.hotels?.length > 0 && <span>Otel: {question.hotels.join(', ')}</span>}
                                <span>Diller: {question.languages.join(', ')}</span>
                            </Box>
                        </Paper>
                    ))}
                </Grid>
                <Grid item xs={12} md={6}>
                    {rightColumnQuestions.map((question, index) => (
                        <Paper
                            key={index}
                            elevation={1}
                            sx={{
                                p: 1.5,
                                mb: 1,
                                '&:hover': {
                                    boxShadow: 2
                                }
                            }}
                        >
                            <Typography variant="subtitle1" sx={{ mb: 0.75, fontWeight: 500, fontSize: '1rem', lineHeight: 1.3 }}>
                                {question.question}
                            </Typography>
                            <Box sx={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: 0.75,
                                '& > span': {
                                    fontSize: '0.85rem',
                                    color: 'text.secondary',
                                    display: 'flex',
                                    alignItems: 'center',
                                    '&:not(:last-child):after': {
                                        content: '"•"',
                                        mx: 0.75
                                    }
                                }
                            }}>
                                <span>Soru sayısı: {question.count} ({question.percentage}%)</span>
                                <span>Kategori: {question.category}</span>
                                {question.facility && <span>İlgili Alan: {question.facility}</span>}
                                {question.hotels?.length > 0 && <span>Otel: {question.hotels.join(', ')}</span>}
                                <span>Diller: {question.languages.join(', ')}</span>
                            </Box>
                        </Paper>
                    ))}
                </Grid>
            </Grid>
        </Box>
    );
};

export default AnalyticsTab; 