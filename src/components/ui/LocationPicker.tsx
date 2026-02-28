import { useState, useRef, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet internal paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationPickerProps {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
    height?: string;
}

const MADURAI_CENTER: [number, number] = [9.9252, 78.1198];

function LocationMarker({ position, setPosition, onChange }: {
    position: [number, number],
    setPosition: (p: [number, number]) => void,
    onChange: (lat: number, lng: number) => void
}) {
    const map = useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
            onChange(e.latlng.lat, e.latlng.lng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    const markerRef = useRef<L.Marker>(null);
    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    const pos = marker.getLatLng();
                    setPosition([pos.lat, pos.lng]);
                    onChange(pos.lat, pos.lng);
                }
            },
        }),
        [onChange, setPosition]
    );

    return position === null ? null : (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
        />
    );
}

export function LocationPicker({ lat, lng, onChange, height = '250px' }: LocationPickerProps) {
    const [position, setPosition] = useState<[number, number]>(
        (lat && lng) ? [lat, lng] : MADURAI_CENTER
    );

    // Sync from props if they change externally
    useEffect(() => {
        if (lat && lng && (lat !== position[0] || lng !== position[1])) {
            setPosition([lat, lng]);
        }
    }, [lat, lng]);

    return (
        <div style={{ height, width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-default)', zIndex: 1 }}>
            <MapContainer
                center={position}
                zoom={14}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker position={position} setPosition={setPosition} onChange={onChange} />
            </MapContainer>
            <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-card)', textAlign: 'center', borderTop: '1px solid var(--border-default)' }}>
                Drag pin or click on map to select precise location
            </div>
        </div>
    );
}
