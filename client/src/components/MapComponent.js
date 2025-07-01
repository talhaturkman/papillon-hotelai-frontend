import React from 'react';

function MapComponent({ placesData }) {
    console.log('🗺️ MapComponent received:', placesData);

    if (!placesData || !placesData.list || placesData.list.length === 0) {
        return null;
    }

    const { list, searchQuery, searchLocation } = placesData;

    const createMapUrl = () => {
        const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.error("Google Maps API Key is missing.");
            return "about:blank";
        }

        const baseUrl = 'https://www.google.com/maps/embed/v1/search';
        
        const center = `${searchLocation.lat},${searchLocation.lng}`;
        
        // Use the original search query (e.g., "pharmacy") and the location address for the search
        const query = encodeURIComponent(`${searchQuery} near ${searchLocation.address || 'Antalya'}`);
        
        const fullUrl = `${baseUrl}?key=${apiKey}&q=${query}&center=${center}&zoom=13`;
        
        console.log('🗺️ Map Search URL:', fullUrl);
        return fullUrl;
    };

    return (
        <div style={{
            margin: '1rem 0',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #e0e0e0',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            height: '350px'
        }}>
            <div style={{ 
                width: '100%', 
                height: '100%',
                position: 'relative',
                backgroundColor: '#f0f0f0'
            }}>
                <iframe
                    src={createMapUrl()}
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Yakındaki Yerler Haritası"
                />
            </div>
        </div>
    );
}

export default MapComponent; 