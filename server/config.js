// Configuration for Cloud Run deployment
module.exports = {
    // Port configuration - Cloud Run uses 8080
    PORT: process.env.PORT || 8080,
    
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // CORS origins for production
    PRODUCTION_ORIGINS: [
        'https://ai.talhaturkman.com',           // Production frontend domain
        'https://gen-lang-client-0930707875.web.app',  // Firebase hosting backup
        'https://talhaturkman.com',              // Root domain
        'https://www.talhaturkman.com'           // WWW subdomain
    ],
    
    // CORS origins for development
    DEVELOPMENT_ORIGINS: [
        'http://localhost:3000', 
        'http://localhost:5173',
        'http://192.168.4.151:3000',
        'http://192.168.4.151:5173',
        'http://192.168.7.2:3000',
        'http://192.168.7.2:5173',
        'http://192.168.137.1:3001',
        'https://192.168.137.1:3001',
        'http://192.168.137.1:63659',
        'http://192.168.137.1:3000',
        'http://192.168.137.1:5173',
        /^https?:\/\/192\.168\.\d+\.\d+:(3000|3001|5173|63659)$/,
        'https://gen-lang-client-0930707875.web.app',
        'https://ai.talhaturkman.com',
        'https://papillonai-backend.loca.lt'
    ]
}; 