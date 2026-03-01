import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';

// Fix Leaflet icons just in case it's used elsewhere, though we use CircleMarker
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface BlockData {
    id: string;
    lat: number;
    lng: number;
    score: number;
    name: string;
}

const MADURAI_CENTER: [number, number] = [9.9252, 78.1198];

function getScoreColor(score: number) {
    if (score >= 80) return '#10B981'; // Green
    if (score >= 50) return '#F59E0B'; // Yellow/Orange
    return '#EF4444'; // Red
}

export default function HeatmapOverview() {
    const [blocks, setBlocks] = useState<BlockData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHeatmapData() {
            setLoading(true);
            try {
                // Fetch blocks to render their areas based on cleanliness score
                const snap = await getDocs(query(collection(db, 'blocks'), limit(200)));
                const data: BlockData[] = [];
                snap.forEach(d => {
                    const b = d.data();
                    if (b.location?.lat && b.location?.lng) {
                        data.push({
                            id: d.id,
                            lat: b.location.lat,
                            lng: b.location.lng,
                            score: b.cleanliness_score || 0,
                            name: b.name || 'Unnamed Block'
                        });
                    }
                });

                // If there are no blocks, let's at least show some dummy data for visualization
                if (data.length === 0) {
                    data.push(
                        { id: '1', lat: 9.9302, lng: 78.1221, score: 35, name: 'Madurai Junction Area' },
                        { id: '2', lat: 9.9196, lng: 78.1194, score: 92, name: 'Meenakshi Temple Zone' },
                        { id: '3', lat: 9.9421, lng: 78.0987, score: 65, name: 'KK Nagar Area' },
                        { id: '4', lat: 9.9091, lng: 78.1195, score: 45, name: 'Goripalayam' },
                        { id: '5', lat: 9.9510, lng: 78.1350, score: 85, name: 'Mattuthavani' }
                    );
                }

                setBlocks(data);
            } catch (err) {
                console.error("Heatmap fetch error:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchHeatmapData();
    }, []);

    if (loading) {
        return <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)' }}>Loading map data...</div>;
    }

    return (
        <div style={{ height: 400, borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-default)', position: 'relative', zIndex: 1 }}>
            <MapContainer center={MADURAI_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                />

                {blocks.map(b => (
                    <CircleMarker
                        key={b.id}
                        center={[b.lat, b.lng]}
                        radius={25}
                        pathOptions={{
                            fillColor: getScoreColor(b.score),
                            color: getScoreColor(b.score),
                            weight: 1,
                            fillOpacity: 0.4
                        }}
                    >
                        <Popup>
                            <div style={{ padding: '4px' }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontFamily: 'var(--font-display)' }}>{b.name}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cleanliness Score:</span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        color: getScoreColor(b.score),
                                        background: getScoreColor(b.score) + '22',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                    }}>
                                        {b.score}/100
                                    </span>
                                </div>
                            </div>
                        </Popup>
                    </CircleMarker>
                ))}
            </MapContainer>

            {/* Legend inside the map overlay */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                background: 'var(--bg-card)',
                padding: '12px',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 1000,
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Cleanliness Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }}></div>
                    <span>80 - 100 (Clean)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }}></div>
                    <span>50 - 79 (Moderate)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }}></div>
                    <span>0 - 49 (Needs Attention)</span>
                </div>
            </div>
        </div>
    );
}
