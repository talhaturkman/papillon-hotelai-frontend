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

        // Define specific types for certain queries
        this.placeTypes = {
            // Food & Drink
            'restaurant': ['restaurant'],
            'cafe': ['cafe'],
            'bar': ['bar'],
            'dominos': ['restaurant'],

            // Entertainment
            'amusement_park': ['amusement_park', 'theme_park', 'water_park'],

            // Services
            'gas_station': ['gas_station'],
            'hospital': ['hospital'],
            'pharmacy': ['pharmacy'],
            'atm': ['atm'],
            'bank': ['bank'],

            // Shopping
            'convenience_store': ['convenience_store', 'store'],  // Add proper Google Places API type
            'supermarket': ['supermarket'],
            'shopping_mall': ['shopping_mall'],

            // Tourism & Recreation
            'beach': ['beach'],
            'museum': ['museum'],
            'tourist_attraction': ['tourist_attraction'],

            // Transportation
            'taxi_stand': ['taxi_stand'],
            'airport': ['airport'],
            'car_rental': ['car_rental'],
        };
    }

    isLocationQuery(message) {
        const lowerMessage = message.toLowerCase();
        
        const travelPhrases = [ 'how far is', 'show me cafes', 'show me restaurants', 'any points of interest', 'wie weit ist', 'zeig mir cafés', 'gibt es interessante', 'как далеко', 'какие интересные', 'покажи мне кафе', 'есть ли интересные', 'places to visit', 'best places', 'things to do', 'tourist attractions', 'sightseeing', 'visit in', 'explore in', 'closest destination', 'nearest place', 'nearest attraction', 'distance from', 'how far', 'points of interest', 'best destinations', 'local attractions', 'spots to explore', 'places worth visiting', 'gezilecek yerler', 'görülecek yerler', 'yapılacak şeyler', 'turist yerleri', 'gezi yerleri', 'en yakın yer', 'mesafe ne kadar', 'ne kadar uzak', 'hangi mesafede', 'ilgi çekici yerler', 'sehenswürdigkeiten', 'touristenattraktionen', 'was zu besuchen', 'orte zu besuchen', 'interessante orte', 'beste orte', 'sehenswerte orte', 'nächste sehenswürdigkeit', 'lokale attraktionen', 'orte zum erkunden', 'besuchenswerte orte', 'nächstes ziel', 'interessante punkte', 'места для посещения', 'туристические места', 'достопримечательности для посещения', 'интересные места', 'лучшие места', 'достойные места', 'ближайшая достопримечательность', 'местные достопримечательности', 'места для изучения', 'стоящие места', 'ближайшее место', 'как далеко до', 'интересные точки' ];
        if (travelPhrases.some(phrase => lowerMessage.includes(phrase))) {
            console.log(`✈️ Backend: Travel phrase detected: "${message}" → true`);
            return true;
        }
        
        const locationIndicators = { 
            'tr': ['yakın', 'yakında', 'nerede', 'nasıl gidilir', 'mesafe', 'en yakın', 'çevredeki', 'çevrede', 'bu bölgedeki', 'bölgede'], 
            'en': ['near', 'nearby', 'where', 'how to get', 'distance', 'closest', 'nearest', 'show me', 'how far', 'close by', 'around here', 'around', 'within', 'accessible from', 'in the vicinity', 'vicinity', 'show'], 
            'de': ['in der nähe', 'wo', 'wie komme ich', 'entfernung', 'nächste', 'nah', 'zeig mir', 'zeigen', 'wie weit', 'in der nähe von', 'hier in der umgebung', 'umgebung', 'innerhalb', 'erreichbar von', 'in der gegend', 'ganz nah'], 
            'ru': ['рядом', 'где', 'как добраться', 'расстояние', 'ближайший', 'близко', 'покажи мне', 'показать', 'как далеко', 'поблизости от', 'здесь поблизости', 'окрестности', 'в пределах', 'доступно от', 'в районе', 'совсем близко'] 
        };

        const placeTypes = {
            'tr': ['restoran', 'market', 'hastane', 'eczane', 'atm', 'banka', 'alışveriş', 'mall', 'avm', 'cafe', 'bar', 'plaj', 'müze', 'taksi', 'havaalanı',
                   'yer', 'yerler', 'mekan', 'mekanlar', 'lokasyon', 'lokasyonlar', 'destinasyon', 'destinasyonlar', 'cazibe', 'cazibe yeri', 'kafeler', 'plajlar',
                   'lunapark', 'aquapark', 'eğlence', 'eğlence merkezi', 'tema parkı', 'oyun parkı', 'macera parkı', 'su parkı', 'lokanta', 'ev yemekleri', 'şelale',
                   'benzin', 'benzin istasyonu', 'akaryakıt', 'petrol', 'opet', 'shell', 'bp'], // Added gas station keywords
            'en': ['restaurant', 'hospital', 'pharmacy', 'shopping', 'museum', 'supermarket', 'bank', 'cafe', 'bar', 'beach', 'taxi', 'airport',
                   'destination', 'destinations', 'place', 'places', 'location', 'locations', 'attraction', 'attractions', 'spot', 'spots', 'area', 'areas', 'interest', 'radius',
                   'amusement park', 'theme park', 'water park', 'entertainment', 'adventure park', 'fun park', 'arcade', 'waterfall',
                   'gas', 'gas station', 'fuel', 'petrol', 'petrol station'], // Added gas station keywords
            'de': ['restaurant', 'krankenhaus', 'apotheke', 'einkaufen', 'supermarkt', 'bank', 'cafe', 'bar', 'strand', 'taxi', 'flughafen', 'museum', 'ort', 'orte', 'standort', 'sehenswürdigkeit', 'sehenswürdigkeiten', 'attraktionen', 'ziel', 'ziele', 'lage', 'lagen', 'attraktion', 'interesse', 'radius', 'cafés', 'strände', 'freizeitpark', 'themenpark', 'wasserpark', 'unterhaltung', 'abenteuerpark', 'vergnügungspark',
                   'tankstelle', 'benzin'], // Added gas station keywords
            'ru': ['ресторан', 'больница', 'аптека', 'магазин', 'супермаркет', 'банк', 'кафе', 'бар', 'пляж', 'такси', 'аэропорт', 'музей', 'место', 'места', 'локация', 'достопримечательность', 'достопримечательности', 'назначение', 'пункт назначения', 'расположение', 'аттракция', 'интерес', 'радиус', 'пляжи', 'парк развлечений', 'тематический парк', 'аквапарк', 'развлечения', 'парк приключений',
                   'бензин', 'заправка', 'азс'] // Added gas station keywords
        };

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
            const types = this.placeTypes[query] || [query];
            let allResults = [];

            // Special case for specific brand searches
            const brandKeywords = {
                'dominos': 'Domino\'s Pizza',
                // Add other brand-specific searches here
            };

            // If it's a brand search, use keyword instead of type
            if (brandKeywords[query]) {
                console.log(`🏢 Brand-specific search for: ${brandKeywords[query]}`);
                const params = {
                    location: `${hotelLocation.lat},${hotelLocation.lng}`,
                    radius: radius,
                    keyword: brandKeywords[query],
                    key: this.apiKey,
                    language: language
                };

                const response = await axios.get(searchUrl, { params });
                if (response.data.status === 'OK' && response.data.results.length > 0) {
                    allResults.push(...response.data.results);
                }
            } else {
                // Standard type-based search
                for (const type of types) {
                    const params = {
                        location: `${hotelLocation.lat},${hotelLocation.lng}`,
                        radius: radius,
                        type: type,
                        key: this.apiKey,
                        language: language
                    };

                    console.log(`🌐 Places API URL: ${searchUrl}`);
                    console.log(`📋 Places API params:`, params);

                    const response = await axios.get(searchUrl, { params });
                    if (response.data.status === 'OK' && response.data.results.length > 0) {
                        allResults.push(...response.data.results);
                    }
                }
            }
            
            // If no results found, try keyword search
            if (allResults.length === 0) {
                console.log(`🔄 Retrying with keyword search...`);
                const params = {
                    location: `${hotelLocation.lat},${hotelLocation.lng}`,
                    radius: radius,
                    keyword: query,
                    key: this.apiKey,
                    language: language
                };

                const response = await axios.get(searchUrl, { params });
                if (response.data.status === 'OK') {
                    allResults.push(...response.data.results);
                }
            }

            // Remove duplicates and sort by distance
            const uniqueResults = this.removeDuplicatePlaces(allResults);
            
            // Format results with consistent structure
            const formattedResults = uniqueResults.map(place => {
                const location = place.geometry.location;
                const distance = this.getDistance(hotelLocation, { lat: location.lat, lng: location.lng });
                
                return {
                    name: place.name || '',
                    distance: (distance / 1000).toFixed(1),
                    lat: location.lat || 0,
                    lng: location.lng || 0,
                    rating: place.rating || 0,
                    vicinity: place.vicinity || '',
                    address: place.formatted_address || place.vicinity || ''
                };
            }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 5);

            return formattedResults;

        } catch (error) {
            console.error('❌ Places API error:', error.response?.data || error.message);
            return [];
        }
    }

    removeDuplicatePlaces(places) {
        const seen = new Set();
        return places.filter(place => {
            const key = place.place_id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    formatPlacesForAI(places, hotelLocation, language = 'tr') {
        const t = this.getTranslations(language);
        if (!places || !Array.isArray(places) || places.length === 0) {
            return { 
                text: t.noPlaces, 
                list: [] 
            };
        }

        const placesList = places.map(place => {
            // Handle cases where place might be already formatted
            if (place.distance && place.lat && place.lng) {
                return place;
            }

            // Handle raw Google Places API response
            const location = place.geometry?.location;
            if (!location) {
                console.warn('⚠️ Place without location:', place);
                return null;
            }

            const dist = this.getDistance(hotelLocation, { 
                lat: location.lat || place.lat, 
                lng: location.lng || place.lng 
            });
            const distance = (dist / 1000).toFixed(1);

            return {
                name: place.name || '',
                distance: distance,
                lat: location.lat || place.lat || 0,
                lng: location.lng || place.lng || 0,
                rating: place.rating || 0,
                vicinity: place.vicinity || '',
                address: place.formatted_address || place.vicinity || ''
            };
        }).filter(place => place !== null);

        // Sort by distance
        placesList.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        // Generate text response
        const responseLines = placesList.map(place => 
            `${place.name} (${place.distance} km)`
        );

        const text = `${t.foundPlaces}:\n\n${responseLines.join('\n')}`;

        return {
            text,
            list: placesList
        };
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
        
        // Define place type mappings with keywords
        const placeTypeMap = {
            // Food & Drink
            'restaurant': ['restaurant', 'restoran', 'dining', 'yemek', 'lokanta'],
            'cafe': ['cafe', 'kafe', 'coffee', 'kahve'],
            'bar': ['bar', 'pub', 'meyhane'],
            'dominos': ['dominos', 'pizza', 'domino'],

            // Entertainment
            'amusement_park': ['amusement park', 'theme park', 'water park', 'aquapark', 'lunapark', 
                             'eğlence parkı', 'tema parkı', 'su parkı', 'aquapark', 'vergnügungspark', 
                             'freizeitpark', 'wasserpark', 'парк развлечений', 'аквапарк'],

            // Services
            'gas_station': ['gas', 'petrol', 'benzin', 'fuel', 'akaryakıt', 'opet', 'shell', 'bp', 
                          'tankstelle', 'бензин', 'заправка', 'азс'],
            'hospital': ['hospital', 'hastane', 'medical', 'krankenhaus', 'больница'],
            'pharmacy': ['pharmacy', 'eczane', 'apotheke', 'аптека'],
            'atm': ['atm', 'банкомат'],
            'bank': ['bank', 'banka', 'банк'],

            // Shopping
            'convenience_store': ['bakkal', 'market', 'büfe', 'tekel', 'şarküteri'],  // Add Turkish terms for small shops
            'supermarket': ['supermarket', 'grocery', 'market', 'супермаркет'],
            'shopping_mall': ['mall', 'shopping', 'avm', 'alışveriş', 'einkaufen', 'торговый центр'],

            // Tourism & Recreation
            'beach': ['beach', 'plaj', 'strand', 'пляж'],
            'museum': ['museum', 'müze', 'музей'],
            'tourist_attraction': ['tourist', 'attraction', 'sight', 'достопримечательность'],

            // Transportation
            'taxi_stand': ['taxi', 'taksi', 'такси'],
            'airport': ['airport', 'havaalanı', 'flughafen', 'аэропорт'],
            'car_rental': ['rent a car', 'car rental', 'araç kiralama', 'autovermietung', 'аренда авто']
        };

        // Check each place type's keywords
        for (const [placeType, keywords] of Object.entries(placeTypeMap)) {
            if (keywords.some(keyword => lowerMessage.includes(keyword))) {
                console.log(`🔍 Place type detected: "${placeType}" from keywords: ${keywords.join(', ')}`);
                return placeType;
            }
        }

        // If no specific type is found, check for generic location indicators
        const locationWords = ['near', 'nearby', 'closest', 'nearest', 'where', 'yakın', 'yakında', 'nerede', 
                             'en yakın', 'nähe', 'nächste', 'wo', 'рядом', 'ближайший', 'где'];
        
        if (locationWords.some(word => lowerMessage.includes(word))) {
            // Default to tourist_attraction for generic location queries
            console.log('🔍 No specific place type found, using tourist_attraction as default');
            return 'tourist_attraction';
        }

        // If nothing matches, return tourist_attraction as a safe default
        return 'tourist_attraction';
    }

    getTranslations(language = 'tr') {
        const translations = {
            'tr': { noPlaces: 'Yakında uygun yer bulunamadı.', nearbyPlaces: 'yakınındaki yerler:', rating: 'Değerlendirme', openNow: 'Şu an açık', closed: 'Şu an kapalı', noHours: 'Çalışma saati bilgisi yok', distance: 'Uzaklık', askForHotel: 'Elbette, konum tabanlı bir arama yapabilmem için hangi Papillon Oteli hakkında bilgi almak istediğinizi belirtir misiniz: Belvil, Zeugma veya Ayscha?', error: 'Konum bilgisi alınırken bir hata oluştu.', foundPlaces: 'Bulunan yerler:' },
            'en': { noPlaces: 'No suitable places found nearby.', nearbyPlaces: 'places near you:', rating: 'Rating', openNow: 'Open now', closed: 'Currently closed', noHours: 'No opening hours information', distance: 'Distance', askForHotel: 'Of course, to perform a location-based search, could you please specify which Papillon Hotel you are interested in: Belvil, Zeugma, or Ayscha?', error: 'An error occurred while fetching location information.', foundPlaces: 'Found places:' },
            'de': { noPlaces: 'Keine passenden Orte in der Nähe gefunden.', nearbyPlaces: 'Orte in Ihrer Nähe:', rating: 'Bewertung', openNow: 'Jetzt geöffnet', closed: 'Derzeit geschlossen', noHours: 'Keine Informationen zu den Öffnungszeiten', distance: 'Entfernung', askForHotel: 'Natürlich, um eine standortbezogene Suche durchzuführen, könnten Sie bitte angeben, für welches Papillon Hotel Sie sich interessieren: Belvil, Zeugma oder Ayscha?', error: 'Beim Abrufen der Standortinformationen ist ein Fehler aufgetreten.', foundPlaces: 'Gefundene Orte:' },
            'ru': { noPlaces: 'Поблизости не найдено подходящих мест.', nearbyPlaces: 'места рядом с вами:', rating: 'Рейтинг', openNow: 'Открыто сейчас', closed: 'Закрыто', noHours: 'Нет информации о часах работы', distance: 'Расстояние', askForHotel: 'Конечно, чтобы выполнить поиск по местоположению, не могли бы вы указать, какой отель Papillon вас интересует: Belvil, Zeugma или Ayscha?', error: 'Произошла ошибка при получении информации о местоположении.', foundPlaces: 'Найденные места:' }
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
            
            // First, check if the user is asking about hotel facilities
            const isHotelQuery = await geminiService.isHotelFacilityQuery(message, chatHistory, userLanguage);
            if (isHotelQuery) {
                console.log(`🏨 Hotel facility query detected, not treating as location query`);
                return false;
            }

            // If not a hotel query, proceed with location query check
            const historyWithCurrentMessage = [...chatHistory, { role: 'user', content: message }];
            const aiResult = await geminiService.isLocationQueryAI(message, historyWithCurrentMessage, userLanguage);
            console.log(`🧠 AI override result: "${message}" → ${aiResult}`);
            return aiResult;
        }
        
        return false;
    }

    getNearestHotel(userLocation) {
        if (!userLocation || !userLocation.lat || !userLocation.lng) {
            console.log('⚠️ Invalid user location provided');
            return null;
        }

        let nearestHotel = null;
        let shortestDistance = Infinity;

        for (const [hotelName, hotelData] of Object.entries(this.hotelLocations)) {
            const distance = this.getDistance(
                { lat: userLocation.lat, lng: userLocation.lng },
                { lat: hotelData.lat, lng: hotelData.lng }
            );

            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestHotel = hotelName.charAt(0).toUpperCase() + hotelName.slice(1);
            }
        }

        // Only return hotel if within 2km radius (2000 meters)
        if (shortestDistance <= 2000) {
            console.log(`✅ Found nearest hotel: ${nearestHotel} (${shortestDistance.toFixed(0)}m away)`);
            return nearestHotel;
        } else {
            console.log(`⚠️ No hotels within 2km radius (nearest: ${nearestHotel}, ${(shortestDistance/1000).toFixed(1)}km away)`);
            return null;
        }
    }
}

module.exports = new PlacesService();