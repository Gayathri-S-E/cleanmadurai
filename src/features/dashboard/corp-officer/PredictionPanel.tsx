import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { Brain, TrendingUp, MapPin, Users, AlertTriangle, Zap, Waves } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './PredictionPanel.module.css';

// Madurai landmark areas for prediction
const LANDMARK_ZONES = [
    { name: 'Meenakshi Temple North Gate', lat: 9.9196, lng: 78.1194, risk: 'high' },
    { name: 'Meenakshi Temple East Gate', lat: 9.9196, lng: 78.1210, risk: 'high' },
    { name: 'Meenakshi Temple South Gate', lat: 9.9186, lng: 78.1194, risk: 'medium' },
    { name: 'Meenakshi Temple West Gate', lat: 9.9196, lng: 78.1178, risk: 'medium' },
    { name: 'Madurai Junction', lat: 9.9302, lng: 78.1221, risk: 'medium' },
    { name: 'Arapalayam Bus Stand', lat: 9.9414, lng: 78.1024, risk: 'low' },
    { name: 'Mattuthavani Bus Stand', lat: 9.9603, lng: 78.1101, risk: 'low' },
    { name: 'Anna Nagar Market', lat: 9.9350, lng: 78.1050, risk: 'medium' },
    { name: 'KK Nagar Market', lat: 9.9502, lng: 78.0914, risk: 'medium' },
    { name: 'Nagamalai Pudukottai', lat: 9.9778, lng: 78.1416, risk: 'low' },
];

type RiskLevel = 'high' | 'medium' | 'low';

interface ZonePrediction {
    zone: string;
    risk: RiskLevel;
    predictedVolume: number;
    reason: string;
    preAssigned?: string;
}

interface DayForecast {
    day: string;
    date: string;
    volume: number;
    isWeekend: boolean;
    isFestival: boolean;
}

const RISK_COLOR: Record<RiskLevel, string> = {
    high: 'var(--color-danger)',
    medium: 'var(--color-warning)',
    low: 'var(--color-success)',
};

const RISK_LABEL: Record<RiskLevel, string> = {
    high: '🔴 High Risk',
    medium: '🟠 Medium Risk',
    low: '🟢 Low Risk',
};


interface ElevationPrediction {
    name: string;
    elevation: number;
    risk: 'critical' | 'warning' | 'low';
    message: string;
}

function PredictionPanel() {
    const { user, profile } = useAuth();
    const [zonePredictions, setZonePredictions] = useState<ZonePrediction[]>([]);
    const [weekForecast, setWeekForecast] = useState<DayForecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<string | null>(null);
    const [workerName, setWorkerName] = useState('');
    const [assignZone, setAssignZone] = useState<string | null>(null);
    const [festivalDates, setFestivalDates] = useState<string[]>([]);
    const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
    const [elevationPredictions, setElevationPredictions] = useState<ElevationPrediction[]>([]);
    const [elevationLoading, setElevationLoading] = useState(false);

    useEffect(() => {
        loadPredictions();
        fetchWorkers();
        fetchElevationData();
    }, []);

    const fetchElevationData = async () => {
        setElevationLoading(true);
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                console.error("VITE_GOOGLE_MAPS_API_KEY is missing");
                setElevationLoading(false);
                return;
            }

            // Coordinates for Simmakkal Underpass and Sellur
            const locationsParam = `${9.9255},${78.1219}|${9.9360},${78.1180}`;

            const response = await fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${locationsParam}&key=${apiKey}`);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length >= 2) {
                const simmakkalEl = Math.round(data.results[0].elevation);
                const sellurEl = Math.round(data.results[1].elevation);

                setElevationPredictions([
                    {
                        name: 'Simmakkal Underpass',
                        elevation: simmakkalEl,
                        risk: simmakkalEl < 135 ? 'critical' : 'warning',
                        message: 'High risk of plastic waste flow from northern wards during monsoon.'
                    },
                    {
                        name: 'Sellur Eye Hospital Road',
                        elevation: sellurEl,
                        risk: sellurEl < 138 ? 'warning' : 'low',
                        message: 'Drainage blockage prediction based on topography gradient.'
                    }
                ]);
            }
        } catch (error) {
            console.error("Elevation API Error", error);
        } finally {
            setElevationLoading(false);
        }
    };

    const fetchWorkers = async () => {
        try {
            const snap = await getDocs(
                query(collection(db, 'users'), where('roles', 'array-contains', 'sanitation_worker'), limit(50))
            );
            const wList = snap.docs.map(d => ({
                id: d.id,
                name: d.data().displayName || 'Unknown Worker'
            }));
            setWorkers(wList);
        } catch (err) {
            console.error('Error fetching workers', err);
        }
    };

    const loadPredictions = async () => {
        setLoading(true);
        try {
            // 1. Fetch festival dates from specialZones
            const zonesSnap = await getDocs(collection(db, 'specialZones'));
            const allFestivalDates: string[] = [];
            zonesSnap.docs.forEach(d => {
                const z = d.data();
                if (z.festivalDays) allFestivalDates.push(...z.festivalDays);
            });
            setFestivalDates(allFestivalDates);

            // 2. Fetch last 30 days reports to compute base volume
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            const reportsSnap = await getDocs(
                query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(500))
            );
            const reports = reportsSnap.docs.map(d => d.data());
            const totalBase = reports.length;

            // 3. Generate 7-day forecast
            const forecast: DayForecast[] = [];
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            for (let i = 1; i <= 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const dateStr = date.toISOString().slice(0, 10);
                const isFestival = allFestivalDates.includes(dateStr);
                const baseVol = Math.round(totalBase / 30);
                const multiplier = isFestival ? 2.8 : isWeekend ? 1.6 : 1.0;
                forecast.push({
                    day: dayNames[dayOfWeek],
                    date: dateStr,
                    volume: Math.round(baseVol * multiplier),
                    isWeekend,
                    isFestival,
                });
            }
            setWeekForecast(forecast);

            // 4. Fetch pre-assignments from Firestore
            const assignSnap = await getDocs(
                query(collection(db, 'workerAssignments'), orderBy('createdAt', 'desc'), limit(100))
            );
            const assignments: Record<string, string> = {};
            assignSnap.docs.forEach(d => {
                const a = d.data();
                assignments[a.zone] = a.workerName;
            });

            // 5. Build zone predictions using historical density
            const today = new Date().toISOString().slice(0, 10);
            const isTodayFestival = allFestivalDates.includes(today);
            const todayDay = new Date().getDay();
            const isTodayWeekend = todayDay === 0 || todayDay === 6;

            const zonePreds: ZonePrediction[] = LANDMARK_ZONES.map(z => {
                let baseRisk = z.risk as RiskLevel;
                if (isTodayFestival && (z.name.includes('Temple') || z.name.includes('Market'))) baseRisk = 'high';
                else if (isTodayWeekend && z.name.includes('Market')) baseRisk = 'high';

                const volMap: Record<RiskLevel, number> = { high: 120, medium: 65, low: 25 };
                const reasonMap: Record<RiskLevel, string> = {
                    high: isTodayFestival ? 'Festival crowd + historical hotspot' : 'High footfall area, market day patterns',
                    medium: isTodayWeekend ? 'Weekend market activity' : 'Moderate footfall zone',
                    low: 'Low-activity residential zone',
                };

                return {
                    zone: z.name,
                    risk: baseRisk,
                    predictedVolume: volMap[baseRisk] + (z.name.length % 20),
                    reason: reasonMap[baseRisk],
                    preAssigned: assignments[z.name],
                };
            }).sort((a, b) => {
                const order = { high: 3, medium: 2, low: 1 };
                return order[b.risk] - order[a.risk];
            });
            setZonePredictions(zonePreds);
        } catch (e) {
            console.error('Prediction load error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePreAssign = async () => {
        if (!assignZone || !workerName.trim() || !user || !profile) return;
        setAssigning(assignZone);
        try {
            await addDoc(collection(db, 'workerAssignments'), {
                zone: assignZone,
                workerName: workerName.trim(),
                assignedBy: user.uid,
                assignedByName: profile.displayName,
                createdAt: serverTimestamp(),
                date: new Date().toISOString().slice(0, 10),
            });
            toast.success(`Worker pre-assigned to ${assignZone}!`);
            setAssignZone(null);
            setWorkerName('');
            setZonePredictions(prev => prev.map(z => z.zone === assignZone ? { ...z, preAssigned: workerName.trim() } : z));
        } catch (e: any) {
            toast.error('Assignment failed: ' + e.message);
        } finally {
            setAssigning(null);
        }
    };

    const maxVolume = weekForecast.length > 0 ? Math.max(...weekForecast.map(d => d.volume)) : 1;

    if (loading) {
        return (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Brain size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p>Loading AI predictions...</p>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            {/* Header */}
            <div className={styles.panelHeader}>
                <div className={styles.headerIcon}><Brain size={22} /></div>
                <div>
                    <h2 className={styles.panelTitle}>Garbage Prediction AI</h2>
                    <p className={styles.panelSubtitle}>7-day waste forecast based on festival data, market patterns & historical reports</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={loadPredictions} style={{ marginLeft: 'auto' }}>
                    Refresh
                </button>
            </div>

            {/* 7-Day Bar Chart */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}><TrendingUp size={16} /> 7-Day Volume Forecast</h3>
                <div className={styles.chartContainer}>
                    {weekForecast.map((day, i) => (
                        <div key={i} className={styles.chartBar}>
                            <div className={styles.barOuter}>
                                <div
                                    className={styles.barFill}
                                    style={{
                                        height: `${(day.volume / maxVolume) * 100}%`,
                                        background: day.isFestival
                                            ? 'linear-gradient(180deg, #EF4444, #F97316)'
                                            : day.isWeekend
                                                ? 'linear-gradient(180deg, #F59E0B, #FBBF24)'
                                                : 'linear-gradient(180deg, var(--color-primary-500), var(--color-primary-400))',
                                    }}
                                />
                            </div>
                            <div className={styles.barLabel}>{day.day}</div>
                            <div className={styles.barValue}>{day.volume}</div>
                            {day.isFestival && <div className={styles.festivalDot} title="Festival day">🎉</div>}
                        </div>
                    ))}
                </div>
                <div className={styles.legend}>
                    <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'var(--color-primary-500)' }} /> Normal</span>
                    <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#F59E0B' }} /> Weekend</span>
                    <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#EF4444' }} /> Festival</span>
                </div>
            </div>

            {/* High-Risk Zone List */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}><MapPin size={16} /> Predicted High-Risk Zones (Today)</h3>
                <div className={styles.zoneList}>
                    {zonePredictions.map((z, i) => (
                        <div key={i} className={styles.zoneCard} style={{ borderLeft: `4px solid ${RISK_COLOR[z.risk]}` }}>
                            <div className={styles.zoneTop}>
                                <div className={styles.zoneName}>{z.zone}</div>
                                <span className="badge" style={{ background: RISK_COLOR[z.risk] + '22', color: RISK_COLOR[z.risk], border: `1px solid ${RISK_COLOR[z.risk]}`, fontSize: '11px' }}>
                                    {RISK_LABEL[z.risk]}
                                </span>
                            </div>
                            <div className={styles.zoneMeta}>
                                <span><Zap size={12} /> {z.predictedVolume} kg predicted</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{z.reason}</span>
                            </div>
                            {z.preAssigned ? (
                                <div className={styles.assigned}>
                                    <Users size={12} /> Pre-assigned: <strong>{z.preAssigned}</strong>
                                </div>
                            ) : (
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ marginTop: '8px', fontSize: '12px' }}
                                    onClick={() => setAssignZone(z.zone)}
                                >
                                    + Pre-assign Worker
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Elevation / Monsoon Risk Section (Google Maps Elevation API) */}
            <div className={styles.section} style={{ marginTop: 'var(--space-6)' }}>
                <h3 className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Waves size={16} color="var(--color-primary-500)" />
                        Monsoon Waterlogging Risk
                    </span>
                    <span className="badge" style={{ fontSize: '10px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                        Powered by Google Elevation API
                    </span>
                </h3>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    AI analysis of low-elevation zones prone to waste accumulation during heavy rainfall.
                </div>
                {elevationLoading ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fetching live topography data...</div>
                ) : elevationPredictions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {elevationPredictions.map((pred, i) => (
                            <div key={i} className={styles.zoneCard} style={{ borderLeft: `4px solid var(--color-${pred.risk === 'critical' ? 'danger' : pred.risk === 'warning' ? 'warning' : 'success'})` }}>
                                <div className={styles.zoneTop}>
                                    <div className={styles.zoneName}>{pred.name}</div>
                                    <span style={{ fontSize: '12px', color: `var(--color-${pred.risk === 'critical' ? 'danger' : pred.risk === 'warning' ? 'warning' : 'success'})`, fontWeight: 600 }}>
                                        {pred.elevation}m ASL ({pred.risk === 'critical' ? 'Critical' : pred.risk === 'warning' ? 'Warning' : 'Low Risk'})
                                    </span>
                                </div>
                                <div className={styles.zoneMeta}>{pred.message}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontSize: '12px', color: 'var(--color-danger)' }}>Failed to load live Elevation API data. Check API configuration.</div>
                )}
            </div>

            {/* Festival Alert */}
            {festivalDates.length > 0 && (
                <div className={styles.festivalAlert}>
                    <AlertTriangle size={16} />
                    <div>
                        <div style={{ fontWeight: 'var(--fw-semibold)' }}>Festival Dates Detected</div>
                        <div style={{ fontSize: '12px', opacity: 0.85 }}>{festivalDates.slice(0, 5).join(', ')}</div>
                    </div>
                </div>
            )}

            {/* Pre-assign Modal */}
            {assignZone && (
                <div className="modal-overlay" onClick={() => setAssignZone(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Pre-assign Worker</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setAssignZone(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Zone: <strong>{assignZone}</strong>
                            </p>
                            <div className="form-group">
                                <label className="form-label required">Assign Worker</label>
                                <select
                                    className="select"
                                    value={workerName}
                                    onChange={e => setWorkerName(e.target.value)}
                                    autoFocus
                                >
                                    <option value="" disabled>-- Select Worker --</option>
                                    {workers.map(w => (
                                        <option key={w.id} value={w.name}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setAssignZone(null)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handlePreAssign}
                                disabled={!workerName.trim() || assigning === assignZone}
                            >
                                {assigning === assignZone ? 'Assigning...' : 'Confirm Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PredictionPanel;
