const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.json({ 
        message: 'Test server working!', 
        port: PORT,
        env: process.env.NODE_ENV 
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Test server running on port ${PORT}`);
}); 