import React, { useState } from 'react';

function LocationPermission({ onLocationReceived, onLocationDenied }) {
    const [isRequesting, setIsRequesting] = useState(false);
    const [error, setError] = useState('');
    const [showHotelSelect, setShowHotelSelect] = useState(false);

    const hotelLocations = {
        'belvil': {
            name: 'Papillon Belvil',
            lat: 36.8626,
            lng: 31.0503,
            isHotelLocation: true
        },
        'zeugma': {
            name: 'Papillon Zeugma',
            lat: 36.8626,
            lng: 31.0503,
            isHotelLocation: true
        },
        'ayscha': {
            name: 'Papillon Ayscha',
            lat: 36.4389,
            lng: 30.5961,
            isHotelLocation: true
        }
    };

    const requestLocation = () => {
        setIsRequesting(true);
        setError('');
        setShowHotelSelect(false);

        console.log('🔍 Checking geolocation support and security context...');
        console.log('📍 HTTPS:', window.location.protocol === 'https:');
        console.log('📍 Localhost:', window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        console.log('📍 Geolocation available:', !!navigator.geolocation);

        if (!navigator.geolocation) {
            const errorMsg = 'Bu tarayıcı konum hizmetlerini desteklemiyor.';
            console.error('❌ Geolocation not supported');
            setError(errorMsg);
            setIsRequesting(false);
            onLocationDenied('Tarayıcı desteği yok');
            return;
        }

        // Check if we're on HTTPS or localhost
        const isSecureContext = window.location.protocol === 'https:' || 
                              window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1';
        
        if (!isSecureContext) {
            const errorMsg = 'Konum servisleri sadece güvenli bağlantılarda (HTTPS) çalışır.';
            console.error('❌ Not secure context');
            setError(errorMsg);
            setIsRequesting(false);
            onLocationDenied('Güvenli bağlantı gerekli');
            return;
        }

        console.log('✅ Requesting geolocation...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                console.log('📍 User location received:', location);
                setIsRequesting(false);
                onLocationReceived(location);
            },
            (error) => {
                console.warn('❌ Geolocation error:', error);
                console.warn('❌ Error code:', error.code);
                console.warn('❌ Error message:', error.message);
                setIsRequesting(false);
                
                let errorMessage = '';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini kontrol edin.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Konum bilgisi alınamadı. GPS aktif mi kontrol edin.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Konum alma zaman aşımı. Tekrar deneyin.';
                        break;
                    default:
                        errorMessage = `Bilinmeyen hata (${error.code}): ${error.message}`;
                        break;
                }
                
                setError(errorMessage);
                onLocationDenied(errorMessage);
            },
            {
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 600000
            }
        );
    };

    const handleHotelSelect = (hotelKey) => {
        const selectedHotel = hotelLocations[hotelKey];
        console.log('📍 Using selected hotel location:', selectedHotel);
        setShowHotelSelect(false);
        onLocationReceived(selectedHotel);
    };

    return (
        <div style={{
            padding: '1rem',
            margin: '1rem 0',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            backgroundColor: '#f8f9fa',
            textAlign: 'center'
        }}>
            <div style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
            }}>
                📍
            </div>
            
            <h3 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.1rem',
                color: '#2c3e50'
            }}>
                Daha Doğru Sonuçlar İçin
            </h3>
            
            <p style={{
                margin: '0 0 1rem 0',
                fontSize: '0.9rem',
                color: '#666',
                lineHeight: '1.4'
            }}>
                Konumunuzu paylaşırsanız, size en yakın yerleri bulabilirim.
            </p>
            
            {error && (
                <div style={{
                    padding: '0.5rem',
                    marginBottom: '1rem',
                    borderRadius: '6px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    fontSize: '0.85rem'
                }}>
                    {error}
                </div>
            )}

            {!showHotelSelect ? (
                <>
                    <button
                        onClick={requestLocation}
                        disabled={isRequesting}
                        style={{
                            padding: '0.8rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: isRequesting ? '#ccc' : '#4285f4',
                            color: 'white',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: isRequesting ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                            marginRight: '0.5rem'
                        }}
                    >
                        {isRequesting ? 'Konum Alınıyor...' : 'Konumumu Paylaş'}
                    </button>
                    
                    <button
                        onClick={() => setShowHotelSelect(true)}
                        disabled={isRequesting}
                        style={{
                            padding: '0.8rem 1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            backgroundColor: '#f8f9fa',
                            color: '#666',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        Otel Konumunu Kullan
                    </button>
                </>
            ) : (
                <div style={{ marginTop: '1rem' }}>
                    <p style={{
                        margin: '0 0 1rem 0',
                        fontSize: '0.9rem',
                        color: '#666'
                    }}>
                        Lütfen kaldığınız oteli seçin:
                    </p>
                    {Object.entries(hotelLocations).map(([key, hotel]) => (
                        <button
                            key={key}
                            onClick={() => handleHotelSelect(key)}
                            style={{
                                padding: '0.8rem 1.5rem',
                                margin: '0.25rem',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                backgroundColor: '#fff',
                                color: '#2c3e50',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                display: 'block',
                                width: '100%'
                            }}
                        >
                            {hotel.name}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowHotelSelect(false)}
                        style={{
                            padding: '0.5rem',
                            marginTop: '0.5rem',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#666',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        ← Geri
                    </button>
                </div>
            )}
        </div>
    );
}

export default LocationPermission;
