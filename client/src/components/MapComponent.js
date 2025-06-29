import React from 'react';

function MapComponent({ placesData }) {
    console.log('🗺️ MapComponent received:', placesData);

    // Don't render if no placesData or not a location query
    if (!placesData || !placesData.isLocationQuery) {
        console.log('❌ No places data or not a location query');
        return null;
    }

    const { hotelLocation, userQuery, searchQuery, hasPlaces } = placesData;

    // If no hotel location, can't show map
    if (!hotelLocation) {
        console.log('❌ No hotel location for map');
        return null;
    }

    // Create Google Maps embed URL with search
    const createMapUrl = () => {
        const baseUrl = 'https://www.google.com/maps/embed/v1/search';
        const apiKey = 'AIzaSyBiqxFAooCoJX1y-_IgDbVAtoaZ2SVKmxk';
        
        // Use hotel location as center
        const center = `${hotelLocation.lat},${hotelLocation.lng}`;
        
        // Create clean search query
        const searchTerm = searchQuery || 'hospital';
        
        // For user location, use just the search term without "near" clause
        let query;
        if (hotelLocation.name.includes('Bölgesi') || hotelLocation.name.includes('Konumunuz')) {
            query = encodeURIComponent(searchTerm);
        } else {
            query = encodeURIComponent(`${searchTerm} near ${hotelLocation.address}`);
        }
        
        const fullUrl = `${baseUrl}?key=${apiKey}&q=${query}&center=${center}&zoom=13&maptype=roadmap`;
        
        console.log('🗺️ Map URL:', fullUrl);
        return fullUrl;
    };

    return (
        <div style={{
            margin: '1rem 0',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #e0e0e0',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
            {/* Header */}
            <div style={{
                padding: '0.8rem 1rem',
                background: 'linear-gradient(135deg, #4285f4, #34a853)',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <span>🗺️</span>
                <span>Google Haritalar</span>
            </div>
            
            {/* Map */}
            <div style={{ 
                width: '100%', 
                height: '300px',
                position: 'relative',
                backgroundColor: '#f0f0f0'
            }}>
                <iframe
                    src={createMapUrl()}
                    width="100%"
                    height="100%"
                    style={{
                        border: 'none',
                        display: 'block'
                    }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Yakındaki Yerler Haritası"
                    onLoad={() => console.log('✅ Map loaded successfully')}
                    onError={(e) => console.error('❌ Map load error:', e)}
                />
            </div>
            
            {/* Footer */}
            <div style={{
                padding: '0.8rem 1rem',
                background: '#f8f9fa',
                borderTop: '1px solid #e0e0e0',
                fontSize: '0.8rem',
                color: '#666',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
            }}>
                <span>📍</span>
                <span>
                    {hasPlaces 
                        ? `${hotelLocation?.name || 'Otel'} yakınındaki sonuçlar` 
                        : `${hotelLocation?.name || 'Otel'} çevresinde arama yapılıyor...`
                    }
                </span>
            </div>
        </div>
    );
}

export default MapComponent; 