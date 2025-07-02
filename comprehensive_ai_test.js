const axios = require('axios');
const fs = require('fs');

// Test categories and questions
const testQuestions = {
    // General Information & Hotel Services (25 questions)
    generalQuestions: [
        { text: "What time is breakfast served?", lang: "en" },
        { text: "Wann ist das Abendessen?", lang: "de" },
        { text: "Havuzun çalışma saatleri nedir?", lang: "tr" },
        { text: "Где находится ближайший пляж?", lang: "ru" },
        { text: "Do you have room service?", lang: "en" },
        { text: "Gibt es einen Wäscheservice?", lang: "de" },
        { text: "Otelde çocuk kulübü var mı?", lang: "tr" },
        { text: "Как добраться до центра города?", lang: "ru" },
        { text: "What's included in the all-inclusive package?", lang: "en" },
        { text: "Wo ist der Fitnessraum?", lang: "de" },
        { text: "Mini bar ücretli mi?", lang: "tr" },
        { text: "Есть ли у вас обмен валюты?", lang: "ru" },
        { text: "How can I book a taxi?", lang: "en" },
        { text: "Haben Sie einen Shuttleservice zum Flughafen?", lang: "de" },
        { text: "Oda servisi 24 saat mı?", lang: "tr" },
        { text: "Какие рестораны работают сегодня?", lang: "ru" },
        { text: "Is there WiFi in the rooms?", lang: "en" },
        { text: "Wo kann ich ein Auto mieten?", lang: "de" },
        { text: "Plajda şezlong ücreti var mı?", lang: "tr" },
        { text: "Как заказать экскурсию?", lang: "ru" },
        { text: "What's the checkout time?", lang: "en" },
        { text: "Gibt es eine Kinderbetreuung?", lang: "de" },
        { text: "Akşam şovları saat kaçta?", lang: "tr" },
        { text: "Где находится спа-центр?", lang: "ru" },
        { text: "Do you have vegetarian options in restaurants?", lang: "en" }
    ],

    // Daily Activities & Entertainment (25 questions)
    dailyQuestions: [
        { text: "What activities are there today?", lang: "en" },
        { text: "Was für Aktivitäten gibt es heute?", lang: "de" },
        { text: "Bugün hangi aktiviteler var?", lang: "tr" },
        { text: "Какие мероприятия сегодня?", lang: "ru" },
        { text: "What time is the evening show?", lang: "en" },
        { text: "Wann beginnt die Wassergymnastik?", lang: "de" },
        { text: "Yoga dersi saat kaçta?", lang: "tr" },
        { text: "Во сколько начинается анимация?", lang: "ru" },
        { text: "Are there any sports tournaments today?", lang: "en" },
        { text: "Gibt es heute eine Poolparty?", lang: "de" },
        { text: "Bugün çocuk kulübünde ne var?", lang: "tr" },
        { text: "Какие спортивные мероприятия сегодня?", lang: "ru" },
        { text: "What's the entertainment program for tonight?", lang: "en" },
        { text: "Was ist das Abendprogramm?", lang: "de" },
        { text: "Akşam gösterisi ne?", lang: "tr" },
        { text: "Где проходит дискотека?", lang: "ru" },
        { text: "Is there any live music tonight?", lang: "en" },
        { text: "Wann ist das Kinderprogramm?", lang: "de" },
        { text: "Plajda aktivite var mı bugün?", lang: "tr" },
        { text: "Есть ли сегодня живая музыка?", lang: "ru" },
        { text: "What time does the kids club open?", lang: "en" },
        { text: "Gibt es heute Tennisunterricht?", lang: "de" },
        { text: "Bugün hangi spor dersleri var?", lang: "tr" },
        { text: "Во сколько начинается йога?", lang: "ru" },
        { text: "What activities are available at the beach?", lang: "en" }
    ],

    // SPA & Wellness (25 questions)
    spaQuestions: [
        { text: "How can I book a massage?", lang: "en" },
        { text: "Welche Spa-Behandlungen bieten Sie an?", lang: "de" },
        { text: "Spa merkezi saat kaçta açılıyor?", lang: "tr" },
        { text: "Какие массажи у вас есть?", lang: "ru" },
        { text: "What's included in the Turkish bath package?", lang: "en" },
        { text: "Wie viel kostet eine Massage?", lang: "de" },
        { text: "Hamam ücreti ne kadar?", lang: "tr" },
        { text: "Как записаться на массаж?", lang: "ru" },
        { text: "Do you have couples massage?", lang: "en" },
        { text: "Gibt es eine Sauna?", lang: "de" },
        { text: "Spa'da çocuk masajı var mı?", lang: "tr" },
        { text: "Есть ли у вас хамам?", lang: "ru" },
        { text: "What spa treatments do you recommend?", lang: "en" },
        { text: "Brauche ich einen Termin für die Sauna?", lang: "de" },
        { text: "Yüz bakımı ne kadar?", lang: "tr" },
        { text: "Какие процедуры для лица есть?", lang: "ru" },
        { text: "Is the indoor pool heated?", lang: "en" },
        { text: "Haben Sie Aromatherapie?", lang: "de" },
        { text: "Spa'da cilt bakımı var mı?", lang: "tr" },
        { text: "Сколько стоит массаж?", lang: "ru" },
        { text: "What time does the spa close?", lang: "en" },
        { text: "Gibt es Wellnesspackete?", lang: "de" },
        { text: "Masaj için rezervasyon gerekli mi?", lang: "tr" },
        { text: "Есть ли скидки на спа процедуры?", lang: "ru" },
        { text: "Do you have anti-stress treatments?", lang: "en" }
    ],

    // Complex Scenarios & Special Requests (25 questions)
    complexQuestions: [
        { text: "I have a gluten allergy, which restaurants are safe for me?", lang: "en" },
        { text: "Ich möchte meinen Hochzeitstag hier feiern, was können Sie anbieten?", lang: "de" },
        { text: "Özel diyet menünüz var mı? Diyabetim var.", lang: "tr" },
        { text: "У меня аллергия на морепродукты, где это можно указать?", lang: "ru" },
        { text: "Can you arrange a birthday surprise in our room?", lang: "en" },
        { text: "Können Sie einen Ausflug mit Kinderbetreuung organisieren?", lang: "de" },
        { text: "Havaalanına özel transfer ayarlayabilir misiniz?", lang: "tr" },
        { text: "Можно ли организовать романтический ужин на пляже?", lang: "ru" },
        { text: "I need a late checkout and early breakfast tomorrow, is it possible?", lang: "en" },
        { text: "Wir brauchen einen Arzt, der Deutsch spricht.", lang: "de" },
        { text: "Özel diyet şefle görüşebilir miyim?", lang: "tr" },
        { text: "Нужен трансфер в аэропорт рано утром, это возможно?", lang: "ru" },
        { text: "Can you recommend activities for a rainy day with kids?", lang: "en" },
        { text: "Gibt es spezielle Angebote für Hochzeitsreisende?", lang: "de" },
        { text: "Bebek bakıcısı hizmeti var mı?", lang: "tr" },
        { text: "Как организовать день рождения ребенка в отеле?", lang: "ru" },
        { text: "We're celebrating our anniversary, any special packages?", lang: "en" },
        { text: "Können Sie eine private Yacht-Tour organisieren?", lang: "de" },
        { text: "Özel kutlama için restoran rezervasyonu yapabilir miyiz?", lang: "tr" },
        { text: "Нужен русскоговорящий гид для экскурсии.", lang: "ru" },
        { text: "I need to arrange a business meeting, what facilities do you have?", lang: "en" },
        { text: "Bieten Sie Kochkurse für Kinder an?", lang: "de" },
        { text: "Vegeteryan menü seçenekleriniz neler?", lang: "tr" },
        { text: "Можно ли заказать особое меню для детей?", lang: "ru" },
        { text: "Do you have any eco-friendly or sustainable initiatives?", lang: "en" }
    ]
};

// Test configuration
const config = {
    endpoint: 'http://localhost:3000/api/chat',  // Updated endpoint
    timeout: 30000,
    delayBetweenRequests: 2000  // Increased delay to prevent rate limiting
};

// Scoring criteria
const scoringCriteria = {
    responseTime: {
        weight: 0.1,
        evaluate: (startTime, endTime) => {
            const responseTime = endTime - startTime;
            if (responseTime < 2000) return 10;
            if (responseTime < 5000) return 8;
            if (responseTime < 10000) return 5;
            return 3;
        }
    },
    languageHandling: {
        weight: 0.25,
        evaluate: (response, expectedLang) => {
            // Check if response is in the correct language
            // This is a simplified check - you might want to use a proper language detection library
            const langPatterns = {
                en: /^[a-zA-Z\s\d.,!?'-]+$/,
                de: /[äöüßÄÖÜ]/,
                tr: /[ğıİöüçşĞÖÜÇŞ]/,
                ru: /[а-яА-ЯёЁ]/
            };
            return langPatterns[expectedLang].test(response) ? 10 : 5;
        }
    },
    contentRelevance: {
        weight: 0.35,
        evaluate: (response, question) => {
            // Check for relevant keywords and context
            const keywords = question.toLowerCase().split(' ');
            const relevantWords = keywords.filter(word => 
                response.toLowerCase().includes(word)
            ).length;
            return (relevantWords / keywords.length) * 10;
        }
    },
    completeness: {
        weight: 0.3,
        evaluate: (response) => {
            // Check response length and structure
            if (response.length < 20) return 3;
            if (response.length < 50) return 5;
            if (response.length < 100) return 8;
            return 10;
        }
    }
};

// Results storage
let testResults = {
    general: { scores: [], average: 0 },
    daily: { scores: [], average: 0 },
    spa: { scores: [], average: 0 },
    complex: { scores: [], average: 0 },
    languageSpecific: {
        en: { scores: [], average: 0 },
        de: { scores: [], average: 0 },
        tr: { scores: [], average: 0 },
        ru: { scores: [], average: 0 }
    }
};

// Helper function to delay between requests
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to evaluate a single response
function evaluateResponse(response, question, startTime, endTime) {
    const scores = {
        responseTime: scoringCriteria.responseTime.evaluate(startTime, endTime),
        languageHandling: scoringCriteria.languageHandling.evaluate(response, question.lang),
        contentRelevance: scoringCriteria.contentRelevance.evaluate(response, question.text),
        completeness: scoringCriteria.completeness.evaluate(response)
    };

    const weightedScore = 
        (scores.responseTime * scoringCriteria.responseTime.weight) +
        (scores.languageHandling * scoringCriteria.languageHandling.weight) +
        (scores.contentRelevance * scoringCriteria.contentRelevance.weight) +
        (scores.completeness * scoringCriteria.completeness.weight);

    return {
        scores,
        weightedScore: Math.round(weightedScore * 10) / 10
    };
}

// Function to run tests for a category
async function runCategoryTests(category, questions) {
    const results = [];
    
    for (const question of questions) {
        const startTime = Date.now();
        try {
            const response = await axios.post(config.endpoint, {
                message: question.text,
                history: [],  // Start with empty history for each test
                session_id: `test-session-${Date.now()}`
            });
            const endTime = Date.now();
            
            // Extract the actual response text from the response
            const responseText = response.data.response || '';
            
            const evaluation = evaluateResponse(
                responseText,
                question,
                startTime,
                endTime
            );
            
            results.push({
                question: question.text,
                language: question.lang,
                response: responseText,
                ...evaluation
            });

            // Update language-specific scores
            testResults.languageSpecific[question.lang].scores.push(evaluation.weightedScore);

            // Add delay between requests
            await delay(config.delayBetweenRequests);

        } catch (error) {
            console.error(`Error testing question: ${question.text}`, error.message);
            results.push({
                question: question.text,
                language: question.lang,
                error: error.message,
                weightedScore: 0
            });
            
            // Add longer delay after error
            await delay(config.delayBetweenRequests * 2);
        }
    }

    return results;
}

// Main test function
async function runAllTests() {
    console.log('Starting comprehensive AI testing...');
    
    // Run tests for each category
    const categories = {
        general: testQuestions.generalQuestions,
        daily: testQuestions.dailyQuestions,
        spa: testQuestions.spaQuestions,
        complex: testQuestions.complexQuestions
    };

    for (const [category, questions] of Object.entries(categories)) {
        console.log(`Testing ${category} category...`);
        const results = await runCategoryTests(category, questions);
        testResults[category].scores = results.map(r => r.weightedScore);
        testResults[category].average = 
            results.reduce((acc, r) => acc + r.weightedScore, 0) / results.length;
    }

    // Calculate language-specific averages
    for (const lang of ['en', 'de', 'tr', 'ru']) {
        testResults.languageSpecific[lang].average = 
            testResults.languageSpecific[lang].scores.reduce((acc, score) => acc + score, 0) / 
            testResults.languageSpecific[lang].scores.length;
    }

    // Generate final report
    const finalReport = {
        overallScore: (
            testResults.general.average +
            testResults.daily.average +
            testResults.spa.average +
            testResults.complex.average
        ) / 4,
        categoryScores: {
            general: testResults.general.average,
            daily: testResults.daily.average,
            spa: testResults.spa.average,
            complex: testResults.complex.average
        },
        languageScores: {
            english: testResults.languageSpecific.en.average,
            german: testResults.languageSpecific.de.average,
            turkish: testResults.languageSpecific.tr.average,
            russian: testResults.languageSpecific.ru.average
        }
    };

    // Save detailed results to file
    fs.writeFileSync('stress_test_results.log', JSON.stringify(testResults, null, 2));
    
    return finalReport;
}

// Execute tests
runAllTests()
    .then(report => {
        console.log('\nTest Complete! Final Report:');
        console.log('==========================');
        console.log(`Overall AI Performance Score: ${report.overallScore.toFixed(1)}/10`);
        console.log('\nCategory Scores:');
        console.log(`General Information: ${report.categoryScores.general.toFixed(1)}/10`);
        console.log(`Daily Activities: ${report.categoryScores.daily.toFixed(1)}/10`);
        console.log(`Spa & Wellness: ${report.categoryScores.spa.toFixed(1)}/10`);
        console.log(`Complex Scenarios: ${report.categoryScores.complex.toFixed(1)}/10`);
        console.log('\nLanguage Performance:');
        console.log(`English: ${report.languageScores.english.toFixed(1)}/10`);
        console.log(`German: ${report.languageScores.german.toFixed(1)}/10`);
        console.log(`Turkish: ${report.languageScores.turkish.toFixed(1)}/10`);
        console.log(`Russian: ${report.languageScores.russian.toFixed(1)}/10`);
        console.log('\nDetailed results have been saved to stress_test_results.log');
    })
    .catch(error => {
        console.error('Test execution failed:', error);
    });
