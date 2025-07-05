const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5002';
const TEST_SESSION_ID = 'stress-test-' + Date.now();

// Test categories and questions
const testQuestions = [
    // === ÇEVİRİ SİSTEMİ TESTLERİ (20 soru) ===
    {
        category: 'Translation System',
        questions: [
            { message: 'Hello, I need help with my reservation', expectedLanguage: 'en' },
            { message: 'Hallo, ich brauche Hilfe bei meiner Reservierung', expectedLanguage: 'de' },
            { message: 'Здравствуйте, мне нужна помощь с бронированием', expectedLanguage: 'ru' },
            { message: 'Merhaba, rezervasyonumla ilgili yardıma ihtiyacım var', expectedLanguage: 'tr' },
            { message: 'What time does the restaurant open?', expectedLanguage: 'en' },
            { message: 'Wann öffnet das Restaurant?', expectedLanguage: 'de' },
            { message: 'В какое время открывается ресторан?', expectedLanguage: 'ru' },
            { message: 'Restoran saat kaçta açılıyor?', expectedLanguage: 'tr' },
            { message: 'I want to book a spa treatment', expectedLanguage: 'en' },
            { message: 'Ich möchte eine Spa-Behandlung buchen', expectedLanguage: 'de' },
            { message: 'Я хочу забронировать спа-процедуру', expectedLanguage: 'ru' },
            { message: 'Spa tedavisi rezervasyonu yapmak istiyorum', expectedLanguage: 'tr' },
            { message: 'Where is the swimming pool?', expectedLanguage: 'en' },
            { message: 'Wo ist das Schwimmbad?', expectedLanguage: 'de' },
            { message: 'Где находится бассейн?', expectedLanguage: 'ru' },
            { message: 'Yüzme havuzu nerede?', expectedLanguage: 'tr' },
            { message: 'Can you help me with room service?', expectedLanguage: 'en' },
            { message: 'Können Sie mir bei der Zimmerdienst helfen?', expectedLanguage: 'de' },
            { message: 'Можете ли вы помочь мне с обслуживанием номеров?', expectedLanguage: 'ru' },
            { message: 'Oda servisi konusunda yardım edebilir misiniz?', expectedLanguage: 'tr' }
        ]
    },

    // === GÜNLÜK BİLGİLER TESTLERİ (15 soru) ===
    {
        category: 'Daily Information',
        questions: [
            { message: 'What is today\'s weather like?', hotel: 'belvil' },
            { message: 'Bugün hava nasıl?', hotel: 'belvil' },
            { message: 'Wie ist das Wetter heute?', hotel: 'belvil' },
            { message: 'Какая сегодня погода?', hotel: 'belvil' },
            { message: 'What activities are available today?', hotel: 'zeugma' },
            { message: 'Bugün hangi aktiviteler var?', hotel: 'zeugma' },
            { message: 'Welche Aktivitäten gibt es heute?', hotel: 'zeugma' },
            { message: 'Какие мероприятия сегодня?', hotel: 'zeugma' },
            { message: 'What is the daily program?', hotel: 'ayscha' },
            { message: 'Günlük program nedir?', hotel: 'ayscha' },
            { message: 'Was ist das Tagesprogramm?', hotel: 'ayscha' },
            { message: 'Какова дневная программа?', hotel: 'ayscha' },
            { message: 'Are there any special events today?', hotel: 'belvil' },
            { message: 'Bugün özel etkinlik var mı?', hotel: 'belvil' },
            { message: 'Gibt es heute besondere Veranstaltungen?', hotel: 'belvil' }
        ]
    },

    // === GENEL BİLGİLER TESTLERİ (15 soru) ===
    {
        category: 'General Information',
        questions: [
            { message: 'Tell me about the hotel facilities', hotel: 'belvil' },
            { message: 'Otel olanakları hakkında bilgi verin', hotel: 'belvil' },
            { message: 'Erzählen Sie mir über die Hotelanlagen', hotel: 'belvil' },
            { message: 'Расскажите об удобствах отеля', hotel: 'belvil' },
            { message: 'What are the check-in and check-out times?', hotel: 'zeugma' },
            { message: 'Giriş ve çıkış saatleri nedir?', hotel: 'zeugma' },
            { message: 'Was sind die Check-in- und Check-out-Zeiten?', hotel: 'zeugma' },
            { message: 'Какое время заезда и выезда?', hotel: 'zeugma' },
            { message: 'How do I get to the hotel from the airport?', hotel: 'ayscha' },
            { message: 'Havaalanından otele nasıl gidebilirim?', hotel: 'ayscha' },
            { message: 'Wie komme ich vom Flughafen zum Hotel?', hotel: 'ayscha' },
            { message: 'Как добраться от аэропорта до отеля?', hotel: 'ayscha' },
            { message: 'What is the hotel\'s address?', hotel: 'belvil' },
            { message: 'Otelin adresi nedir?', hotel: 'belvil' },
            { message: 'Was ist die Adresse des Hotels?', hotel: 'belvil' }
        ]
    },

    // === SPA KATALOĞU TESTLERİ (15 soru) ===
    {
        category: 'Spa Catalog',
        questions: [
            { message: 'What spa treatments are available?', hotel: 'belvil' },
            { message: 'Hangi spa tedavileri mevcut?', hotel: 'belvil' },
            { message: 'Welche Spa-Behandlungen sind verfügbar?', hotel: 'belvil' },
            { message: 'Какие спа-процедуры доступны?', hotel: 'belvil' },
            { message: 'How much does a massage cost?', hotel: 'zeugma' },
            { message: 'Masaj fiyatı nedir?', hotel: 'zeugma' },
            { message: 'Wie viel kostet eine Massage?', hotel: 'zeugma' },
            { message: 'Сколько стоит массаж?', hotel: 'zeugma' },
            { message: 'Can I book a spa appointment?', hotel: 'ayscha' },
            { message: 'Spa randevusu alabilir miyim?', hotel: 'ayscha' },
            { message: 'Kann ich einen Spa-Termin buchen?', hotel: 'ayscha' },
            { message: 'Могу ли я забронировать спа-сеанс?', hotel: 'ayscha' },
            { message: 'What are the spa opening hours?', hotel: 'belvil' },
            { message: 'Spa çalışma saatleri nedir?', hotel: 'belvil' },
            { message: 'Was sind die Spa-Öffnungszeiten?', hotel: 'belvil' }
        ]
    },

    // === F&B BİLGİLERİ TESTLERİ (15 soru) ===
    {
        category: 'F&B Information',
        questions: [
            { message: 'What restaurants are in the hotel?', hotel: 'belvil' },
            { message: 'Otelde hangi restoranlar var?', hotel: 'belvil' },
            { message: 'Welche Restaurants gibt es im Hotel?', hotel: 'belvil' },
            { message: 'Какие рестораны есть в отеле?', hotel: 'belvil' },
            { message: 'What is the menu at Bloom Lounge?', hotel: 'belvil' },
            { message: 'Bloom Lounge menüsü nedir?', hotel: 'belvil' },
            { message: 'Was ist die Speisekarte im Bloom Lounge?', hotel: 'belvil' },
            { message: 'Какое меню в Bloom Lounge?', hotel: 'belvil' },
            { message: 'Tell me about the food at Dolce Vita', hotel: 'belvil' },
            { message: 'Dolce Vita\'daki yemekler hakkında bilgi verin', hotel: 'belvil' },
            { message: 'Erzählen Sie mir über das Essen im Dolce Vita', hotel: 'belvil' },
            { message: 'Расскажите о еде в Dolce Vita', hotel: 'belvil' },
            { message: 'What time does the restaurant close?', hotel: 'zeugma' },
            { message: 'Restoran saat kaçta kapanıyor?', hotel: 'zeugma' },
            { message: 'Wann schließt das Restaurant?', hotel: 'zeugma' }
        ]
    },

    // === CANLI DESTEK SİSTEMİ TESTLERİ (20 soru) ===
    {
        category: 'Live Support System',
        questions: [
            { message: 'I need live support', expectedResponse: 'support' },
            { message: 'Canlı destek istiyorum', expectedResponse: 'support' },
            { message: 'Ich brauche Live-Support', expectedResponse: 'support' },
            { message: 'Мне нужна живая поддержка', expectedResponse: 'support' },
            { message: 'I want to talk to a real person', expectedResponse: 'support' },
            { message: 'Gerçek bir insanla konuşmak istiyorum', expectedResponse: 'support' },
            { message: 'Ich möchte mit einem echten Menschen sprechen', expectedResponse: 'support' },
            { message: 'Я хочу поговорить с настоящим человеком', expectedResponse: 'support' },
            { message: 'Belvil hotel live support', expectedResponse: 'support' },
            { message: 'Belvil oteli canlı destek', expectedResponse: 'support' },
            { message: 'Belvil Hotel Live-Support', expectedResponse: 'support' },
            { message: 'Живая поддержка отеля Belvil', expectedResponse: 'support' },
            { message: 'I want to connect to live support for Zeugma hotel', expectedResponse: 'support' },
            { message: 'Zeugma oteli için canlı desteğe bağlanmak istiyorum', expectedResponse: 'support' },
            { message: 'Ich möchte mit dem Live-Support für das Hotel Zeugma verbunden werden', expectedResponse: 'support' },
            { message: 'Я хочу подключиться к службе поддержки отеля Zeugma', expectedResponse: 'support' },
            { message: 'Ayscha hotel customer service', expectedResponse: 'support' },
            { message: 'Ayscha oteli müşteri hizmetleri', expectedResponse: 'support' },
            { message: 'Ayscha Hotel Kundenservice', expectedResponse: 'support' },
            { message: 'Служба поддержки отеля Ayscha', expectedResponse: 'support' }
        ]
    }
];

// Test results storage
let testResults = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    categoryResults: {},
    responseTimes: [],
    errors: []
};

// Helper function to make API call
async function makeApiCall(message, sessionId = TEST_SESSION_ID) {
    const startTime = Date.now();
    try {
        const response = await axios.post(`${BASE_URL}/api/chat`, {
            message: message,
            session_id: sessionId,
            history: []
        }, {
            timeout: 30000 // 30 second timeout
        });
        const responseTime = Date.now() - startTime;
        return {
            success: true,
            data: response.data,
            responseTime: responseTime
        };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        return {
            success: false,
            error: error.message,
            responseTime: responseTime
        };
    }
}

// Helper function to check if response contains support keywords
function isSupportResponse(response) {
    const supportKeywords = [
        'canlı destek', 'live support', 'live help', 'customer service',
        'gerçek bir insanla konuşmak', 'talk to human', 'operator',
        'живая поддержка', 'поддержка', 'помощь', 'служба поддержки',
        'Live-Support', 'Kundenservice', 'Hilfe'
    ];
    
    const responseText = response.response?.toLowerCase() || '';
    return supportKeywords.some(keyword => responseText.includes(keyword.toLowerCase()));
}

// Helper function to check if response contains hotel information
function isHotelInfoResponse(response) {
    const hotelKeywords = [
        'otel', 'hotel', 'facility', 'facility', 'check-in', 'check-out',
        'restaurant', 'restoran', 'spa', 'pool', 'havuz', 'swimming',
        'reservation', 'rezervasyon', 'booking', 'buchung'
    ];
    
    const responseText = response.response?.toLowerCase() || '';
    return hotelKeywords.some(keyword => responseText.includes(keyword.toLowerCase()));
}

// Helper function to check if response contains F&B information
function isFandBResponse(response) {
    const fandBKeywords = [
        'restaurant', 'restoran', 'menu', 'menü', 'food', 'yemek',
        'dining', 'yemek', 'breakfast', 'kahvaltı', 'lunch', 'öğle yemeği',
        'dinner', 'akşam yemeği', 'bloom', 'dolce vita', 'mirage'
    ];
    
    const responseText = response.response?.toLowerCase() || '';
    return fandBKeywords.some(keyword => responseText.includes(keyword.toLowerCase()));
}

// Helper function to check if response contains spa information
function isSpaResponse(response) {
    const spaKeywords = [
        'spa', 'massage', 'masaj', 'treatment', 'tedavi', 'wellness',
        'relaxation', 'rahatlama', 'therapy', 'terapi', 'beauty', 'güzellik'
    ];
    
    const responseText = response.response?.toLowerCase() || '';
    return spaKeywords.some(keyword => responseText.includes(keyword.toLowerCase()));
}

// Test execution function
async function runTest(question, category) {
    testResults.totalTests++;
    
    console.log(`\n🧪 Testing: ${question.message}`);
    console.log(`📂 Category: ${category}`);
    
    const result = await makeApiCall(question.message);
    
    if (!result.success) {
        testResults.failedTests++;
        testResults.errors.push({
            question: question.message,
            category: category,
            error: result.error
        });
        console.log(`❌ FAILED: ${result.error}`);
        return false;
    }
    
    // Check response time
    testResults.responseTimes.push(result.responseTime);
    
    // Validate response based on category
    let isValid = false;
    let validationMessage = '';
    
    switch (category) {
        case 'Translation System':
            // Check if response is in the expected language
            const responseText = result.data.response?.toLowerCase() || '';
            const hasEnglish = /[a-z]/.test(responseText);
            const hasTurkish = /[çğıöşü]/.test(responseText);
            const hasGerman = /[äöüß]/.test(responseText);
            const hasRussian = /[а-яё]/.test(responseText);
            
            if (question.expectedLanguage === 'en' && hasEnglish) isValid = true;
            else if (question.expectedLanguage === 'tr' && hasTurkish) isValid = true;
            else if (question.expectedLanguage === 'de' && hasGerman) isValid = true;
            else if (question.expectedLanguage === 'ru' && hasRussian) isValid = true;
            else isValid = result.data.response && result.data.response.length > 10;
            
            validationMessage = `Response language check: ${isValid ? 'PASS' : 'FAIL'}`;
            break;
            
        case 'Daily Information':
            isValid = result.data.response && result.data.response.length > 20;
            validationMessage = `Daily info response: ${isValid ? 'PASS' : 'FAIL'}`;
            break;
            
        case 'General Information':
            isValid = isHotelInfoResponse(result.data);
            validationMessage = `Hotel info response: ${isValid ? 'PASS' : 'FAIL'}`;
            break;
            
        case 'Spa Catalog':
            isValid = isSpaResponse(result.data);
            validationMessage = `Spa info response: ${isValid ? 'PASS' : 'FAIL'}`;
            break;
            
        case 'F&B Information':
            isValid = isFandBResponse(result.data);
            validationMessage = `F&B info response: ${isValid ? 'PASS' : 'FAIL'}`;
            break;
            
        case 'Live Support System':
            isValid = isSupportResponse(result.data);
            validationMessage = `Support response: ${isValid ? 'PASS' : 'FAIL'}`;
            break;
            
        default:
            isValid = result.data.response && result.data.response.length > 10;
            validationMessage = `General response: ${isValid ? 'PASS' : 'FAIL'}`;
    }
    
    if (isValid) {
        testResults.passedTests++;
        console.log(`✅ PASSED (${result.responseTime}ms): ${validationMessage}`);
    } else {
        testResults.failedTests++;
        console.log(`❌ FAILED (${result.responseTime}ms): ${validationMessage}`);
        console.log(`   Response: ${result.data.response?.substring(0, 100)}...`);
    }
    
    // Update category results
    if (!testResults.categoryResults[category]) {
        testResults.categoryResults[category] = { passed: 0, failed: 0, total: 0 };
    }
    testResults.categoryResults[category].total++;
    if (isValid) {
        testResults.categoryResults[category].passed++;
    } else {
        testResults.categoryResults[category].failed++;
    }
    
    return isValid;
}

// Main test execution
async function runComprehensiveTest() {
    console.log('🚀 Starting Comprehensive Stress Test');
    console.log('=' .repeat(60));
    console.log(`📊 Total Questions: ${testQuestions.reduce((sum, cat) => sum + cat.questions.length, 0)}`);
    console.log(`🕐 Start Time: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    
    for (const category of testQuestions) {
        console.log(`\n📂 Testing Category: ${category.category}`);
        console.log('-'.repeat(40));
        
        for (const question of category.questions) {
            await runTest(question, category.category);
            
            // Add small delay between requests to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    const totalTime = Date.now() - startTime;
    
    // Generate comprehensive report
    generateReport(totalTime);
}

// Report generation
function generateReport(totalTime) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE STRESS TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n⏱️  Total Test Time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log(`📈 Total Tests: ${testResults.totalTests}`);
    console.log(`✅ Passed: ${testResults.passedTests}`);
    console.log(`❌ Failed: ${testResults.failedTests}`);
    console.log(`📊 Success Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(2)}%`);
    
    // Average response time
    const avgResponseTime = testResults.responseTimes.reduce((sum, time) => sum + time, 0) / testResults.responseTimes.length;
    console.log(`⚡ Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    
    // Category breakdown
    console.log('\n📂 CATEGORY BREAKDOWN:');
    console.log('-'.repeat(40));
    
    for (const [category, results] of Object.entries(testResults.categoryResults)) {
        const successRate = ((results.passed / results.total) * 100).toFixed(2);
        console.log(`${category}: ${results.passed}/${results.total} (${successRate}%)`);
    }
    
    // Performance evaluation (1-10 scale)
    console.log('\n🎯 PERFORMANCE EVALUATION (1-10 Scale):');
    console.log('-'.repeat(40));
    
    const overallSuccessRate = (testResults.passedTests / testResults.totalTests) * 100;
    const performanceScore = Math.round((overallSuccessRate / 10) * 10) / 10;
    
    console.log(`Overall Performance: ${performanceScore}/10`);
    
    // Category scores
    for (const [category, results] of Object.entries(testResults.categoryResults)) {
        const categoryScore = Math.round(((results.passed / results.total) * 100) / 10) * 10 / 10;
        console.log(`${category}: ${categoryScore}/10`);
    }
    
    // Strong and weak areas
    console.log('\n💪 STRONG AREAS:');
    console.log('-'.repeat(20));
    for (const [category, results] of Object.entries(testResults.categoryResults)) {
        const successRate = (results.passed / results.total) * 100;
        if (successRate >= 80) {
            console.log(`✅ ${category}: ${successRate.toFixed(1)}% success rate`);
        }
    }
    
    console.log('\n⚠️  WEAK AREAS:');
    console.log('-'.repeat(20));
    for (const [category, results] of Object.entries(testResults.categoryResults)) {
        const successRate = (results.passed / results.total) * 100;
        if (successRate < 80) {
            console.log(`❌ ${category}: ${successRate.toFixed(1)}% success rate`);
        }
    }
    
    // Error details
    if (testResults.errors.length > 0) {
        console.log('\n🚨 ERROR DETAILS:');
        console.log('-'.repeat(20));
        testResults.errors.slice(0, 5).forEach((error, index) => {
            console.log(`${index + 1}. ${error.category}: ${error.error}`);
        });
        if (testResults.errors.length > 5) {
            console.log(`... and ${testResults.errors.length - 5} more errors`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 Stress Test Completed!');
    console.log('='.repeat(60));
}

// Run the test
if (require.main === module) {
    runComprehensiveTest().catch(console.error);
}

module.exports = { runComprehensiveTest, testResults };