const axios = require('axios');

class PlacesService {
    constructor() {
        this.apiKey = process.env.GOOGLE_CLOUD_API_KEY;
        this.baseUrl = 'https://maps.googleapis.com/maps/api/place';

        this.hotelLocations = {
            'belvil': { name: 'Papillon Belvil Hotel', lat: 36.8626, lng: 31.0503, address: 'Belek, Antalya' },
            'zeugma': { name: 'Papillon Zeugma Hotel', lat: 36.8626, lng: 31.0503, address: 'Belek, Antalya' },
            'ayscha': { name: 'Papillon Ayscha Hotel', lat: 36.4389, lng: 30.5961, address: 'Kemer, Antalya' }
        };
    }

    isLocationQuery(message) {
        const lowerMessage = message.toLowerCase();

        const travelPhrases = [ 'how far is', 'show me cafes', 'show me restaurants', 'any points of interest', 'wie weit ist', 'zeig mir cafés', 'gibt es interessante', 'как далеко', 'какие интересные', 'покажи мне кафе', 'есть ли интересные', 'places to visit', 'best places', 'things to do', 'tourist attractions', 'sightseeing', 'visit in', 'explore in', 'closest destination', 'nearest place', 'nearest attraction', 'distance from', 'how far', 'points of interest', 'best destinations', 'local attractions', 'spots to explore', 'places worth visiting', 'gezilecek yerler', 'görülecek yerler', 'yapılacak şeyler', 'turist yerleri', 'gezi yerleri', 'en yakın yer', 'mesafe ne kadar', 'ne kadar uzak', 'hangi mesafede', 'ilgi çekici yerler', 'sehenswürdigkeiten', 'touristenattraktionen', 'was zu besuchen', 'orte zu besuchen', 'interessante orte', 'beste orte', 'sehenswerte orte', 'nächste sehenswürdigkeit', 'lokale attraktionen', 'orte zum erkunden', 'besuchenswerte orte', 'nächstes ziel', 'interessante punkte', 'места для посещения', 'туристические места', 'достопримечательности для посещения', 'интересные места', 'лучшие места', 'достойные места', 'ближайшая достопримечательность', 'местные достопримечательности', 'места для изучения', 'стоящие места', 'ближайшее место', 'как далеко до', 'интересные точки' ];
        if (travelPhrases.some(phrase => lowerMessage.includes(phrase))) {
            console.log(`✈️ Backend: Travel phrase detected: "${message}" → true`);
            return true;
        }

        const locationIndicators = { 'tr': ['yakın', 'yakında', 'nerede', 'nasıl gidilir', 'mesafe', 'en yakın', 'çevredeki', 'çevrede', 'bu bölgedeki', 'bölgede'], 'en': ['near', 'nearby', 'where', 'how to get', 'distance', 'closest', 'nearest', 'show me', 'how far', 'close by', 'around here', 'around', 'within', 'accessible from', 'in the vicinity', 'vicinity', 'show'], 'de': ['in der nähe', 'wo', 'wie komme ich', 'entfernung', 'nächste', 'nah', 'zeig mir', 'zeigen', 'wie weit', 'in der nähe von', 'hier in der umgebung', 'umgebung', 'innerhalb', 'erreichbar von', 'in der gegend', 'ganz nah'], 'ru': ['рядом', 'где', 'как добраться', 'расстояние', 'ближайший', 'близко', 'покажи мне', 'показать', 'как далеко', 'поблизости от', 'здесь поблизости', 'окрестности', 'в пределах', 'доступно от', 'в районе', 'совсем близко'] };
        const placeTypes = {
            'tr': ['restoran', 'market', 'hastane', 'eczane', 'atm', 'banka', 'alışveriş', 'mall', 'avm', 'cafe', 'bar', 'plaj', 'müze', 'taksi', 'havaalanı',
                   'yer', 'yerler', 'mekan', 'mekanlar', 'lokasyon', 'lokasyonlar', 'destinasyon', 'destinasyonlar', 'cazibe', 'cazibe yeri', 'kafeler', 'plajlar',
                   'lunapark', 'aquapark', 'eğlence', 'eğlence merkezi', 'tema parkı', 'oyun parkı', 'macera parkı', 'su parkı', 'lokanta', 'ev yemekleri', 'şelale'],
            'en': ['restaurant', 'hospital', 'pharmacy', 'shopping', 'museum', 'supermarket', 'bank', 'cafe', 'bar', 'beach', 'taxi', 'airport',
                   'destination', 'destinations', 'place', 'places', 'location', 'locations', 'attraction', 'attractions', 'spot', 'spots', 'area', 'areas', 'interest', 'radius',
                   'amusement park', 'theme park', 'water park', 'entertainment', 'adventure park', 'fun park', 'arcade', 'waterfall'],
            'de': ['restaurant', 'krankenhaus', 'apotheke', 'einkaufen', 'supermarkt', 'bank', 'cafe', 'bar', 'strand', 'taxi', 'flughafen', 'museum', 'ort', 'orte', 'standort', 'sehenswürdigkeit', 'sehenswürdigkeiten', 'attraktionen', 'ziel', 'ziele', 'lage', 'lagen', 'attraktion', 'interesse', 'radius', 'cafés', 'strände', 'freizeitpark', 'themenpark', 'wasserpark', 'unterhaltung', 'abenteuerpark', 'vergnügungspark'],
            'ru': ['ресторан', 'больница', 'аптека', 'магазин', 'супермаркет', 'банк', 'кафе', 'бар', 'пляж', 'такси', 'аэропорт', 'музей', 'место', 'места', 'локация', 'достопримечательность', 'достопримечательности', 'назначение', 'пункт назначения', 'расположение', 'аттракция', 'интерес', 'радиус', 'пляжи', 'парк развлечений', 'тематический парк', 'аквапарк', 'развлечения', 'парк приключений']
        };
        const hotelQuestions = { 'tr': ['hangi restoran', 'otel restoran', 'kahvaltı', 'akşam yemeği', 'saat kaç', 'ne zaman', 'rezervasyon', 'tuvalet', 'wc', 'banyo', 'lavabo'], 'en': ['which restaurant', 'hotel restaurant', 'breakfast', 'dinner', 'what time', 'when', 'reservation', 'restroom', 'bathroom', 'toilet', 'washroom'], 'de': ['welches restaurant', 'hotel restaurant', 'frühstück', 'abendessen', 'wann', 'reservierung', 'toilette', 'bad', 'waschraum'], 'ru': ['какой ресторан', 'ресторан отеля', 'завтрак', 'ужин', 'во сколько', 'когда', 'бронирование', 'туалет', 'ванная', 'уборная'] };

        if (Object.values(hotelQuestions).some(questions => questions.some(q => lowerMessage.includes(q)))) {
            console.log(`🏨 Backend: Hotel context question detected: "${message}" → false`);
            return false;
        }

        let hasLocationIndicator = Object.values(locationIndicators).some(indicators => indicators.some(indicator => lowerMessage.includes(indicator)));
        let hasPlaceType = Object.values(placeTypes).some(types => types.some(type => lowerMessage.includes(type)));

        const isLocationQuery = hasLocationIndicator && hasPlaceType;
        console.log(`🔍 Backend location query check: "${message}" → ${isLocationQuery} (indicator: ${hasLocationIndicator}, place: ${hasPlaceType})`);
        return isLocationQuery;
    }

    getHotelLocation(hotelName = null) {
        if (!hotelName) return this.hotelLocations['belvil'];
        const hotel = hotelName.toLowerCase();
        if (hotel.includes('zeugma')) return this.hotelLocations['zeugma'];
        if (hotel.includes('ayscha')) return this.hotelLocations['ayscha'];
        return this.hotelLocations['belvil'];
    }

    async searchNearbyPlaces(query, hotelLocation, radius = 20000, language = 'tr') {
        try {
            const searchUrl = `${this.baseUrl}/nearbysearch/json`;
            let params = { location: `${hotelLocation.lat},${hotelLocation.lng}`, radius: radius, type: query, key: this.apiKey, language: language };
            console.log(`🌐 Places API URL: ${searchUrl}`);
            console.log(`📋 Places API params (type search):`, params);
            let response = await axios.get(searchUrl, { params });
            console.log(`📊 Places API response status: ${response.data.status}`);
            if (response.data.status === 'OK' && response.data.results.length > 0) {
                return response.data.results.slice(0, 5);
            }

            console.log(`🔄 Retrying with keyword search...`);
            params = { location: `${hotelLocation.lat},${hotelLocation.lng}`, radius: radius, keyword: `${query} ${hotelLocation.address}`, key: this.apiKey, language: language };
            console.log(`📋 Places API params (keyword search):`, params);
            response = await axios.get(searchUrl, { params });
            console.log(`📊 Places API response status (retry): ${response.data.status}`);
            if (response.data.status === 'OK') {
                return response.data.results.slice(0, 5);
            } else {
                console.warn(`⚠️ Places API returned status: ${response.data.status}`);
                if (response.data.error_message) console.warn(`⚠️ Error message: ${response.data.error_message}`);
                return [];
            }
        } catch (error) {
            console.error('❌ Places API error:', error.response?.data || error.message);
            return [];
        }
    }

    async getPlaceDetails(placeId, language = 'tr') {
        try {
            const params = { place_id: placeId, fields: 'name,formatted_address,formatted_phone_number,opening_hours,rating,website', key: this.apiKey, language: language };
            const response = await axios.get(`${this.baseUrl}/details/json`, { params });
            return response.data.status === 'OK' ? response.data.result : null;
        } catch (error) {
            console.error('Place details error:', error);
            return null;
        }
    }

    formatPlacesForAI(places, hotelLocation, language = 'tr') {
        const t = this.getTranslations(language);
        if (!places || places.length === 0) {
            return { text: t.noPlaces, list: [] };
        }

        const placesList = places.map(place => {
            const hours = place.opening_hours;
            const isOpen = hours ? (hours.open_now ? t.openNow : t.closed) : t.noHours;
            const rating = place.rating ? `${t.rating}: ${place.rating} / 5` : '';
            const placeLoc = place.geometry.location;
            const dist = this.getDistance(hotelLocation, { lat: placeLoc.lat, lng: placeLoc.lng });

            return { name: place.name, address: place.vicinity, rating: rating, open_now: isOpen, distance: `${(dist / 1000).toFixed(1)} km`, lat: placeLoc.lat, lng: placeLoc.lng };
        });

        const placesText = placesList.map(p => `- ${p.name} (${p.address}) - ${p.rating} - ${p.open_now}`).join('\n');
        return { text: `${t.nearbyPlaces}\n${placesText}`, list: placesList };
    }

    getDistance(loc1, loc2) {
        const R = 6371e3; // metres
        const lat1 = loc1.lat * Math.PI / 180;
        const lat2 = loc2.lat * Math.PI / 180;
        const deltaLat = (loc2.lat - loc1.lat) * Math.PI / 180;
        const deltaLng = (loc2.lng - loc1.lng) * Math.PI / 180;
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    async handleLocationQuery(userMessage, hotelContext = null, userLanguage = 'tr', userLocation = null) {
        const t = this.getTranslations(userLanguage);
        let searchLocation;

        if (userLocation && userLocation.lat && userLocation.lng) {
            searchLocation = userLocation;
            console.log(`📍 Using user's provided GPS location: (${userLocation.lat}, ${userLocation.lng})`);
        } else if (hotelContext) {
            searchLocation = this.getHotelLocation(hotelContext);
            console.log(`🏨 User location not available. Using hotel context: ${hotelContext}`);
        } else {
            console.log(`🤷 No location context. Asking user to specify hotel.`);
            return { success: true, response: t.askForHotel, placesData: null };
        }

        try {
            const searchQuery = this.extractSearchQuery(userMessage);
            console.log(`🔍 Search query extracted: "${searchQuery}" from "${userMessage}"`);
            const places = await this.searchNearbyPlaces(searchQuery, searchLocation, 20000, userLanguage);
            console.log(`📍 Found ${places.length} places from Google Places API`);
            const formattedPlaces = this.formatPlacesForAI(places, searchLocation, userLanguage);
            return {
                success: true,
                response: formattedPlaces.text,
                placesData: {
                    list: formattedPlaces.list,
                    searchQuery: searchQuery,
                    searchLocation: searchLocation
                }
            };
        } catch (error) {
            console.error('❌ Location query handling error:', error);
            return { success: false, response: t.error, placesData: null };
        }
    }

    extractSearchQuery(message) {
        const lowerMessage = message.toLowerCase();
        const placeTypes = { 'restoran': 'restaurant', 'market': 'supermarket', 'hastane': 'hospital', 'eczane': 'pharmacy', 'atm': 'atm', 'banka': 'bank', 'alışveriş': 'shopping_mall', 'avm': 'shopping_mall', 'mall': 'shopping_mall', 'cafe': 'cafe', 'bar': 'bar', 'plaj': 'beach', 'müze': 'museum', 'tarihi': 'tourist_attraction', 'taksi': 'taxi_stand', 'havaalanı': 'airport', 'araç kiralama': 'car_rental', 'lunapark': 'amusement_park', 'aquapark': 'water_park', 'eğlence': 'tourist_attraction', 'eğlence merkezi': 'amusement_park', 'tema parkı': 'amusement_park', 'oyun parkı': 'amusement_park', 'macera parkı': 'amusement_park', 'su parkı': 'water_park', 'restaurant': 'restaurant', 'supermarket': 'supermarket', 'hospital': 'hospital', 'pharmacy': 'pharmacy', 'bank': 'bank', 'shopping': 'shopping_mall', 'museum': 'museum', 'taxi': 'taxi_stand', 'airport': 'airport', 'rent a car': 'car_rental', 'car rental': 'car_rental', 'amusement park': 'amusement_park', 'theme park': 'amusement_park', 'water park': 'water_park', 'entertainment': 'tourist_attraction', 'adventure park': 'amusement_park', 'fun park': 'amusement_park', 'arcade': 'amusement_park', 'krankenhaus': 'hospital', 'apotheke': 'pharmacy', 'einkaufen': 'shopping_mall', 'geschäft': 'store', 'strand': 'beach', 'flughafen': 'airport', 'autovermietung': 'car_rental', 'freizeitpark': 'amusement_park', 'themenpark': 'amusement_park', 'wasserpark': 'water_park', 'unterhaltung': 'tourist_attraction', 'abenteuerpark': 'amusement_park', 'vergnügungspark': 'amusement_park', 'ресторан': 'restaurant', 'больница': 'hospital', 'аптека': 'pharmacy', 'супермаркет': 'supermarket', 'магазин': 'store', 'торговый центр': 'shopping_mall', 'кафе': 'cafe', 'бар': 'bar', 'пляж': 'beach', 'музей': 'museum', 'такси': 'taxi_stand', 'аэропорт': 'airport', 'аренда авто': 'car_rental', 'парк развлечений': 'amusement_park', 'тематический парк': 'amusement_park', 'аквапарк': 'water_park', 'развлечения': 'tourist_attraction', 'парк приключений': 'amusement_park' };
        for (const [localTerm, googleType] of Object.entries(placeTypes)) {
            if (lowerMessage.includes(localTerm)) return googleType;
        }
        return message.replace(/yakın|yakında|nerede|nasıl gidilir|mesafe|near|nearby|where|how to get|distance|in der nähe|wo|wie komme ich|entfernung|рядом|где|как добраться|расстояние/gi, '').trim() || 'hospital';
    }

    getTranslations(language = 'tr') {
        const translations = {
            'tr': { noPlaces: 'Yakında uygun yer bulunamadı.', nearbyPlaces: 'yakınındaki yerler:', rating: 'Değerlendirme', openNow: 'Şu an açık', closed: 'Şu an kapalı', noHours: 'Çalışma saati bilgisi yok', distance: 'Uzaklık', askForHotel: 'Elbette, konum tabanlı bir arama yapabilmem için hangi Papillon Oteli hakkında bilgi almak istediğinizi belirtir misiniz: Belvil, Zeugma veya Ayscha?', error: 'Konum bilgisi alınırken bir hata oluştu.' },
            'en': { noPlaces: 'No suitable places found nearby.', nearbyPlaces: 'places near you:', rating: 'Rating', openNow: 'Open now', closed: 'Currently closed', noHours: 'No opening hours information', distance: 'Distance', askForHotel: 'Of course, to perform a location-based search, could you please specify which Papillon Hotel you are interested in: Belvil, Zeugma, or Ayscha?', error: 'An error occurred while fetching location information.' },
            'de': { noPlaces: 'Keine passenden Orte in der Nähe gefunden.', nearbyPlaces: 'Orte in Ihrer Nähe:', rating: 'Bewertung', openNow: 'Jetzt geöffnet', closed: 'Derzeit geschlossen', noHours: 'Keine Informationen zu den Öffnungszeiten', distance: 'Entfernung', askForHotel: 'Natürlich, um eine standortbezogene Suche durchzuführen, könnten Sie bitte angeben, für welches Papillon Hotel Sie sich interessieren: Belvil, Zeugma oder Ayscha?', error: 'Beim Abrufen der Standortinformationen ist ein Fehler aufgetreten.' },
            'ru': { noPlaces: 'Поблизости не найдено подходящих мест.', nearbyPlaces: 'места рядом с вами:', rating: 'Рейтинг', openNow: 'Открыто сейчас', closed: 'Закрыто', noHours: 'Нет информации о часах работы', distance: 'Расстояние', askForHotel: 'Конечно, чтобы выполнить поиск по местоположению, не могли бы вы указать, какой отель Papillon вас интересует: Belvil, Zeugma или Ayscha?', error: 'Произошла ошибка при получении информации о местоположении.' }
        };
        return translations[language] || translations['tr'];
    }

    async isLocationQueryEnhanced(message, chatHistory = [], userLanguage = 'tr') {
        const keywordResult = this.isLocationQuery(message);
        if (keywordResult === true) {
            console.log(`⚡ Fast keyword detection: "${message}" → true`);
            return true;
        }

        const lowerMessage = message.toLowerCase();
        const hasBorderlineKeywords = ['nerede', 'ne kadar', 'nasıl', 'hangi', 'var mı', 'where', 'how far', 'any', 'which', 'are there', 'wo', 'wie weit', 'gibt es', 'welche', 'где', 'как далеко', 'есть ли', 'какие'].some(keyword => lowerMessage.includes(keyword));

        if (hasBorderlineKeywords) {
            console.log(`🤔 Borderline query detected, using AI: "${message}"`);
            const geminiService = require('./gemini');
            const historyWithCurrentMessage = [...chatHistory, { role: 'user', content: message }];
            const aiResult = await geminiService.isLocationQueryAI(message, historyWithCurrentMessage, userLanguage);
            console.log(`🧠 AI override result: "${message}" → ${aiResult}`);
            return aiResult;
        }

        console.log(`❌ Clear non-location query: "${message}" → false`);
        return false;
    }
}

module.exports = new PlacesService();