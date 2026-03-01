import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, limit, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, CircleMarker } from 'react-leaflet';
import * as L from 'leaflet';
import toast from 'react-hot-toast';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { AlertTriangle, Trash2, RefreshCw, Clock, MapPin, Map, List, Plus, Users } from 'lucide-react';

/* ─── Interfaces ─────────────────────────────────────────────────── */
interface BinData {
    id: string;
    bin_id: string;
    ward_id: string;
    address: string;
    type: string;
    size_litres: number;
    overflow_count_today: number;
    last_inspected_at: any;
    location?: { lat: number; lng: number };
    is_active: boolean;
    fill_percentage: number;
    overflow_in_hours: number;
    overflow_risk: 'low' | 'medium' | 'high' | 'critical';
}

interface AISuggestion {
    lat: number;
    lng: number;
    weight: number;        // number of reports in cluster
    description: string;
    newestReportAge: number; // hours since newest report in cluster
    risk: 'critical' | 'high';
}

interface CitizenRequest {
    id: string;
    lat: number;
    lng: number;
    address: string;
    binType: string;
    reason: string;
    requesterName: string;
    status: string;
    createdAt: any;
}

const CENTER = { lat: 9.9252, lng: 78.1198 };

/* ─── Overflow prediction formula ─────────────────────────────────── */
function computeBinOverflow(bin: any, now: Date): { fill: number; hours: number; risk: 'low' | 'medium' | 'high' | 'critical' } {
    const sizeLitres = bin.size_litres || 120;
    const base = sizeLitres / 24;
    const isWeekend = [0, 6].includes(now.getDay());
    const hour = now.getHours();
    const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    const isMarket = (bin.waste_dna_profile === 'market_signature') || (bin.type === 'market');
    const overflowToday = bin.overflow_count_today || 0;
    let rate = base;
    if (isWeekend) rate *= 1.5;
    if (bin.festival_zone_active) rate *= 2.0;
    if (isMarket) rate *= 1.3;
    if (isPeak) rate *= 1.2;
    rate *= (1 + overflowToday * 0.1);
    const lastInspected = bin.last_inspected_at?.toDate?.() || new Date(now.getTime() - 6 * 3600000);
    const hoursSinceLast = Math.max(0, (now.getTime() - lastInspected.getTime()) / 3600000);
    const currentFill = Math.min(rate * hoursSinceLast, sizeLitres);
    const fillPct = Math.min((currentFill / sizeLitres) * 100, 100);
    const hoursLeft = Math.max(0, (sizeLitres - currentFill) / rate);
    let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (hoursLeft < 2) risk = 'critical';
    else if (hoursLeft < 6) risk = 'high';
    else if (hoursLeft < 12) risk = 'medium';
    return { fill: Math.round(fillPct), hours: Math.round(hoursLeft * 10) / 10, risk };
}

/* ─── Color helpers ─────────────────────────────────────────────── */
const RISK_COLOR: Record<string, string> = {
    critical: '#dc2626', high: '#d97706', medium: '#ca8a04', low: '#16a34a',
};
const RISK_BG: Record<string, string> = {
    critical: 'rgba(220,38,38,0.08)', high: 'rgba(217,119,6,0.08)',
    medium: 'rgba(202,138,4,0.08)', low: 'rgba(22,163,74,0.06)',
};

// AI suggestion color based on waste age (how fresh reports are)
function suggestionColor(ageHours: number): string {
    if (ageHours < 6) return '#dc2626';    // Very fresh → urgent red
    if (ageHours < 24) return '#d97706';   // Today → orange
    if (ageHours < 72) return '#ca8a04';   // Last 3 days → amber
    return '#7c3aed';                       // Older → purple
}

/* ─── Map icon factories ─────────────────────────────────────────── */
function pinIcon(color: string, emoji: string, size = 28) {
    return L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.5)}px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${emoji}</div>`,
        className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2]
    });
}
const BIN_ICONS = {
    critical: pinIcon(RISK_COLOR.critical, '🗑️'),
    high: pinIcon(RISK_COLOR.high, '🗑️'),
    medium: pinIcon(RISK_COLOR.medium, '🗑️'),
    low: pinIcon(RISK_COLOR.low, '🗑️'),
};
const CITIZEN_ICON = pinIcon('#ea580c', '🙋', 30);

/* ─── Component ──────────────────────────────────────────────────── */
function BinOverflowPanel() {
    const { profile } = useAuth();
    const [bins, setBins] = useState<BinData[]>([]);
    const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
    const [citizenRequests, setCitizenRequests] = useState<CitizenRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [viewMode, setViewMode] = useState<'list' | 'map'>('map');

    // Deploy modal state
    const [deployTarget, setDeployTarget] = useState<{ lat: number; lng: number; description: string; requestId?: string } | null>(null);
    const [newBinType, setNewBinType] = useState('mixed');
    const [newBinSize, setNewBinSize] = useState(120);

    const computeAll = (rawBins: any[]) => {
        const now = new Date();
        return rawBins.map(b => {
            const { fill, hours, risk } = computeBinOverflow(b, now);
            return { ...b, fill_percentage: fill, overflow_in_hours: hours, overflow_risk: risk } as BinData;
        }).sort((a, b) => {
            const order = { critical: 4, high: 3, medium: 2, low: 1 };
            return (order[b.overflow_risk] || 0) - (order[a.overflow_risk] || 0);
        });
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // 1) Load existing bins
            let rawBins: any[] = [];
            try {
                const q = profile?.ward
                    ? query(collection(db, 'bins'), where('ward_id', '==', profile.ward), limit(50))
                    : query(collection(db, 'bins'), limit(50));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    rawBins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                } else {
                    // AUTO-SEED if DB is globally empty
                    const globalSnap = await getDocs(query(collection(db, 'bins'), limit(1)));
                    if (globalSnap.empty) {
                        console.log('Seeding initial bins...');
                        const mockBins = [
                            { bin_id: 'BIN-MDU-1001', address: 'Meenakshi Temple North Gate, Madurai', ward_id: 'ward_42', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'good', overflow_count_today: 3, location: { lat: 9.9196, lng: 78.1194 }, is_active: true, last_inspected_at: new Date(Date.now() - 7 * 3600000) },
                            { bin_id: 'BIN-MDU-1002', address: 'Madurai Junction, Railway Station Road', ward_id: 'ward_38', type: 'plastic', size_litres: 120, color_code: 'blue', condition: 'fair', overflow_count_today: 5, location: { lat: 9.9302, lng: 78.1221 }, is_active: true, last_inspected_at: new Date(Date.now() - 10 * 3600000) },
                            { bin_id: 'BIN-MDU-1003', address: 'Anna Nagar Market, Madurai', ward_id: 'ward_15', type: 'market', size_litres: 600, color_code: 'gray', condition: 'good', overflow_count_today: 8, location: { lat: 9.9350, lng: 78.1050 }, is_active: true, last_inspected_at: new Date(Date.now() - 12 * 3600000) },
                            { bin_id: 'BIN-MDU-1004', address: 'Goripalayam Bus Stand, Madurai', ward_id: 'ward_5', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'good', overflow_count_today: 1, location: { lat: 9.9091, lng: 78.1195 }, is_active: true, last_inspected_at: new Date(Date.now() - 2 * 3600000) },
                            { bin_id: 'BIN-MDU-1005', address: 'Koodal Azhagar Temple Street', ward_id: 'ward_22', type: 'organic', size_litres: 120, color_code: 'green', condition: 'good', overflow_count_today: 0, location: { lat: 9.9261, lng: 78.1108 }, is_active: true, last_inspected_at: new Date(Date.now() - 1 * 3600000) },
                            { bin_id: 'BIN-MDU-1006', address: 'Arumuga Mangalam Road, Tallakulam', ward_id: 'ward_18', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'fair', overflow_count_today: 6, location: { lat: 9.9370, lng: 78.1290 }, is_active: true, last_inspected_at: new Date(Date.now() - 14 * 3600000) },
                            { bin_id: 'BIN-MDU-1007', address: 'KK Nagar Main Road, Madurai', ward_id: 'ward_31', type: 'plastic', size_litres: 120, color_code: 'blue', condition: 'good', overflow_count_today: 2, location: { lat: 9.9421, lng: 78.0987 }, is_active: true, last_inspected_at: new Date(Date.now() - 3 * 3600000) },
                            { bin_id: 'BIN-MDU-1008', address: 'Mattuthavani Bus Stand', ward_id: 'ward_44', type: 'market', size_litres: 600, color_code: 'gray', condition: 'good', overflow_count_today: 7, location: { lat: 9.9510, lng: 78.1350 }, is_active: true, last_inspected_at: new Date(Date.now() - 13 * 3600000) },
                            { bin_id: 'BIN-MDU-1009', address: 'Thiruparankundram Temple Road', ward_id: 'ward_7', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'good', overflow_count_today: 0, location: { lat: 9.8951, lng: 78.0904 }, is_active: true, last_inspected_at: new Date(Date.now() - 0.5 * 3600000) },
                            { bin_id: 'BIN-MDU-1010', address: 'Simmakal, Vaigai Bridge Area', ward_id: 'ward_36', type: 'organic', size_litres: 120, color_code: 'green', condition: 'good', overflow_count_today: 4, location: { lat: 9.9155, lng: 78.1285 }, is_active: true, last_inspected_at: new Date(Date.now() - 9 * 3600000) }
                        ];
                        for (const b of mockBins) {
                            try {
                                const docRef = await addDoc(collection(db, 'bins'), b);
                                rawBins.push({ id: docRef.id, ...b });
                            } catch (e) { console.error('Seed err', e); }
                        }
                        toast.success('Seeded 10 demo bins!');
                    }
                }
            } catch { /* catch empty */ }
            setBins(computeAll(rawBins));

            // 2) Load recent reports → compute AI suggestions
            try {
                const rq = profile?.ward
                    ? query(collection(db, 'reports'), where('ward', '==', profile.ward), limit(100))
                    : query(collection(db, 'reports'), limit(100));
                const rSnap = await getDocs(rq);
                if (!rSnap.empty) {
                    computeAiSuggestions(rSnap.docs.map(d => d.data()), rawBins);
                } else {
                    setAiSuggestions([]);
                }
            } catch { setAiSuggestions([]); }

            // 3) Load citizen bin requests
            try {
                const cq = profile?.ward
                    ? query(collection(db, 'bin_requests'), where('ward', '==', profile.ward), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(50))
                    : query(collection(db, 'bin_requests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(50));
                const cSnap = await getDocs(cq);
                if (!cSnap.empty) {
                    setCitizenRequests(cSnap.docs.map(d => {
                        const data = d.data();
                        return {
                            id: d.id,
                            lat: data.location?.lat || 0,
                            lng: data.location?.lng || 0,
                            address: data.address || '',
                            binType: data.binType || 'mixed',
                            reason: data.reason || '',
                            requesterName: data.requesterName || 'Citizen',
                            status: data.status,
                            createdAt: data.createdAt,
                        };
                    }).filter(r => r.lat && r.lng));
                } else {
                    setCitizenRequests([]);
                }
            } catch { setCitizenRequests([]); }

        } catch (e) {
            console.error('loadData error', e);
        } finally {
            setLoading(false);
            setLastRefresh(new Date());
        }
    };

    useEffect(() => { loadData(); }, []);

    const computeAiSuggestions = (repData: any[], binData: any[]) => {
        const validReports = repData.filter(r =>
            r.location && (r.location.lat || r.location._lat) && (r.location.lng || r.location._long)
        ).map(r => ({
            ...r,
            lat: r.location.lat || r.location._lat,
            lng: r.location.lng || r.location._long,
            createdAt: r.createdAt?.toDate?.() || new Date(),
        }));

        const clusters: any[][] = [];
        validReports.forEach(report => {
            let added = false;
            for (const cluster of clusters) {
                const c = cluster[0];
                if (Math.abs(c.lat - report.lat) < 0.005 && Math.abs(c.lng - report.lng) < 0.005) {
                    cluster.push(report);
                    added = true;
                    break;
                }
            }
            if (!added) clusters.push([report]);
        });

        const suggestions: AISuggestion[] = [];
        const now = new Date();

        clusters.forEach(cluster => {
            if (cluster.length >= 2) {
                const avgLat = cluster.reduce((s: number, r: any) => s + r.lat, 0) / cluster.length;
                const avgLng = cluster.reduce((s: number, r: any) => s + r.lng, 0) / cluster.length;
                const isBinNearby = binData.some(b => {
                    if (!b.location) return false;
                    return Math.abs(b.location.lat - avgLat) < 0.002 && Math.abs(b.location.lng - avgLng) < 0.002;
                });
                if (!isBinNearby) {
                    // Age = hours since the NEWEST report in this cluster
                    const newestMs = Math.max(...cluster.map((r: any) => r.createdAt?.getTime?.() || 0));
                    const ageHours = newestMs > 0 ? (now.getTime() - newestMs) / 3600000 : 999;
                    suggestions.push({
                        lat: avgLat,
                        lng: avgLng,
                        weight: cluster.length,
                        description: `AI Hotspot: ${cluster.length} waste reports clustered here. No monitored bin within 200m.`,
                        newestReportAge: ageHours,
                        risk: cluster.length > 4 ? 'critical' : 'high',
                    });
                }
            }
        });

        setAiSuggestions(suggestions);
    };

    const handleDeployBin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deployTarget) return;
        try {
            const newBin = {
                bin_id: `BIN-MDU-${Math.floor(Math.random() * 9000) + 1000}`,
                ward_id: profile?.ward || 'ward_central',
                address: deployTarget.description.slice(0, 60) || 'Newly Deployed Location',
                type: newBinType,
                size_litres: newBinSize,
                color_code: newBinType === 'organic' ? 'green' : newBinType === 'plastic' ? 'blue' : 'gray',
                condition: 'good',
                overflow_count_today: 0,
                location: { lat: deployTarget.lat, lng: deployTarget.lng },
                is_active: true,
                created_at: serverTimestamp(),
                last_inspected_at: serverTimestamp(),
            };
            const ref = await addDoc(collection(db, 'bins'), newBin);
            const fakeNewBin = { ...newBin, id: ref.id, last_inspected_at: { toDate: () => new Date() } };
            setBins(computeAll([...bins, fakeNewBin]));

            // If this was deployed from a citizen request, mark it approved
            if (deployTarget.requestId) {
                setCitizenRequests(prev => prev.filter(r => r.id !== deployTarget.requestId));
            } else {
                setAiSuggestions(prev => prev.filter(s => s.lat !== deployTarget.lat || s.lng !== deployTarget.lng));
            }

            toast.success('Bin deployed successfully! ✅');
            setDeployTarget(null);
        } catch (err: any) {
            toast.error('Deploy failed: ' + err.message);
        }
    };

    const criticalCount = bins.filter(b => b.overflow_risk === 'critical').length;
    const highCount = bins.filter(b => b.overflow_risk === 'high').length;

    /* ─── Render ─────────────────────────────────────────────────── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: '20px', margin: 0 }}>
                        🗑️ Bin Overflow Prediction
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Module 3 · Updated: {lastRefresh.toLocaleTimeString()}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
                        {(['list', 'map'] as const).map(mode => (
                            <button key={mode} disabled={loading} onClick={() => setViewMode(mode)}
                                style={{ border: 'none', background: viewMode === mode ? 'var(--color-primary-100)' : 'transparent', color: viewMode === mode ? 'var(--color-primary-700)' : 'var(--text-muted)', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                {mode === 'list' ? '≡ List' : '🗺 Map'}
                            </button>
                        ))}
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={loadData} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Summary tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {[
                    { label: 'Critical (< 2h)', val: criticalCount, color: '#dc2626', bg: 'rgba(220,38,38,0.08)', icon: '🔴' },
                    { label: 'High Risk (< 6h)', val: highCount, color: '#d97706', bg: 'rgba(217,119,6,0.08)', icon: '🟠' },
                    { label: 'Total Monitored', val: bins.length, color: 'var(--text-primary)', bg: 'var(--bg-subtle)', icon: '🗑️' },
                    { label: 'AI Suggestions', val: aiSuggestions.length, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', icon: '✨' },
                    { label: 'Citizen Requests', val: citizenRequests.length, color: '#ea580c', bg: 'rgba(234,88,12,0.08)', icon: '🙋' },
                ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: '12px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '20px' }}>{s.icon}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-black)', fontSize: '22px', color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ marginBottom: '12px', opacity: 0.5 }} />
                    <p>Loading bins, AI suggestions and citizen requests...</p>
                </div>
            ) : viewMode === 'list' ? (
                /* ── LIST VIEW ──────────────────────────────────────── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {bins.map(bin => (
                        <div key={bin.id} style={{
                            background: 'var(--bg-card)', borderLeft: `4px solid ${RISK_COLOR[bin.overflow_risk]}`,
                            border: `1px solid ${RISK_COLOR[bin.overflow_risk]}44`, borderRadius: '12px',
                            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                        }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: RISK_BG[bin.overflow_risk], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Trash2 size={20} color={RISK_COLOR[bin.overflow_risk]} />
                            </div>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                                <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: '14px' }}>
                                    {bin.bin_id}
                                    <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 7px', borderRadius: '99px', background: RISK_BG[bin.overflow_risk], color: RISK_COLOR[bin.overflow_risk], fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>
                                        {bin.overflow_risk}
                                    </span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span><MapPin size={10} /> {bin.address}</span>
                                    <span>· {bin.type.replace(/_/g, ' ')} · {bin.size_litres}L</span>
                                </div>
                            </div>
                            <div style={{ width: '110px', flexShrink: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Est. fill</div>
                                <div style={{ height: '8px', borderRadius: '99px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${bin.fill_percentage}%`, background: RISK_COLOR[bin.overflow_risk], borderRadius: '99px' }} />
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 'var(--fw-semibold)', color: RISK_COLOR[bin.overflow_risk], marginTop: '2px' }}>{bin.fill_percentage}%</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 'var(--fw-semibold)', color: RISK_COLOR[bin.overflow_risk] }}>
                                    <Clock size={14} />
                                    {bin.overflow_in_hours < 1 ? `${Math.round(bin.overflow_in_hours * 60)} min` : `${bin.overflow_in_hours}h`}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>until overflow</div>
                            </div>
                            {(bin.overflow_risk === 'critical' || bin.overflow_risk === 'high') && (
                                <button className="btn btn-sm" style={{ background: RISK_COLOR[bin.overflow_risk], color: 'white', border: 'none', flexShrink: 0 }}
                                    onClick={() => alert(`Dispatch worker to ${bin.address}`)}>
                                    <AlertTriangle size={12} /> Dispatch
                                </button>
                            )}
                        </div>
                    ))}
                    {bins.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-subtle)' }}>
                            No bins are currently monitored in your ward.
                        </div>
                    )}
                </div>
            ) : (
                /* ── MAP VIEW ───────────────────────────────────────── */
                <>
                    {/* Map legend */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} /> Existing bin (critical)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> Existing bin (low)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} /> AI Suggestion (older)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dc2626', border: '2px solid #7c3aed', display: 'inline-block' }} />✨ AI Suggestion (fresh)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} /> 🙋 Citizen Request</span>
                    </div>

                    <div style={{ height: '520px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <MapContainer center={[CENTER.lat, CENTER.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>' />

                            {/* ① Existing Bins */}
                            {bins.map(bin => {
                                if (!bin.location) return null;
                                return (
                                    <Marker key={bin.id} position={[bin.location.lat, bin.location.lng]} icon={BIN_ICONS[bin.overflow_risk]}>
                                        <Tooltip direction="top" offset={[0, -14]}>
                                            <strong>{bin.bin_id}</strong> — {bin.fill_percentage}% full
                                        </Tooltip>
                                        <Popup>
                                            <div style={{ minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>🗑️ {bin.bin_id}</div>
                                                <div style={{ fontSize: '12px', color: '#555' }}>{bin.address}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                                    <span>Fill:</span><strong style={{ color: RISK_COLOR[bin.overflow_risk] }}>{bin.fill_percentage}%</strong>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                                    <span>Overflow in:</span><strong>{bin.overflow_in_hours}h</strong>
                                                </div>
                                                {(bin.overflow_risk === 'critical' || bin.overflow_risk === 'high') && (
                                                    <button className="btn btn-sm" style={{ background: RISK_COLOR[bin.overflow_risk], color: 'white', border: 'none', marginTop: '6px' }}
                                                        onClick={() => alert(`Dispatching to ${bin.bin_id}`)}>Dispatch Collector</button>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}

                            {/* ② AI Suggested Locations — coloured by waste age */}
                            {aiSuggestions.map((hs, i) => {
                                const color = suggestionColor(hs.newestReportAge);
                                const icon = pinIcon(color, '✨', 30);
                                const ageLabel = hs.newestReportAge < 6 ? 'Fresh (< 6h)' : hs.newestReportAge < 24 ? 'Today' : hs.newestReportAge < 72 ? 'Last 3 days' : 'Older';
                                return (
                                    <Marker key={`ai-${i}`} position={[hs.lat, hs.lng]} icon={icon}>
                                        <CircleMarker center={[hs.lat, hs.lng]} radius={28} pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 1 }} />
                                        <Tooltip direction="top" offset={[0, -16]}>
                                            <span style={{ color, fontWeight: 600 }}>✨ AI Suggestion · {ageLabel}</span>
                                        </Tooltip>
                                        <Popup>
                                            <div style={{ minWidth: '210px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ fontWeight: 700, color, fontSize: '14px' }}>✨ AI Bin Suggestion</div>
                                                <div style={{ fontSize: '12px', lineHeight: 1.4 }}>{hs.description}</div>
                                                <div style={{ fontSize: '11px', background: `${color}18`, padding: '4px 8px', borderRadius: '6px', color }}>
                                                    Waste reports age: <strong>{ageLabel}</strong> · {hs.weight} reports
                                                </div>
                                                <button className="btn btn-sm"
                                                    style={{ background: color, color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}
                                                    onClick={() => setDeployTarget({ lat: hs.lat, lng: hs.lng, description: hs.description })}>
                                                    <Plus size={13} /> Deploy Bin Here
                                                </button>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}

                            {/* ③ Citizen Requested Locations */}
                            {citizenRequests.map(cr => (
                                <Marker key={cr.id} position={[cr.lat, cr.lng]} icon={CITIZEN_ICON}>
                                    <Tooltip direction="top" offset={[0, -16]}>
                                        <span style={{ color: '#ea580c', fontWeight: 600 }}>🙋 Citizen Request · {cr.requesterName}</span>
                                    </Tooltip>
                                    <Popup>
                                        <div style={{ minWidth: '210px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontWeight: 700, color: '#ea580c', fontSize: '14px' }}>🙋 Citizen Bin Request</div>
                                            <div style={{ fontSize: '12px', color: '#555' }}>{cr.address}</div>
                                            <div style={{ fontSize: '12px', background: 'rgba(234,88,12,0.08)', padding: '6px 8px', borderRadius: '6px', lineHeight: 1.4 }}>
                                                <strong>Type:</strong> {cr.binType}<br />
                                                {cr.reason && <><strong>Reason:</strong> {cr.reason}</>}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>By: {cr.requesterName}</div>
                                            <button className="btn btn-sm"
                                                style={{ background: '#ea580c', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}
                                                onClick={() => { setNewBinType(cr.binType); setDeployTarget({ lat: cr.lat, lng: cr.lng, description: cr.address || 'Citizen requested location', requestId: cr.id }); }}>
                                                <Users size={13} /> Deploy at this Request
                                            </button>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </>
            )}

            {/* ── Deploy Bin Modal ─────────────────────────────────── */}
            {deployTarget && (
                <div className="modal-overlay" onClick={() => setDeployTarget(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Deploy New Bin</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setDeployTarget(null)}>✕</button>
                        </div>
                        <form onSubmit={handleDeployBin}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ background: deployTarget.requestId ? 'rgba(234,88,12,0.07)' : 'rgba(124,58,237,0.07)', border: `1px solid ${deployTarget.requestId ? '#ea580c33' : '#7c3aed33'}`, padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                                    <strong style={{ color: deployTarget.requestId ? '#ea580c' : '#7c3aed' }}>
                                        {deployTarget.requestId ? '🙋 Based on Citizen Request' : '✨ Based on AI Suggestion'}
                                    </strong>
                                    <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '12px' }}>{deployTarget.description}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                                        📍 {deployTarget.lat.toFixed(4)}, {deployTarget.lng.toFixed(4)}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Bin Type</label>
                                    <select className="select" value={newBinType} onChange={e => setNewBinType(e.target.value)} required>
                                        <option value="mixed">Mixed Waste</option>
                                        <option value="organic">Organic / Wet</option>
                                        <option value="plastic">Plastic / Dry</option>
                                        <option value="market">Market Waste</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Capacity (Litres)</label>
                                    <select className="select" value={newBinSize} onChange={e => setNewBinSize(Number(e.target.value))} required>
                                        <option value={120}>120L (Standard)</option>
                                        <option value={240}>240L (Large)</option>
                                        <option value={600}>600L (Industrial)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setDeployTarget(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ background: deployTarget.requestId ? '#ea580c' : '#7c3aed', border: 'none' }}>
                                    Confirm Deployment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BinOverflowPanel;
