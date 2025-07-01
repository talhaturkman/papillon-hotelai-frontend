const axios = require('axios');
const fs = require('fs');

const API_BASE_URL = 'http://localhost:5002';
const TOTAL_TESTS = 100;

const hotels = ['Belvil', 'Zeugma', 'Ayscha'];
const languages = ['en', 'de', 'tr', 'ru'];

const questionBank = {
    en: [
        "What are the check-in and check-out times, and can I request a late check-out?",
        "Tell me about all the à la carte restaurants. What type of cuisine are they and do they have an extra charge?",
        "What are the operating hours for the main swimming pool and the kids' pool?",
        "Is there a spa? List three services offered and tell me if the Turkish bath is free.",
        "What activities are available for children aged 4-8 versus teenagers?",
        "Is the Wi-Fi free in the rooms and on the beach? How is the speed?",
        "I am allergic to nuts. How does the hotel handle food allergies in the main restaurant?",
        "List all the bars. Which ones are open 24/7?",
        "I need to speak to a human representative about a problem with my booking.",
        "Tell me about the beach. Is it sandy? Are towels and sunbeds complimentary?",
        "Is there a fitness center and what are its operating hours?",
        "What kind of evening entertainment or shows can I expect?",
        "How do I get to the hotel from Antalya airport? Do you offer a shuttle?",
        "Are pets allowed in the hotel rooms?",
        "Which hotel is better for a quiet, relaxing holiday, Zeugma or Ayscha? Describe the atmosphere."
    ],
    de: [
        "Wie sind die Check-in- und Check-out-Zeiten und kann ich einen späten Check-out beantragen?",
        "Erzählen Sie mir von allen À-la-carte-Restaurants. Welche Art von Küche bieten sie an und kosten sie extra?",
        "Was sind die Öffnungszeiten des Hauptschwimmbads und des Kinderbeckens?",
        "Gibt es ein Spa? Nennen Sie drei angebotene Dienstleistungen und sagen Sie mir, ob das türkische Bad kostenlos ist.",
        "Welche Aktivitäten gibt es für Kinder im Alter von 4-8 Jahren im Vergleich zu Teenagern?",
        "Ist das WLAN in den Zimmern und am Strand kostenlos? Wie ist die Geschwindigkeit?",
        "Ich bin allergisch gegen Nüsse. Wie geht das Hotel mit Lebensmittelallergien im Hauptrestaurant um?",
        "Listen Sie alle Bars auf. Welche sind rund um die Uhr geöffnet?",
        "Ich muss mit einem menschlichen Mitarbeiter über ein Problem mit meiner Buchung sprechen.",
        "Erzählen Sie mir vom Strand. Ist er sandig? Sind Handtücher und Liegen kostenlos?",
        "Gibt es ein Fitnesscenter und was sind die Öffnungszeiten?",
        "Welche Art von Abendunterhaltung oder Shows kann ich erwarten?",
        "Wie komme ich vom Flughafen Antalya zum Hotel? Bieten Sie einen Shuttle an?",
        "Sind Haustiere in den Hotelzimmern erlaubt?",
        "Welches Hotel ist besser für einen ruhigen, erholsamen Urlaub, Zeugma oder Ayscha? Beschreiben Sie die Atmosphäre."
    ],
    tr: [
        "Giriş ve çıkış saatleri nedir ve geç çıkış talep edebilir miyim?",
        "Tüm à la carte restoranlar hakkında bilgi verin. Mutfak türleri nedir ve ekstra ücretli midir?",
        "Ana yüzme havuzu ve çocuk havuzunun çalışma saatleri nedir?",
        "Spa var mı? Sunulan üç hizmeti listeleyin ve Türk hamamının ücretsiz olup olmadığını söyleyin.",
        "4-8 yaş arası çocuklar ve gençler için ne gibi aktiviteler mevcut?",
        "Odalarda ve plajda Wi-Fi ücretsiz mi? Hızı nasıl?",
        "Fındığa alerjim var. Ana restoranda gıda alerjileri konusunda nasıl bir uygulama var?",
        "Tüm barları listeleyin. Hangileri 7/24 açık?",
        "Rezervasyonumla ilgili bir sorun hakkında bir insan temsilciyle konuşmam gerekiyor.",
        "Plaj hakkında bilgi verin. Kumsal mı? Havlu ve şezlong ücretsiz mi?",
        "Fitness merkezi var mı ve çalışma saatleri nedir?",
        "Ne tür akşam eğlenceleri veya şovlar bekleyebilirim?",
        "Antalya havalimanından otele nasıl giderim? Servisiniz var mı?",
        "Otel odalarına evcil hayvan kabul ediliyor mu?",
        "Sakin ve dinlendirici bir tatil için hangi otel daha iyi, Zeugma mı Ayscha mı? Atmosferi tarif edin."
    ],
    ru: [
        "Какое время заезда и выезда, и могу ли я запросить поздний выезд?",
        "Расскажите обо всех ресторанах à la carte. Какая там кухня и взимается ли дополнительная плата?",
        "Какие часы работы главного бассейна и детского бассейна?",
        "Есть ли спа? Перечислите три предлагаемые услуги и скажите, бесплатная ли турецкая баня.",
        "Какие развлечения доступны для детей в возрасте 4-8 лет по сравнению с подростками?",
        "Бесплатный ли Wi-Fi в номерах и на пляже? Какая скорость?",
        "У меня аллергия на орехи. Как отель решает вопросы с пищевой аллергией в главном ресторане?",
        "Перечислите все бары. Какие из них открыты 24/7?",
        "Мне нужно поговорить с представителем о проблеме с моим бронированием.",
        "Расскажите о пляже. Он песчаный? Полотенца и шезлонги бесплатные?",
        "Есть ли фитнес-центр и какие у него часы работы?",
        "Какие вечерние развлечения или шоу я могу ожидать?",
        "Как добраться до отеля из аэропорта Анталии? Предлагаете ли вы трансфер?",
        "Разрешено ли размещение с домашними животными в номерах отеля?",
        "Какой отель лучше подходит для тихого, спокойного отдыха, Zeugma или Ayscha? Опишите атмосферу."
    ]
};

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function runStressTest() {
    console.log(`��� Starting AI Stress Test: ${TOTAL_TESTS} randomized iterations...`);
    console.log('================================================================');
    
    const logStream = fs.createWriteStream('stress_test_results.log', { flags: 'w' });
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < TOTAL_TESTS; i++) {
        const testNum = i + 1;
        const hotel = getRandomElement(hotels);
        const lang = getRandomElement(languages);
        const question = getRandomElement(questionBank[lang]);
        const sessionId = `stress-test-${Date.now()}`;
        
        const logPrefix = `[Test ${testNum}/${TOTAL_TESTS}] [${hotel}/${lang}]`;
        process.stdout.write(`\r${logPrefix} Running...`);

        try {
            const startTime = Date.now();
            const response = await axios.post(`${API_BASE_URL}/api/chat`, {
                message: question,
                history: [
                    { role: 'user', content: `I have a question about ${hotel}.` },
                    { role: 'assistant', content: 'Of course, I can help with that.' }
                ],
                session_id: sessionId
            }, { timeout: 45000 });
            const duration = (Date.now() - startTime) / 1000;

                const aiResponse = response.data.response;
            if (aiResponse && aiResponse.length > 0) {
                successCount++;
                const logEntry = `${logPrefix} SUCCESS (${duration.toFixed(2)}s)\n❓ Question: ${question}\n�� Answer: ${aiResponse.replace(/\n/g, ' ')}\n---\n`;
                logStream.write(logEntry);
            } else {
                throw new Error("Received empty response from AI.");
            }

        } catch (error) {
            errorCount++;
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            const logEntry = `${logPrefix} FAILED\n❓ Question: ${question}\n❌ Error: ${errorMessage}\n---\n`;
            logStream.write(logEntry);
            console.error(`\n${logPrefix} FAILED. See stress_test_results.log for details.`);
        }
    }

    logStream.end();
    
    console.log('\n================================================================');
    console.log('��� AI Stress Test Finished.');
    console.log(`\nFinal Report:\n`);
    console.log(`  ✅ Successful Tests: ${successCount}/${TOTAL_TESTS}`);
    console.log(`  ❌ Failed Tests:     ${errorCount}/${TOTAL_TESTS}`);
    console.log(`\n��� A detailed log has been saved to: stress_test_results.log`);
}

runStressTest();
