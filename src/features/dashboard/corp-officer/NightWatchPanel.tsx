import { useState, useEffect } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Moon, AlertTriangle, RefreshCw, MapPin } from 'lucide-react';

interface DumpCluster {
    id: string;
    lat: number;
    lng: number;
    address: string;
    reports_this_month: number;
    night_reports: number;
    night_ratio: number;
    dump_risk_score: number;
    peak_hours: string;
    behaviour_type: 'occasional' | 'regular' | 'chronic';
}

// Module 11 calculation
function computeCluster(reports: any[]): Omit<DumpCluster, 'id' | 'address'> {
    const nightReports = reports.filter(r => {
        const h = r.createdAt?.toDate?.()?.getHours?.() ?? new Date(r.createdAt?.seconds * 1000 || 0).getHours();
        return h >= 21 || h < 6;
    });
    const n = reports.length;
    const nr = nightReports.length;
    const nightRatio = n > 0 ? nr / n : 0;
    const riskScore = Math.min(100, n * 3 + nightRatio * 40);

    type BehaviorType = 'occasional' | 'regular' | 'chronic';
    let btype: BehaviorType = 'occasional';
    if (n >= 10 && nightRatio > 0.5) btype = 'chronic';
    else if (n >= 5) btype = 'regular';

    // Peak hours: find 2-hour window with most reports
    const hourCounts: Record<number, number> = {};
    nightReports.forEach(r => {
        const h = r.createdAt?.toDate?.()?.getHours?.() ?? new Date(r.createdAt?.seconds * 1000 || 0).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    let maxH = 2;
    let maxC = 0;
    for (const h of Object.keys(hourCounts).map(Number)) {
        const c = (hourCounts[h] || 0) + (hourCounts[(h + 1) % 24] || 0);
        if (c > maxC) { maxC = c; maxH = h; }
    }
    const peakHours = `${maxH}:00 – ${(maxH + 2) % 24}:00`;

    return {
        lat: reports[0]?.location?.lat || reports[0]?.location?._lat || 9.9252,
        lng: reports[0]?.location?.lng || reports[0]?.location?._long || 78.1198,
        reports_this_month: n,
        night_reports: nr,
        night_ratio: Math.round(nightRatio * 100) / 100,
        dump_risk_score: Math.round(riskScore),
        peak_hours: peakHours,
        behaviour_type: btype,
    };
}

const BEHAVIOUR_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
    chronic: { color: '#7c2d12', bg: 'rgba(124,45,18,0.10)', label: 'CHRONIC', icon: '🔴' },
    regular: { color: '#c2410c', bg: 'rgba(194,65,12,0.10)', label: 'REGULAR', icon: '🟠' },
    occasional: { color: '#854d0e', bg: 'rgba(133,77,14,0.10)', label: 'OCCASIONAL', icon: '🟡' },
};

function NightWatchPanel() {
    const [clusters, setClusters] = useState<DumpCluster[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'dump_clusters'), limit(20)));
            if (!snap.empty) {
                setClusters(snap.docs.map(d => ({ id: d.id, ...d.data() } as DumpCluster)));
            } else {
                setClusters([]);
            }
        } catch {
            setClusters([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const chronics = clusters.filter(c => c.behaviour_type === 'chronic').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: '20px', margin: 0 }}>
                        🌙 Night Watch Hotspots
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Module 11 · Illegal Dumping Behaviour Intelligence · {clusters.length} clusters detected
                    </p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {[
                    { label: 'Chronic Sites', val: chronics, color: '#7c2d12', bg: 'rgba(124,45,18,0.1)', ico: '🔴' },
                    { label: 'Total Clusters', val: clusters.length, color: 'var(--text-primary)', bg: 'var(--bg-subtle)', ico: '📍' },
                    { label: 'Peak Window', val: '1–4 AM', color: '#0284c7', bg: 'rgba(2,132,199,0.08)', ico: '🌙' },
                ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, borderRadius: '12px', padding: '12px' }}>
                        <div style={{ fontSize: '22px' }}>{s.ico}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-black)', fontSize: '22px', color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Moon size={24} style={{ opacity: 0.4, marginBottom: '12px' }} />
                    <p>Analysing night reports...</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {clusters.map(c => {
                        const cfg = BEHAVIOUR_CONFIG[c.behaviour_type];
                        return (
                            <div key={c.id} style={{
                                background: 'var(--bg-card)',
                                border: `1px solid ${cfg.color}33`,
                                borderLeft: `4px solid ${cfg.color}`,
                                borderRadius: '12px',
                                padding: '14px 16px',
                                display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center',
                            }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: '14px' }}>
                                        {c.address}
                                        <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: cfg.bg, color: cfg.color, fontWeight: 700 }}>
                                            {cfg.icon} {cfg.label}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <span><MapPin size={10} /> {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span>
                                        <span>· {c.reports_this_month} reports this month</span>
                                        <span>· {Math.round(c.night_ratio * 100)}% at night</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', minWidth: '80px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Risk Score</div>
                                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '22px', color: cfg.color }}>{c.dump_risk_score}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ 100</div>
                                </div>
                                <div style={{ textAlign: 'center', minWidth: '100px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Peak Hours</div>
                                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: '13px', color: '#0284c7', marginTop: '2px' }}>
                                        🌙 {c.peak_hours}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default NightWatchPanel;
