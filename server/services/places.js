const axios = require('axios');

class PlacesService {
    constructor() {
        this.apiKey = process.env.GOOGLE_CLOUD_API_KEY;
        this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
        
        // Papillon Hotels coordinates (correct locations)
        this.hotelLocations = {
            'belvil': {
                name: 'Papillon Belvil Hotel',
                lat: 36.8626,
                lng: 31.0503,
                address: 'Belek, Antalya'
            },
            'zeugma': {
                name: 'Papillon Zeugma Hotel', 
                lat: 36.8626,
                lng: 31.0503,
                address: 'Belek, Antalya'
            },
            'ayscha': {
                name: 'Papillon Ayscha Hotel',
                lat: 36.4389,
                lng: 30.5961,
                address: 'Kemer, Antalya'
            }
        };
    }

    // Detect if user question is location-based (4 languages)
    isLocationQuery(message) {
        const lowerMessage = message.toLowerCase();
        
        // Travel/tourism specific phrases that are always location-based
        const travelPhrases = [
            // SPECIFIC PHRASES FIRST (to avoid partial matches)
            'how far is', 'show me cafes', 'show me restaurants', 'any points of interest',
            'wie weit ist', 'zeig mir cafés', 'gibt es interessante',
            'как далеко', 'какие интересные', 'покажи мне кафе', 'есть ли интересные',
            // THEN GENERAL PHRASES
            // English
            'places to visit', 'best places', 'things to do', 'tourist attractions', 'sightseeing', 'visit in', 'explore in',
            'closest destination', 'nearest place', 'nearest attraction', 'distance from', 'how far', 'points of interest',
            'best destinations', 'local attractions', 'spots to explore', 'places worth visiting',
            // Turkish
            'gezilecek yerler', 'görülecek yerler', 'yapılacak şeyler', 'turist yerleri', 'gezi yerleri', 'en yakın yer',
            'mesafe ne kadar', 'ne kadar uzak', 'hangi mesafede', 'ilgi çekici yerler',
            // German
            'sehenswürdigkeiten', 'touristenattraktionen', 'was zu besuchen', 'orte zu besuchen', 'interessante orte', 'beste orte', 
            'sehenswerte orte', 'nächste sehenswürdigkeit', 'lokale attraktionen', 'orte zum erkunden', 'besuchenswerte orte',
            'nächstes ziel', 'interessante punkte',
            // Russian
            'места для посещения', 'туристические места', 'достопримечательности для посещения', 'интересные места', 'лучшие места',
            'достойные места', 'ближайшая достопримечательность', 'местные достопримечательности', 'места для изучения', 'стоящие места',
            'ближайшее место', 'как далеко до', 'интересные точки'
        ];

        // Check for travel phrases (always location-based)
        const hasTravelPhrase = travelPhrases.some(phrase => lowerMessage.includes(phrase));
        if (hasTravelPhrase) {
            console.log(`✈️ Backend: Travel phrase detected: "${message}" → true`);
            return true;
        }
        
        // Location indicators - words that indicate looking for nearby places
        const locationIndicators = {
            'tr': ['yakın', 'yakında', 'nerede', 'nasıl gidilir', 'mesafe', 'en yakın', 'çevredeki', 'çevrede', 'bu bölgedeki', 'bölgede'],
            'en': ['near', 'nearby', 'where', 'how to get', 'distance', 'closest', 'nearest', 'show me', 'how far', 'close by', 'around here', 'around', 'within', 'accessible from', 'in the vicinity', 'vicinity', 'show'],
            'de': ['in der nähe', 'wo', 'wie komme ich', 'entfernung', 'nächste', 'nah', 'zeig mir', 'zeigen', 'wie weit', 'in der nähe von', 'hier in der umgebung', 'umgebung', 'innerhalb', 'erreichbar von', 'in der gegend', 'ganz nah'],
            'ru': ['рядом', 'где', 'как добраться', 'расстояние', 'ближайший', 'близко', 'покажи мне', 'показать', 'как далеко', 'поблизости от', 'здесь поблизости', 'окрестности', 'в пределах', 'доступно от', 'в районе', 'совсем близко']
        };
        
        // Place types - what they might be looking for
        const placeTypes = {
            'tr': ['restoran', 'market', 'hastane', 'eczane', 'atm', 'banka', 'alışveriş', 'mall', 'avm', 'cafe', 'bar', 'plaj', 'müze', 'taksi', 'havaalanı',
                   'yer', 'yerler', 'mekan', 'mekanlar', 'lokasyon', 'lokasyonlar', 'destinasyon', 'destinasyonlar', 'cazibe', 'cazibe yeri', 'kafeler', 'plajlar',
                   'lunapark', 'aquapark', 'eğlence', 'eğlence merkezi', 'tema parkı', 'oyun parkı', 'macera parkı', 'su parkı'],
            'en': ['restaurant', 'hospital', 'pharmacy', 'shopping', 'museum', 'supermarket', 'bank', 'cafe', 'bar', 'beach', 'taxi', 'airport',
                   'destination', 'destinations', 'place', 'places', 'location', 'locations', 'attraction', 'attractions', 'spot', 'spots', 'area', 'areas', 'interest', 'radius',
                   'amusement park', 'theme park', 'water park', 'entertainment', 'adventure park', 'fun park', 'arcade'],
            'de': ['restaurant', 'krankenhaus', 'apotheke', 'einkaufen', 'supermarkt', 'bank', 'cafe', 'bar', 'strand', 'taxi', 'flughafen', 'museum',
                   'ort', 'orte', 'standort', 'sehenswürdigkeit', 'sehenswürdigkeiten', 'attraktionen', 'ziel', 'ziele', 'lage', 'lagen', 'attraktion', 'interesse', 'radius', 'cafés', 'strände',
                   'freizeitpark', 'themenpark', 'wasserpark', 'unterhaltung', 'abenteuerpark', 'vergnügungspark'],
            'ru': ['ресторан', 'больница', 'аптека', 'магазин', 'супермаркет', 'банк', 'кафе', 'бар', 'пляж', 'такси', 'аэропорт', 'музей',
                   'место', 'места', 'локация', 'достопримечательность', 'достопримечательности', 'назначение', 'пункт назначения', 'расположение', 'аттракция', 'интерес', 'радиус', 'пляжи',
                   'парк развлечений', 'тематический парк', 'аквапарк', 'развлечения', 'парк приключений']
        };
        
        // Hotel context questions (NOT location queries)
        const hotelQuestions = {
            'tr': ['hangi restoran', 'otel restoran', 'kahvaltı', 'akşam yemeği', 'saat kaç', 'ne zaman', 'rezervasyon', 'tuvalet', 'wc', 'banyo', 'lavabo'],
            'en': ['which restaurant', 'hotel restaurant', 'breakfast', 'dinner', 'what time', 'when', 'reservation', 'restroom', 'bathroom', 'toilet', 'washroom'],
            'de': ['welches restaurant', 'hotel restaurant', 'frühstück', 'abendessen', 'wann', 'reservierung', 'toilette', 'bad', 'waschraum'],
            'ru': ['какой ресторан', 'ресторан отеля', 'завтрак', 'ужин', 'во сколько', 'когда', 'бронирование', 'туалет', 'ванная', 'уборная']
        };
        
        // Check if this is a hotel context question (NOT a location query)
        for (const questions of Object.values(hotelQuestions)) {
            if (questions.some(q => lowerMessage.includes(q))) {
                console.log(`🏨 Backend: Hotel context question detected: "${message}" → false`);
                return false;
            }
        }
        
        // Check for location indicators
        let hasLocationIndicator = false;
        for (const indicators of Object.values(locationIndicators)) {
            if (indicators.some(indicator => lowerMessage.includes(indicator))) {
                hasLocationIndicator = true;
                break;
            }
        }
        
        // Check for place types
        let hasPlaceType = false;
        for (const types of Object.values(placeTypes)) {
            if (types.some(type => lowerMessage.includes(type))) {
                hasPlaceType = true;
                break;
            }
        }
        
        // Location query = has both location indicator AND place type
        const isLocationQuery = hasLocationIndicator && hasPlaceType;
        
        console.log(`🔍 Backend location query check: "${message}" → ${isLocationQuery} (indicator: ${hasLocationIndicator}, place: ${hasPlaceType})`);
        return isLocationQuery;
    }

    // Get hotel coordinates based on context
    getHotelLocation(hotelName = null) {
        if (!hotelName) return this.hotelLocations['belvil']; // Default to Belvil
        
        const hotel = hotelName.toLowerCase();
        if (hotel.includes('zeugma')) return this.hotelLocations['zeugma'];
        if (hotel.includes('ayscha')) return this.hotelLocations['ayscha'];
        return this.hotelLocations['belvil'];
    }

    // Search nearby places
    async searchNearbyPlaces(query, hotelLocation, radius = 20000, language = 'tr') {
        try {
            const searchUrl = `${this.baseUrl}/nearbysearch/json`;
            
            // First try with specific type
            let params = {
                location: `${hotelLocation.lat},${hotelLocation.lng}`,
                radius: radius,
                type: query, // Use 'type' instead of 'keyword' for better results
                key: this.apiKey,
                language: language
            };

            console.log(`🌐 Places API URL: ${searchUrl}`);
            console.log(`📋 Places API params (type search):`, params);

            let response = await axios.get(searchUrl, { params });
            console.log(`📊 Places API response status: ${response.data.status}`);
            
            if (response.data.status === 'OK' && response.data.results.length > 0) {
                const results = response.data.results.slice(0, 5);
                console.log(`✅ Places API success: ${results.length} results found`);
                return results;
            }
            
            // If type search fails, try keyword search with broader term
            console.log(`🔄 Retrying with keyword search...`);
            params = {
                location: `${hotelLocation.lat},${hotelLocation.lng}`,
                radius: radius,
                keyword: `${query} ${hotelLocation.address}`, // Include location in keyword
                key: this.apiKey,
                language: language
            };

            console.log(`📋 Places API params (keyword search):`, params);
            response = await axios.get(searchUrl, { params });
            console.log(`📊 Places API response status (retry): ${response.data.status}`);
            
            if (response.data.status === 'OK') {
                const results = response.data.results.slice(0, 5);
                console.log(`✅ Places API success (retry): ${results.length} results found`);
                return results;
            } else {
                console.warn(`⚠️ Places API returned status: ${response.data.status}`);
                if (response.data.error_message) {
                    console.warn(`⚠️ Error message: ${response.data.error_message}`);
                }
                
                // Final fallback: search in nearest major city (Antalya)
                console.log(`🏙️ Final fallback: searching in Antalya city center...`);
                const antalyaParams = {
                    location: '36.8969,30.7133', // Antalya city center
                    radius: 50000, // 50km radius
                    type: query,
                    key: this.apiKey,
                    language: language
                };
                
                try {
                    const fallbackResponse = await axios.get(searchUrl, { params: antalyaParams });
                    if (fallbackResponse.data.status === 'OK' && fallbackResponse.data.results.length > 0) {
                        const results = fallbackResponse.data.results.slice(0, 3); // Fewer results for fallback
                        console.log(`✅ Fallback search success: ${results.length} results found in Antalya`);
                        return results;
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback search failed:', fallbackError.message);
                }
                
                return [];
            }
        } catch (error) {
            console.error('❌ Places API error:', error.response?.data || error.message);
            return [];
        }
    }

    // Get place details
    async getPlaceDetails(placeId, language = 'tr') {
        try {
            const detailsUrl = `${this.baseUrl}/details/json`;
            
            const params = {
                place_id: placeId,
                fields: 'name,formatted_address,formatted_phone_number,opening_hours,rating,website',
                key: this.apiKey,
                language: language
            };

            const response = await axios.get(detailsUrl, { params });
            
            if (response.data.status === 'OK') {
                return response.data.result;
            }
            
            return null;
        } catch (error) {
            console.error('Place details error:', error);
            return null;
        }
    }

    // Format places data for AI context (multilingual)
    formatPlacesForAI(places, hotelLocation, language = 'tr') {
        const translations = {
            'tr': {
                noPlaces: 'Yakında uygun yer bulunamadı.',
                nearbyPlaces: 'yakınındaki yerler:',
                address: 'Adres:',
                rating: 'Puan:',
                price: 'Fiyat:',
                status: 'Durum:',
                open: 'Açık',
                closed: 'Kapalı'
            },
            'en': {
                noPlaces: 'No suitable places found nearby.',
                nearbyPlaces: 'nearby places:',
                address: 'Address:',
                rating: 'Rating:',
                price: 'Price:',
                status: 'Status:',
                open: 'Open',
                closed: 'Closed'
            },
            'de': {
                noPlaces: 'Keine geeigneten Orte in der Nähe gefunden.',
                nearbyPlaces: 'nahegelegene Orte:',
                address: 'Adresse:',
                rating: 'Bewertung:',
                price: 'Preis:',
                status: 'Status:',
                open: 'Geöffnet',
                closed: 'Geschlossen'
            },
            'ru': {
                noPlaces: 'Поблизости не найдено подходящих мест.',
                nearbyPlaces: 'места поблизости:',
                address: 'Адрес:',
                rating: 'Рейтинг:',
                price: 'Цена:',
                status: 'Статус:',
                open: 'Открыто',
                closed: 'Закрыто'
            }
        };

        const t = translations[language] || translations['tr'];
        
        if (!places || places.length === 0) {
            return t.noPlaces;
        }

        let formattedText = `${hotelLocation.name} ${t.nearbyPlaces}\n\n`;
        
        places.forEach((place, index) => {
            formattedText += `${index + 1}. **${place.name}**\n`;
            formattedText += `   - ${t.address} ${place.vicinity}\n`;
            
            if (place.rating) {
                formattedText += `   - ${t.rating} ${place.rating}/5\n`;
            }
            
            if (place.price_level) {
                const priceSymbol = language === 'tr' ? '₺' : '$';
                const priceText = priceSymbol.repeat(place.price_level);
                formattedText += `   - ${t.price} ${priceText}\n`;
            }
            
            if (place.opening_hours?.open_now !== undefined) {
                const statusText = place.opening_hours.open_now ? t.open : t.closed;
                formattedText += `   - ${t.status} ${statusText}\n`;
            }
            
            formattedText += '\n';
        });

        return formattedText;
    }

    // Main function to handle location queries
    async handleLocationQuery(userMessage, hotelContext = null, userLanguage = 'tr', userLocation = null) {
        try {
            // Determine search location: user location > hotel location
            let searchLocation;
            let locationContext;

            if (userLocation && userLocation.lat && userLocation.lng) {
                // Determine region name based on coordinates
                let regionName = 'Konumunuz';
                let regionAddress = 'Bulunduğunuz bölge';
                
                // Check which region user is in (approximate)
                const userLat = userLocation.lat;
                const userLng = userLocation.lng;
                
                if (userLat >= 36.8 && userLat <= 36.9 && userLng >= 30.9 && userLng <= 31.1) {
                    regionName = 'Belek Bölgesi';
                    regionAddress = 'Belek, Antalya';
                } else if (userLat >= 36.4 && userLat <= 36.7 && userLng >= 30.5 && userLng <= 30.7) {
                    regionName = 'Kemer Bölgesi';
                    regionAddress = 'Kemer, Antalya';
                } else if (userLat >= 36.8 && userLat <= 37.0 && userLng >= 30.6 && userLng <= 30.8) {
                    regionName = 'Antalya Merkez';
                    regionAddress = 'Antalya Merkez';
                } else {
                    regionName = 'Antalya Bölgesi';
                    regionAddress = 'Antalya çevresi';
                }
                
                searchLocation = {
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    name: regionName,
                    address: regionAddress
                };
                locationContext = 'user';
                console.log(`📍 Using user location: ${regionName} (${searchLocation.lat}, ${searchLocation.lng})`);
            } else {
                searchLocation = this.getHotelLocation(hotelContext);
                locationContext = 'hotel';
                console.log(`🏨 Using hotel location: ${searchLocation.name} (${searchLocation.lat}, ${searchLocation.lng})`);
            }
            
            // Extract search query from user message
            let searchQuery = this.extractSearchQuery(userMessage);
            console.log(`🔍 Search query extracted: "${searchQuery}" from "${userMessage}"`);
            
            // Search nearby places (increased radius for better results)
            const places = await this.searchNearbyPlaces(searchQuery, searchLocation, 20000, userLanguage);
            console.log(`📍 Found ${places.length} places from Places API`);
            
            // Format for AI
            const formattedPlaces = this.formatPlacesForAI(places, searchLocation, userLanguage);
            
            return {
                hasResults: places.length > 0,
                placesData: formattedPlaces,
                hotelLocation: searchLocation,
                rawPlaces: places, // Include raw places data for map
                searchQuery: searchQuery,
                locationContext: locationContext // 'user' or 'hotel'
            };
            
        } catch (error) {
            console.error('Location query error:', error);
            
            // Error messages in different languages
            const errorMessages = {
                'tr': 'Konum bilgisi alınırken bir hata oluştu.',
                'en': 'An error occurred while fetching location information.',
                'de': 'Beim Abrufen der Standortinformationen ist ein Fehler aufgetreten.',
                'ru': 'Произошла ошибка при получении информации о местоположении.'
            };
            
            return {
                hasResults: false,
                placesData: errorMessages[userLanguage] || errorMessages['tr'],
                hotelLocation: null
            };
        }
    }

    // Extract search query from user message (4 languages)
    extractSearchQuery(message) {
        const lowerMessage = message.toLowerCase();
        
        // Multi-language place types mapping to Google Places API types
        const placeTypes = {
            // Turkish
            'restoran': 'restaurant',
            'market': 'supermarket',
            'hastane': 'hospital', 
            'eczane': 'pharmacy',
            'atm': 'atm',
            'banka': 'bank',
            'alışveriş': 'shopping_mall',
            'avm': 'shopping_mall',
            'mall': 'shopping_mall',
            'cafe': 'cafe',
            'bar': 'bar',
            'plaj': 'beach',
            'müze': 'museum',
            'tarihi': 'tourist_attraction',
            'taksi': 'taxi_stand',
            'havaalanı': 'airport',
            'araç kiralama': 'car_rental',
            // ENTERTAINMENT PLACES - Turkish
            'lunapark': 'amusement_park',
            'aquapark': 'water_park',
            'eğlence': 'tourist_attraction',
            'eğlence merkezi': 'amusement_park',
            'tema parkı': 'amusement_park',
            'oyun parkı': 'amusement_park',
            'macera parkı': 'amusement_park',
            'su parkı': 'water_park',
            
            // English
            'restaurant': 'restaurant',
            'supermarket': 'supermarket',
            'hospital': 'hospital',
            'pharmacy': 'pharmacy',
            'bank': 'bank',
            'shopping': 'shopping_mall',
            'mall': 'shopping_mall',
            'cafe': 'cafe',
            'bar': 'bar',
            'beach': 'beach',
            'museum': 'museum',
            'taxi': 'taxi_stand',
            'airport': 'airport',
            'rent a car': 'car_rental',
            'car rental': 'car_rental',
            // ENTERTAINMENT PLACES - English
            'amusement park': 'amusement_park',
            'theme park': 'amusement_park',
            'water park': 'water_park',
            'entertainment': 'tourist_attraction',
            'adventure park': 'amusement_park',
            'fun park': 'amusement_park',
            'arcade': 'amusement_park',
            
            // German
            'restaurant': 'restaurant',
            'krankenhaus': 'hospital',
            'apotheke': 'pharmacy',
            'supermarkt': 'supermarket',
            'bank': 'bank',
            'einkaufen': 'shopping_mall',
            'geschäft': 'store',
            'cafe': 'cafe',
            'bar': 'bar',
            'strand': 'beach',
            'museum': 'museum',
            'taxi': 'taxi_stand',
            'flughafen': 'airport',
            'autovermietung': 'car_rental',
            // ENTERTAINMENT PLACES - German
            'freizeitpark': 'amusement_park',
            'themenpark': 'amusement_park',
            'wasserpark': 'water_park',
            'unterhaltung': 'tourist_attraction',
            'abenteuerpark': 'amusement_park',
            'vergnügungspark': 'amusement_park',
            
            // Russian
            'ресторан': 'restaurant',
            'больница': 'hospital',
            'аптека': 'pharmacy',
            'супермаркет': 'supermarket',
            'магазин': 'store',
            'банк': 'bank',
            'торговый центр': 'shopping_mall',
            'кафе': 'cafe',
            'бар': 'bar',
            'пляж': 'beach',
            'музей': 'museum',
            'такси': 'taxi_stand',
            'аэропорт': 'airport',
            'аренда авто': 'car_rental',
            // ENTERTAINMENT PLACES - Russian
            'парк развлечений': 'amusement_park',
            'тематический парк': 'amusement_park',
            'аквапарк': 'water_park',
            'развлечения': 'tourist_attraction',
            'парк приключений': 'amusement_park'
        };
        
        // Find matching place type
        for (const [localTerm, googleType] of Object.entries(placeTypes)) {
            if (lowerMessage.includes(localTerm)) {
                return googleType;
            }
        }
        
        // If only hotel name mentioned, default to hospital (most common query)
        if (lowerMessage.includes('belvil') || lowerMessage.includes('zeugma') || lowerMessage.includes('ayscha')) {
            return 'hospital';
        }
        
        // If no specific type found, clean and return general search term
        return message
            .replace(/yakın|yakında|nerede|nasıl gidilir|mesafe/gi, '') // Turkish
            .replace(/near|nearby|where|how to get|distance/gi, '') // English
            .replace(/in der nähe|wo|wie komme ich|entfernung/gi, '') // German
            .replace(/рядом|где|как добраться|расстояние/gi, '') // Russian
            .trim() || 'hospital'; // Default to hospital if empty
    }

    // Enhanced location query detection with AI fallback
    async isLocationQueryEnhanced(message, chatHistory = [], userLanguage = 'tr') {
        // First try fast keyword-based detection
        const keywordResult = this.isLocationQuery(message);
        
        // If keyword detection is confident (clear YES), use it
        if (keywordResult === true) {
            console.log(`⚡ Fast keyword detection: "${message}" → true`);
            return true;
        }
        
        // If keyword detection says NO but message seems borderline, use AI
        const lowerMessage = message.toLowerCase();
        const hasBorderlineKeywords = [
            // Borderline Turkish
            'nerede', 'ne kadar', 'nasıl', 'hangi', 'var mı',
            // Borderline English  
            'where', 'how far', 'any', 'which', 'are there',
            // Borderline German
            'wo', 'wie weit', 'gibt es', 'welche',
            // Borderline Russian
            'где', 'как далеко', 'есть ли', 'какие'
        ].some(keyword => lowerMessage.includes(keyword));
        
        if (hasBorderlineKeywords) {
            console.log(`🤔 Borderline query detected, using AI: "${message}"`);
            const geminiService = require('./gemini');
            const aiResult = await geminiService.detectLocationQuery(message, chatHistory, userLanguage);
            console.log(`🧠 AI override result: "${message}" → ${aiResult}`);
            return aiResult;
        }
        
        // Clear non-location query
        console.log(`❌ Clear non-location query: "${message}" → false`);
        return false;
    }
}

module.exports = new PlacesService(); 