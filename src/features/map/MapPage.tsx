import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HeatmapLayer from './HeatmapLayer';
import { collection, query, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Report, IssueType } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';
import { Filter, X, Search } from 'lucide-react';
import { format } from 'date-fns';
import styles from './MapPage.module.css';

// Fix Leaflet default icon URLs broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom colored icons
const createIcon = (color: string) =>
    L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });

const STATUS_COLORS: Record<string, string> = {
    open: '#DC2626',
    assigned: '#D97706',
    in_progress: '#2563EB',
    resolved: '#16A34A',
    rejected: '#9CA3AF',
};

// Madurai center
const MADURAI_CENTER: [number, number] = [9.9252, 78.1198];

// Static fallback zones: shown when Firestore wards collection and live reports are both empty.
// Covers Madurai's major neighbourhoods so the map is never a blank canvas.
const MADURAI_STATIC_ZONES = [
    { id: 'mdu-meenakshi', lat: 9.9195, lng: 78.1194, ward: 'Meenakshi Temple Area', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-tallakulam', lat: 9.9385, lng: 78.1238, ward: 'Tallakulam', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-annanagar', lat: 9.9127, lng: 78.0935, ward: 'Anna Nagar', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-kknagar', lat: 9.9278, lng: 78.0782, ward: 'KK Nagar', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-thirunagar', lat: 9.9485, lng: 78.1082, ward: 'Thirunagar', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-goripalayam', lat: 9.9033, lng: 78.1276, ward: 'Goripalayam', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-arappalayam', lat: 9.9182, lng: 78.1437, ward: 'Arappalayam', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-palanganatham', lat: 9.8902, lng: 78.1198, ward: 'Palanganatham', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-vilangudi', lat: 9.9578, lng: 78.1387, ward: 'Vilangudi', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-narimedu', lat: 9.9421, lng: 78.1367, ward: 'Narimedu', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-kochadai', lat: 9.9672, lng: 78.0987, ward: 'Kochadai', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-othakadai', lat: 9.9738, lng: 78.1278, ward: 'Othakadai', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-sscolony', lat: 9.9128, lng: 78.0732, ward: 'SS Colony', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-mattuthavani', lat: 9.9462, lng: 78.1075, ward: 'Mattuthavani', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-teppakulam', lat: 9.9278, lng: 78.1298, ward: 'Teppakulam', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-krishnapuram', lat: 9.9128, lng: 78.1598, ward: 'Krishnapuram', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-visalakshi', lat: 9.9342, lng: 78.0892, ward: 'Visalakshi Nagar', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
    { id: 'mdu-surveyor', lat: 9.9082, lng: 78.0987, ward: 'Surveyor Colony', cleanScore: 50, openReports: 0, resolvedReports: 0, isSOS: false, total: 0 },
];

// Wards are loaded from Firestore

// Special zones are loaded from Firestore

function RecenterMap({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => { map.setView(center, 14); }, [center, map]);
    return null;
}

function MapPage() {
    const { t } = useTranslation();
    const { hasRole } = useAuth();
    const { reportFilters, setReportFilter, clearReportFilters, festivalModeActive } = useAppStore();
    const [allReports, setAllReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [mapCenter, setMapCenter] = useState<[number, number]>(MADURAI_CENTER);
    const [showSpecialZones, setShowSpecialZones] = useState(festivalModeActive);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showGlassHeatmap, setShowGlassHeatmap] = useState(false);
    const [showDangerZones, setShowDangerZones] = useState(false);
    const [showRiskOverlay, setShowRiskOverlay] = useState(false);
    const [showCleanScore, setShowCleanScore] = useState(true); // ON by default – main dirty/clean view
    const [wardNames, setWardNames] = useState<string[]>([]);
    const [specialZones, setSpecialZones] = useState<{ name: string; lat: number; lng: number; radius: number; color: string }[]>([]);
    const [wardCleanData, setWardCleanData] = useState<{ id: string; name: string; lat: number; lng: number; cleanScore: number; openReports: number }[]>([]);

    // Real-time listener: new reports appear on map without any user action
    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(200));
        const unsubscribe = onSnapshot(q, (snap) => {
            setAllReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report)));
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []); // single persistent listener; filters applied below

    // Client-side filters applied reactively — no re-fetch needed on filter change
    const reports = useMemo(() => {
        let data = [...allReports];
        if (reportFilters.ward) data = data.filter(r => r.ward === reportFilters.ward);
        if (reportFilters.issueType) data = data.filter(r => r.issueType === reportFilters.issueType as IssueType);
        if (reportFilters.status) data = data.filter(r => r.status === reportFilters.status);
        if (reportFilters.timeRange === 'last24h') {
            const ts = Date.now() - 86400000;
            data = data.filter(r => r.createdAt?.toDate?.()?.getTime() > ts);
        } else if (reportFilters.timeRange === 'last7d') {
            const ts = Date.now() - 7 * 86400000;
            data = data.filter(r => r.createdAt?.toDate?.()?.getTime() > ts);
        } else if (reportFilters.timeRange === 'last30d') {
            const ts = Date.now() - 30 * 86400000;
            data = data.filter(r => r.createdAt?.toDate?.()?.getTime() > ts);
        }
        return data;
    }, [allReports, reportFilters]);

    // Load wards from Firestore (also powers clean-score overlay)
    useEffect(() => {
        getDocs(collection(db, 'wards')).then(snap => {
            const names: string[] = [];
            const cleanData: typeof wardCleanData = [];
            snap.docs.forEach(d => {
                const data = d.data();
                names.push(data.name ?? d.id);
                const lat = data.center?.lat ?? data.lat;
                const lng = data.center?.lng ?? data.lng;
                if (lat != null && lng != null) {
                    cleanData.push({
                        id: d.id,
                        name: data.name ?? d.id,
                        lat,
                        lng,
                        cleanScore: data.cleanlinessScore ?? data.cleanScore ?? 50,
                        openReports: data.openReports ?? 0,
                    });
                }
            });
            setWardNames(names.sort());
            setWardCleanData(cleanData);
        }).catch(console.error);
    }, []);

    // Load special zones from Firestore (support both center: {lat,lng} and top-level lat/lng)
    useEffect(() => {
        getDocs(collection(db, 'specialZones')).then(snap => {
            setSpecialZones(snap.docs.map(d => {
                const data = d.data();
                const lat = data.center?.lat ?? data.lat ?? 0;
                const lng = data.center?.lng ?? data.lng ?? 0;
                return {
                    name: data.name ?? d.id,
                    lat,
                    lng,
                    radius: data.radius ?? 300,
                    color: data.color ?? '#F5A623',
                };
            }));
        }).catch(console.error);
    }, []);

    const handleSearch = () => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return;
        // Match ward name
        const ward = wardNames.find(w => w.toLowerCase().includes(q));
        if (ward) {
            setReportFilter('ward', ward);
            setShowFilters(true);
        }
        // Match special zone name → center map on zone
        const zone = specialZones.find(z => z.name.toLowerCase().includes(q));
        if (zone && zone.lat && zone.lng) {
            setMapCenter([zone.lat, zone.lng]);
            setShowSpecialZones(true);
        }
    };

    // Center map on first report in ward when ward filter is applied (PR-34)
    useEffect(() => {
        if (reportFilters.ward && reports.length > 0) {
            const inWard = reports.find(r => r.ward === reportFilters.ward);
            if (inWard?.location?.lat != null && inWard?.location?.lng != null) {
                setMapCenter([inWard.location.lat, inWard.location.lng]);
            }
        }
    }, [reportFilters.ward, reports]);

    const activeFiltersCount = Object.values(reportFilters).filter(v => v && v !== 'last7d').length;
    const isOfficer = hasRole(['corp_officer', 'corp_admin', 'system_admin']);

    // Compute ward/area cleanliness from LIVE reports (works with zero seed data).
    // Groups all reports into ~500m grid cells using lat/lng rounding, then scores each.
    const liveCleanZones = useMemo(() => {
        if (allReports.length === 0) return [];

        const CELL = 0.006; // ~650m grid
        const cells: Record<string, {
            key: string; lat: number; lng: number;
            open: number; resolved: number; sos: number; ward: string;
        }> = {};

        allReports.forEach(r => {
            if (!r.location?.lat || !r.location?.lng) return;
            const cellLat = Math.round(r.location.lat / CELL) * CELL;
            const cellLng = Math.round(r.location.lng / CELL) * CELL;
            const key = `${cellLat.toFixed(4)}_${cellLng.toFixed(4)}`;
            if (!cells[key]) cells[key] = { key, lat: cellLat, lng: cellLng, open: 0, resolved: 0, sos: 0, ward: r.ward ?? '' };
            if (r.status === 'open' || r.status === 'assigned' || r.status === 'in_progress') {
                cells[key].open++;
                if (r.isGlassSOS || r.priority === 'sos') cells[key].sos++;
            } else if (r.status === 'resolved' || r.status === 'verified') {
                cells[key].resolved++;
            }
        });

        return Object.values(cells).map(c => {
            const total = c.open + c.resolved;
            // Score: starts at 100, subtract per open report, bonus for resolved
            const rawScore = Math.max(0, 100 - (c.open * 14) + (c.resolved * 3));
            const cleanScore = Math.min(100, Math.round(rawScore));
            return {
                id: c.key,
                lat: c.lat,
                lng: c.lng,
                ward: c.ward,
                cleanScore,
                openReports: c.open,
                resolvedReports: c.resolved,
                isSOS: c.sos > 0,
                total,
            };
        }).filter(z => z.total > 0); // only show cells that have at least 1 report
    }, [allReports]);

    // Use Firestore ward data when available, then live computed zones, then static Madurai fallback.
    // The static fallback ensures the map always shows the city's neighbourhood grid even with zero data.
    const cleanZones = wardCleanData.length > 0
        ? wardCleanData.map(w => ({ id: w.id, lat: w.lat, lng: w.lng, ward: w.name, cleanScore: w.cleanScore, openReports: w.openReports, resolvedReports: 0, isSOS: false, total: w.openReports }))
        : liveCleanZones.length > 0
            ? liveCleanZones
            : MADURAI_STATIC_ZONES;

    // PR-62/63: Ward risk (open reports count) for officer overlay
    const wardRisk = (() => {
        const open = reports.filter(r => r.status === 'open' || r.status === 'assigned' || r.status === 'in_progress');
        const byWard: Record<string, { count: number; lat: number; lng: number; total: number }> = {};
        open.forEach(r => {
            if (!r.ward || !r.location?.lat || !r.location?.lng) return;
            if (!byWard[r.ward]) byWard[r.ward] = { count: 0, lat: 0, lng: 0, total: 0 };
            byWard[r.ward].count++;
            byWard[r.ward].lat += r.location.lat;
            byWard[r.ward].lng += r.location.lng;
            byWard[r.ward].total++;
        });
        return Object.entries(byWard).map(([ward, d]) => ({
            ward,
            openCount: d.count,
            lat: d.lat / d.total,
            lng: d.lng / d.total,
            risk: d.count > 5 ? 'high' as const : d.count > 2 ? 'medium' as const : 'low' as const,
        }));
    })();

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>{t('map.title')}</h1>
                    <p className={styles.subtitle}>
                        {reports.length} reports visible · Click a marker for details
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={`btn btn-outline btn-sm ${activeFiltersCount ? 'btn-primary' : ''}`}
                        onClick={() => setShowFilters((v) => !v)}
                    >
                        <Filter size={14} />
                        Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
                    </button>
                    {activeFiltersCount > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={clearReportFilters}>
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Search */}
            <form className={styles.searchRow} onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
                <div className={styles.searchField}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder={t('map.searchArea')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>
                <button type="submit" className="btn btn-primary btn-sm">Search</button>
            </form>

            {/* Filters panel */}
            {showFilters && (
                <div className={styles.filtersPanel}>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Ward</label>
                        <select className="select" value={reportFilters.ward} onChange={e => setReportFilter('ward', e.target.value)}>
                            <option value="">All Wards</option>
                            {wardNames.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Issue Type</label>
                        <select className="select" value={reportFilters.issueType} onChange={e => setReportFilter('issueType', e.target.value)}>
                            <option value="">All Types</option>
                            {['glass_on_road', 'garbage_pile', 'plastic_waste', 'organic_waste', 'drainage', 'burning', 'toilet_issue', 'dead_animal', 'others'].map(v => (
                                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Status</label>
                        <select className="select" value={reportFilters.status} onChange={e => setReportFilter('status', e.target.value)}>
                            <option value="">All Statuses</option>
                            {['open', 'assigned', 'in_progress', 'resolved', 'rejected'].map(v => (
                                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Time Range</label>
                        <select className="select" value={reportFilters.timeRange} onChange={e => setReportFilter('timeRange', e.target.value)}>
                            <option value="last24h">Last 24 Hours</option>
                            <option value="last7d">Last 7 Days</option>
                            <option value="last30d">Last 30 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Overlays</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={showCleanScore} onChange={e => setShowCleanScore(e.target.checked)} />
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>🟢 Cleanliness Score (Dirty/Clean)</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={showSpecialZones} onChange={e => setShowSpecialZones(e.target.checked)} />
                                <span style={{ fontSize: 'var(--text-sm)' }}>Special Zones</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} />
                                <span style={{ fontSize: 'var(--text-sm)' }}>Heatmap (Density)</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={showGlassHeatmap} onChange={e => setShowGlassHeatmap(e.target.checked)} />
                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>Glass density (red)</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={showDangerZones} onChange={e => setShowDangerZones(e.target.checked)} />
                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>Danger Zones</span>
                            </label>
                            {isOfficer && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={showRiskOverlay} onChange={e => setShowRiskOverlay(e.target.checked)} />
                                    <span style={{ fontSize: 'var(--text-sm)' }}>Risk overlay (Officer)</span>
                                </label>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className={styles.legend}>
                {showCleanScore && (
                    <>
                        <div className={styles.legendItem}>
                            <div className={styles.legendDot} style={{ background: '#16A34A' }} />
                            <span>Clean (70+)</span>
                        </div>
                        <div className={styles.legendItem}>
                            <div className={styles.legendDot} style={{ background: '#F59E0B' }} />
                            <span>Medium (40–69)</span>
                        </div>
                        <div className={styles.legendItem}>
                            <div className={styles.legendDot} style={{ background: '#DC2626' }} />
                            <span>Dirty (&lt;40)</span>
                        </div>
                    </>
                )}
                {!showCleanScore && Object.entries(STATUS_COLORS).map(([status, color]) => (
                    <div key={status} className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ background: color }} />
                        <span>{status.replace('_', ' ')}</span>
                    </div>
                ))}
                {showSpecialZones && (
                    <div className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ background: '#F5A623', border: '2px solid #F5A623' }} />
                        <span>Special Zone</span>
                    </div>
                )}
                {showGlassHeatmap && (
                    <div className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ background: 'linear-gradient(90deg,#EF4444,#7F1D1D)' }} />
                        <span>Glass density</span>
                    </div>
                )}
                {showDangerZones && (
                    <div className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ background: 'transparent', border: '2px dashed #DC2626' }} />
                        <span>Danger Zone</span>
                    </div>
                )}
            </div>

            {/* Map */}
            <div className={styles.mapWrapper}>
                {loading && (
                    <div className={styles.mapLoading}>
                        <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid var(--color-primary-200)', borderTop: '3px solid var(--color-primary-500)', borderRadius: '50%' }} />
                        <span>Loading map...</span>
                    </div>
                )}
                <MapContainer
                    center={MADURAI_CENTER}
                    zoom={13}
                    style={{ width: '100%', height: '100%' }}
                    className={styles.leafletMap}
                >
                    <RecenterMap center={mapCenter} />

                    {/* ── Ward Cleanliness Score Overlay (GREEN/ORANGE/RED) ── */}
                    {showCleanScore && cleanZones.map(zone => {
                        const score = zone.cleanScore;
                        const isSOS = 'isSOS' in zone && zone.isSOS;
                        const color = isSOS ? '#7C3AED' : score >= 70 ? '#16A34A' : score >= 40 ? '#F59E0B' : '#DC2626';
                        const label = isSOS ? '🚨 SOS Alert'
                            : score >= 70 ? '✅ Clean'
                                : score >= 40 ? '⚠️ Needs Attention'
                                    : '🔴 Needs Urgent Cleaning';
                        return (
                            <Circle
                                key={`clean-${zone.id}`}
                                center={[zone.lat, zone.lng]}
                                radius={550}
                                pathOptions={{
                                    color,
                                    fillColor: color,
                                    fillOpacity: isSOS ? 0.30 : 0.18,
                                    weight: isSOS ? 3 : 2,
                                    dashArray: isSOS ? '6,4' : undefined,
                                }}
                            >
                                <Popup>
                                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                                        {zone.ward || 'Area'}
                                    </div>
                                    <div style={{ fontSize: '13px', color, fontWeight: 600, marginBottom: '4px' }}>
                                        {label} · Score: {score}/100
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span>🔴 {zone.openReports} open reports (need cleaning)</span>
                                        {'resolvedReports' in zone && zone.resolvedReports > 0 && (
                                            <span>✅ {zone.resolvedReports} resolved</span>
                                        )}
                                    </div>
                                </Popup>
                            </Circle>
                        );
                    })}

                    {/* PR-62/63: Risk overlay for officers */}
                    {showRiskOverlay && isOfficer && wardRisk.map((w) => (
                        <Circle
                            key={w.ward}
                            center={[w.lat, w.lng]}
                            radius={400}
                            pathOptions={{
                                color: w.risk === 'high' ? '#DC2626' : w.risk === 'medium' ? '#F59E0B' : '#22C55E',
                                fillColor: w.risk === 'high' ? '#DC2626' : w.risk === 'medium' ? '#F59E0B' : '#22C55E',
                                fillOpacity: 0.2,
                                weight: 2,
                            }}
                        >
                            <Popup>
                                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{w.ward}</div>
                                <div style={{ fontSize: '12px' }}>Risk: {w.risk} · {w.openCount} open</div>
                            </Popup>
                        </Circle>
                    ))}
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />

                    {/* Danger zones overlay */}
                    {showDangerZones && reports.map(report => {
                        if (!report.location?.lat || !report.location?.lng) return null;
                        const isDanger = ['open', 'assigned'].includes(report.status) && (report.priority === 'high' || report.priority === 'sos' || report.isGlassSOS || report.issueType === 'burning');
                        if (!isDanger) return null;
                        return (
                            <Circle
                                key={`danger-${report.id}`}
                                center={[report.location.lat, report.location.lng]}
                                radius={300}
                                pathOptions={{ color: '#DC2626', fillColor: '#DC2626', fillOpacity: 0.15, weight: 2, dashArray: '10,10' }}
                            >
                                <Popup>
                                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: '#DC2626' }}>
                                        ⚠️ Danger Zone
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>Critical issue reported nearby</div>
                                </Popup>
                            </Circle>
                        );
                    })}

                    {/* Special zones */}
                    {showSpecialZones && specialZones.map((zone) => (
                        <Circle
                            key={zone.name}
                            center={[zone.lat, zone.lng]}
                            radius={zone.radius}
                            pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.1, weight: 2, dashArray: '5,5' }}
                        >
                            <Popup>
                                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                                    🏛️ {zone.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Special monitoring zone</div>
                            </Popup>
                        </Circle>
                    ))}

                    {/* PR-30: Real density heatmap */}
                    {showHeatmap && (
                        <HeatmapLayer
                            points={reports
                                .filter(r => r.location?.lat != null && r.location?.lng != null)
                                .map(r => [
                                    r.location!.lat,
                                    r.location!.lng,
                                    (r.status === 'open' || r.status === 'in_progress') ? 0.85 : 0.25,
                                ] as [number, number, number])}
                            options={{ radius: 28, blur: 18 }}
                        />
                    )}
                    {/* PR-32: Glass-heavy areas – stronger red heatmap */}
                    {showGlassHeatmap && (
                        <HeatmapLayer
                            points={reports
                                .filter(r => r.issueType === 'glass_on_road' && r.location?.lat != null && r.location?.lng != null)
                                .map(r => [r.location!.lat, r.location!.lng, 1] as [number, number, number])}
                            options={{
                                radius: 35,
                                blur: 20,
                                gradient: { 0.3: '#FCA5A5', 0.6: '#EF4444', 0.9: '#B91C1C', 1: '#7F1D1D' },
                            }}
                        />
                    )}

                    {/* Report markers */}
                    {reports.map((report) => {
                        if (!report.location?.lat || !report.location?.lng) return null;
                        const color = STATUS_COLORS[report.status] ?? '#9CA3AF';
                        const icon = createIcon(color);
                        return (
                            <Marker
                                key={report.id}
                                position={[report.location.lat, report.location.lng]}
                                icon={icon}
                            >
                                <Popup className={styles.popup}>
                                    <div className={styles.popupContent}>
                                        <div className={styles.popupType}>
                                            {report.issueType.replace(/_/g, ' ')}
                                            {report.isGlassSOS && <span style={{ color: '#DC2626', marginLeft: '4px' }}>⚠ SOS</span>}
                                        </div>
                                        <div className={styles.popupMeta}>
                                            Status: <strong style={{ color }}>{report.status}</strong>
                                        </div>
                                        {report.createdAt?.toDate && (
                                            <div className={styles.popupMeta}>
                                                {format(report.createdAt.toDate(), 'dd MMM, hh:mm a')}
                                            </div>
                                        )}
                                        {report.ward && (
                                            <div className={styles.popupMeta}>📍 {report.ward}</div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>

            {/* Stats bar */}
            <div className={styles.statsBar}>
                {Object.entries(STATUS_COLORS).map(([status, color]) => {
                    const count = reports.filter(r => r.status === status).length;
                    return (
                        <div key={status} className={styles.statItem}>
                            <div className={styles.statNum} style={{ color }}>{count}</div>
                            <div className={styles.statLbl}>{status.replace('_', ' ')}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default MapPage;
