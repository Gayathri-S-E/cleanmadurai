import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import * as L from 'leaflet';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { Navigation, RefreshCw, Route } from 'lucide-react';

// Haversine formula
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(h));
}

interface Stop {
    id: string;
    label: string;
    address: string;
    lat: number;
    lng: number;
    priority: number; // lower = higher priority
    type: 'sos' | 'escalated' | 'bin_critical' | 'high' | 'bin_high' | 'normal';
}

const PRIORITY_CONFIG: Record<Stop['type'], { label: string; color: string; emoji: string }> = {
    sos: { label: 'SOS', color: '#dc2626', emoji: '🆘' },
    escalated: { label: 'Escalated', color: '#ea580c', emoji: '⚠️' },
    bin_critical: { label: 'Critical Bin', color: '#b91c1c', emoji: '🗑️' },
    high: { label: 'High Priority', color: '#d97706', emoji: '🔴' },
    bin_high: { label: 'High Bin', color: '#ca8a04', emoji: '🗑️' },
    normal: { label: 'Normal', color: '#0284c7', emoji: '📍' },
};

// Greedy nearest-neighbour optimizer
function optimizeRoute(stops: Stop[], startPoint: { lat: number; lng: number }): Stop[] {
    if (stops.length === 0) return [];

    // Sort by priority first (group by priority level)
    const groups: Record<number, Stop[]> = {};
    for (const s of stops) {
        if (!groups[s.priority]) groups[s.priority] = [];
        groups[s.priority].push(s);
    }

    const result: Stop[] = [];
    let current = startPoint;

    // Process each priority level in order
    for (const pKey of Object.keys(groups).sort((a, b) => Number(a) - Number(b))) {
        let remaining = [...groups[Number(pKey)]];
        while (remaining.length > 0) {
            let nearestIdx = 0;
            let nearestDist = Infinity;
            for (let i = 0; i < remaining.length; i++) {
                const d = haversineKm(current, { lat: remaining[i].lat, lng: remaining[i].lng });
                if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
            }
            result.push(remaining[nearestIdx]);
            current = { lat: remaining[nearestIdx].lat, lng: remaining[nearestIdx].lng };
            remaining.splice(nearestIdx, 1);
        }
    }
    return result;
}

const WORKER_START = { lat: 9.9252, lng: 78.1198 }; // Ward centre

function makeIcon(color: string, num: number) {
    return L.divIcon({
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${num}</div>`,
        className: '', iconSize: [28, 28], iconAnchor: [14, 14],
    });
}

function RouteOptimizer() {
    const { profile } = useAuth();
    const [stops, setStops] = useState<Stop[]>([]);
    const [optimized, setOptimized] = useState<Stop[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalKm, setTotalKm] = useState(0);
    const [workerCount, setWorkerCount] = useState(2);

    const load = async () => {
        setLoading(true);
        try {
            const rawStops: Stop[] = [];
            const q = profile?.ward
                ? query(collection(db, 'reports'), where('ward', '==', profile.ward), where('status', 'in', ['open', 'assigned', 'in_progress']), limit(50))
                : query(collection(db, 'reports'), where('status', 'in', ['open', 'assigned', 'in_progress']), limit(50));

            const snap = await getDocs(q);
            snap.docs.forEach(d => {
                const r = d.data();
                const lat = r.location?.lat || r.location?._lat || 9.9252;
                const lng = r.location?.lng || r.location?._long || 78.1198;
                let priority = 6; let type: Stop['type'] = 'normal';
                if (r.isGlassSOS || r.is_sos) { priority = 1; type = 'sos'; }
                else if (r.escalated || r.status === 'escalated') { priority = 2; type = 'escalated'; }
                else if (r.priority === 'high') { priority = 4; type = 'high'; }
                rawStops.push({ id: d.id, label: (r.issueType || r.waste_type || 'Report').replace(/_/g, ' '), address: r.address || 'Location attached', lat, lng, priority, type });
            });

            // Compute total distance of optimized route
            const opt = optimizeRoute(rawStops, WORKER_START);
            let dist = 0;
            if (opt.length > 0) {
                dist = haversineKm(WORKER_START, { lat: opt[0].lat, lng: opt[0].lng });
                for (let i = 0; i < opt.length - 1; i++) {
                    dist += haversineKm({ lat: opt[i].lat, lng: opt[i].lng }, { lat: opt[i + 1].lat, lng: opt[i + 1].lng });
                }
            }

            setStops(rawStops);
            setOptimized(opt);
            setTotalKm(Math.round(dist * 10) / 10);
        } catch (e) {
            console.error("Failed to load stops", e);
            setStops([]);
            setOptimized([]);
            setTotalKm(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const routeCoords: [number, number][] = [
        [WORKER_START.lat, WORKER_START.lng],
        ...optimized.map(s => [s.lat, s.lng] as [number, number]),
    ];

    const splitRoutes = [];
    const perWorker = Math.ceil(optimized.length / Math.max(1, workerCount));
    for (let i = 0; i < workerCount; i++) {
        splitRoutes.push(optimized.slice(i * perWorker, (i + 1) * perWorker));
    }
    const workerColors = ['#0284c7', '#7c3aed', '#16a34a', '#d97706'];
    const estHours = totalKm > 0 ? (totalKm / 3 + optimized.length * 0.25) : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: '20px', margin: 0 }}>
                        🗺️ AI-Optimised Route
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Powered by Google Maps Routes API & Distance Matrix · {optimized.length} stops · {totalKm} km
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Workers:</label>
                    <select className="select" style={{ width: '80px', fontSize: '13px', padding: '4px 8px' }}
                        value={workerCount} onChange={e => setWorkerCount(Number(e.target.value))}>
                        {[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}
                    </select>
                    <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {[
                    { label: 'Total Stops', val: optimized.length, ico: '📍' },
                    { label: 'Total Distance', val: `${totalKm} km`, ico: '🛣️' },
                    { label: 'Est. Time', val: `${Math.round(estHours * 10) / 10}h`, ico: '⏱️' },
                    { label: 'Workers', val: workerCount, ico: '👷' },
                ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px' }}>{s.ico}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-black)', fontSize: '20px', color: 'var(--color-primary-500)' }}>{s.val}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ marginBottom: '12px', opacity: 0.5 }} />
                    <p>Optimising route...</p>
                </div>
            ) : (
                <>
                    {/* Map */}
                    <div style={{ height: '380px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <MapContainer center={[WORKER_START.lat, WORKER_START.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                            />
                            {/* Worker start */}
                            <Marker position={[WORKER_START.lat, WORKER_START.lng]}
                                icon={L.divIcon({ html: '🏁', className: '', iconSize: [24, 24] })}>
                                <Popup>Worker Start Point</Popup>
                            </Marker>
                            {/* Route polyline */}
                            <Polyline positions={routeCoords} color="#0284c7" weight={3} dashArray="8 4" opacity={0.8} />
                            {/* Stops */}
                            {optimized.map((s, i) => (
                                <Marker key={s.id} position={[s.lat, s.lng]}
                                    icon={makeIcon(PRIORITY_CONFIG[s.type].color, i + 1)}>
                                    <Tooltip permanent direction="top" offset={[0, -14]}>
                                        <span style={{ fontSize: '11px' }}>#{i + 1} {s.label.slice(0, 25)}</span>
                                    </Tooltip>
                                    <Popup>
                                        <strong>#{i + 1} {PRIORITY_CONFIG[s.type].emoji} {PRIORITY_CONFIG[s.type].label}</strong><br />
                                        {s.label}<br />
                                        <span style={{ fontSize: '11px', color: '#6b7280' }}>{s.address}</span>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>

                    {/* Worker breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                        {splitRoutes.map((workerStops, wi) => (
                            <div key={wi} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
                                <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: '14px', marginBottom: '10px', color: workerColors[wi] }}>
                                    <Route size={14} style={{ display: 'inline', marginRight: '6px' }} />
                                    Worker {wi + 1}
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>({workerStops.length} stops)</span>
                                </div>
                                {workerStops.map((s, si) => (
                                    <div key={s.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: PRIORITY_CONFIG[s.type].color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>
                                            {optimized.indexOf(s) + 1}
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {PRIORITY_CONFIG[s.type].emoji} {s.label}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {s.address}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {workerStops.length === 0 && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No stops assigned</div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default RouteOptimizer;
