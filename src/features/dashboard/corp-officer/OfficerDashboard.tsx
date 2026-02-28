import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import {
    collection, query, where, orderBy, getDocs,
    doc, updateDoc, serverTimestamp, limit, onSnapshot,
    addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import type { Report, ReportStatus } from '../../../types';
import { format } from 'date-fns';
import {
    AlertTriangle, CheckCircle, Clock, User, RefreshCw,
    Upload, ChevronRight, Filter, Flame, PartyPopper,
    X, MapPin, Calendar, Brain, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './OfficerDashboard.module.css';

const PredictionPanel = lazy(() => import('./PredictionPanel'));
const WorkerWelfare = lazy(() => import('./WorkerWelfare'));

type DashTab = 'queue' | 'predictions' | 'workers';

const STATUS_OPTIONS: { value: ReportStatus; label: string; color: string }[] = [
    { value: 'open', label: 'Open', color: '#EF4444' },
    { value: 'assigned', label: 'Assigned', color: '#F59E0B' },
    { value: 'in_progress', label: 'In Progress', color: '#3B82F6' },
    { value: 'resolved', label: 'Resolved', color: '#10B981' },
    { value: 'rejected', label: 'Rejected', color: '#6B7280' },
    { value: 'verified', label: 'AI Verified ✅', color: '#7C3AED' },
];

const ISSUE_ICONS: Record<string, string> = {
    glass_on_road: '💎',
    garbage_pile: '🗑️',
    burning: '🔥',
    plastic_waste: '🧴',
    organic_waste: '🌿',
    drainage: '💧',
    toilet_issue: '🚽',
    dead_animal: '⚠️',
    others: '📍',
};

const priorityOrder: Record<string, number> = { sos: 4, high: 3, normal: 2, low: 1 };

function PriorityBadge({ priority, isSOS }: { priority: string; isSOS?: boolean }) {
    if (isSOS) return <span className="badge badge-danger" style={{ fontSize: '11px' }}>⚡ GLASS SOS</span>;
    if (priority === 'high') return <span className="badge badge-warning" style={{ fontSize: '11px' }}>🔴 HIGH</span>;
    if (priority === 'low') return <span className="badge" style={{ fontSize: '11px', background: 'var(--bg-subtle)' }}>LOW</span>;
    return null;
}

function StatusBadge({ status }: { status: ReportStatus }) {
    const map: Record<ReportStatus, { label: string; cls: string }> = {
        open: { label: 'Open', cls: 'badge-danger' },
        assigned: { label: 'Assigned', cls: 'badge-warning' },
        in_progress: { label: 'In Progress', cls: 'badge-info' },
        resolved: { label: 'Resolved', cls: 'badge-success' },
        rejected: { label: 'Rejected', cls: '' },
        verified: { label: 'Verified', cls: 'badge-success' },
    };
    const s = map[status] ?? { label: status, cls: '' };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function OfficerDashboard() {
    const { user, profile, hasRole } = useAuth();
    const { tab } = useParams<{ tab: string }>();
    const dashTab = (tab as DashTab) || 'queue';
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Report | null>(null);
    const [newStatus, setNewStatus] = useState<ReportStatus>('open');
    const [workerName, setWorkerName] = useState('');
    const [workers, setWorkers] = useState<{ id: string, name: string }[]>([]);
    const [note, setNote] = useState('');
    const [updating, setUpdating] = useState(false);
    const [afterPhotoFile, setAfterPhotoFile] = useState<File | null>(null);
    const [filterStatus, setFilterStatus] = useState<ReportStatus | 'all'>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [festivalMode, setFestivalMode] = useState(false);
    const [festivalZones, setFestivalZones] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [liveConnected, setLiveConnected] = useState(false);
    const [useWardFilter, setUseWardFilter] = useState(true);
    const [fallbackMode, setFallbackMode] = useState(false);

    // Real-time listener: replaces getDocs so officers see new reports instantly
    useEffect(() => {
        setLoading(true);
        setLiveConnected(false);

        const sortReports = (data: Report[]) => {
            data.sort((a, b) => {
                const pa = a.isGlassSOS ? 5 : (priorityOrder[a.priority] ?? 1);
                const pb = b.isGlassSOS ? 5 : (priorityOrder[b.priority] ?? 1);
                return pb - pa;
            });
            return data;
        };

        const constraints: any[] = [
            where('status', 'in', ['open', 'assigned', 'in_progress']),
        ];

        if (!fallbackMode) {
            constraints.push(orderBy('createdAt', 'desc'));
            constraints.push(limit(150));
        }

        // Zonal officers see all wards in their zone; ward officers see only their ward
        const skipWardFilter = !useWardFilter ||
            ['corp_admin', 'system_admin', 'zonal_officer', 'sanitation_worker'].some(r => profile?.roles?.includes(r as any));
        if (profile?.ward && !skipWardFilter) {
            constraints.unshift(where('ward', '==', profile.ward));
        }

        const q = query(collection(db, 'reports'), ...constraints);
        const unsubscribe = onSnapshot(
            q,
            (snap) => {
                let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Report));
                if (fallbackMode) {
                    data.sort((a, b) => {
                        const tA = a.createdAt?.toMillis?.() || 0;
                        const tB = b.createdAt?.toMillis?.() || 0;
                        return tB - tA; // desc
                    });
                    data = data.slice(0, 150);
                }
                setReports(sortReports(data));
                setLoading(false);
                setLiveConnected(true);
            },
            (error: any) => {
                console.error('Reports listener failed:', error);
                if (!fallbackMode && String(error).includes('index')) {
                    console.warn('Index missing, switching to fallback mode for OfficerDashboard');
                    setFallbackMode(true);
                } else if (useWardFilter) {
                    setUseWardFilter(false);
                } else {
                    setLoading(false);
                }
            }
        );
        return () => unsubscribe();
    }, [profile?.ward, profile?.roles, useWardFilter, fallbackMode]);

    const [festivalKeyStreets, setFestivalKeyStreets] = useState<string[]>([]);
    const [predictedHighWasteZones, setPredictedHighWasteZones] = useState<string[]>([]);

    // Fetch festival/special zone data; PR-55: key streets + predicted high waste
    useEffect(() => {
        const fetchZones = async () => {
            try {
                const snap = await getDocs(collection(db, 'specialZones'));
                const today = new Date().toISOString().slice(0, 10);
                const zones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                const active = zones.filter((z: any) => z.isActive && z.festivalDays?.includes(today)).map((z: any) => z.name);
                if (active.length > 0) {
                    setFestivalZones(active);
                    setFestivalMode(true);
                    setPredictedHighWasteZones(active);
                    const keyStreets = active.flatMap((name: string) => [
                        `${name} – North St`,
                        `${name} – East St`,
                        `${name} – Main Rd`,
                    ]);
                    setFestivalKeyStreets(keyStreets);
                }
            } catch { /* no special zones collection yet */ }
        };
        fetchZones();

        const fetchWorkers = async () => {
            try {
                const snap = await getDocs(query(collection(db, 'users'), where('roles', 'array-contains', 'sanitation_worker'), limit(50)));
                const w = snap.docs.map(d => ({ id: d.id, name: d.data().displayName || d.data().email || 'Worker' }));
                setWorkers(w);
            } catch (e) {
                console.error('Failed to load workers', e);
            }
        };
        fetchWorkers();
    }, []);

    // Reports subscription is managed by the onSnapshot useEffect above

    const handleUpdateStatus = async () => {
        if (!selected || !user || !profile) return;
        setUpdating(true);
        try {
            let afterPhotoURL: string | undefined;
            if (afterPhotoFile && newStatus === 'resolved') {
                const afRef = ref(storage, `reports/after/${selected.id}_${Date.now()}`);
                await uploadBytes(afRef, afterPhotoFile);
                afterPhotoURL = await getDownloadURL(afRef);
            }

            const historyEntry = {
                status: newStatus,
                changedBy: user.uid,
                changedByName: profile.displayName,
                timestamp: new Date().toISOString(),
                note,
            };

            await updateDoc(doc(db, 'reports', selected.id), {
                status: newStatus,
                assignedWorker: workerName || null,
                updatedAt: serverTimestamp(),
                resolvedAt: newStatus === 'resolved' ? serverTimestamp() : null,
                afterPhotoURL: afterPhotoURL ?? null,
                statusHistory: [...(selected.statusHistory ?? []), historyEntry],
            });

            if (selected.reporterId) {
                try {
                    await addDoc(collection(db, `users/${selected.reporterId}/notifications`), {
                        title: `Report Update: ${selected.issueType.replace(/_/g, ' ')}`,
                        body: `Your report status has been updated to "${newStatus.replace(/_/g, ' ')}" by our responding officer.`,
                        type: 'status_update',
                        read: false,
                        createdAt: serverTimestamp(),
                        link: `/my-reports`
                    });
                } catch (e) {
                    console.error("Failed to send notification:", e);
                }
            }

            toast.success(`Status updated to "${newStatus}"!`);
            setSelected(null);
            setAfterPhotoFile(null);
            // onSnapshot listener auto-refreshes the queue
        } catch (e: any) {
            toast.error('Failed to update: ' + e.message);
        } finally {
            setUpdating(false);
        }
    };

    const selectReport = (r: Report) => {
        setSelected(r);
        setNewStatus(r.status);
        setWorkerName(r.assignedWorker ?? '');
        setNote('');
        setAfterPhotoFile(null);
    };

    // Derived stats
    const openCount = reports.filter(r => r.status === 'open').length;
    const assignedCount = reports.filter(r => r.status === 'assigned').length;
    const inProgressCount = reports.filter(r => r.status === 'in_progress').length;
    const sosCount = reports.filter(r => r.isGlassSOS).length;

    // Filtering
    const filteredReports = reports.filter(r => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (filterType !== 'all' && r.issueType !== filterType) return false;
        return true;
    });

    const uniqueTypes = [...new Set(reports.map(r => r.issueType))];

    return (
        <div className={styles.page}>
            {/* Tab buttons removed — navigation is now via sidebar links */}


            {/* AI Predictions Tab — corp_officer/zonal_officer/ward_officer only (not sanitation_worker) */}
            {dashTab === 'predictions' && (
                hasRole(['corp_officer', 'zonal_officer', 'ward_officer', 'corp_admin', 'system_admin', 'super_admin']) ? (
                    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading predictions...</div>}>
                        <PredictionPanel />
                    </Suspense>
                ) : (
                    <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                        <div className="empty-state-icon">🔒</div>
                        <div className="empty-state-title">Access Restricted</div>
                        <p>AI Predictions are available to officers and above. Your role ({profile?.roles?.join(', ')}) does not have access to this section.</p>
                    </div>
                )
            )}

            {/* Worker Welfare Tab — corp_officer and above only */}
            {dashTab === 'workers' && (
                hasRole(['corp_officer', 'corp_admin', 'system_admin', 'super_admin']) ? (
                    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading worker data...</div>}>
                        <WorkerWelfare />
                    </Suspense>
                ) : (
                    <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                        <div className="empty-state-icon">🔒</div>
                        <div className="empty-state-title">Access Restricted</div>
                        <p>Worker Welfare management is available to Corporation Officers and above. Your current role ({profile?.roles?.join(', ')}) does not include this feature.</p>
                    </div>
                )
            )}

            {/* Report Queue Tab (existing content) */}
            {dashTab === 'queue' && <div className={styles.queueTabContent}>

                {/* Festival Mode Banner */}
                {festivalMode && festivalZones.length > 0 && (
                    <>
                        <div style={{
                            background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
                            color: 'white',
                            padding: '12px 20px',
                            borderRadius: 'var(--radius-xl)',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 'var(--fw-semibold)',
                            boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
                        }}>
                            <PartyPopper size={20} />
                            <div>
                                <div style={{ fontWeight: 'var(--fw-bold)' }}>🎉 Festival Mode Active</div>
                                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                    Special zones: {festivalZones.join(', ')}
                                </div>
                            </div>
                        </div>
                        {/* PR-55: Key streets + predicted high waste */}
                        <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '12px 16px',
                            marginBottom: '20px',
                        }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)', marginBottom: '6px' }}>
                                Key streets (predicted high waste)
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-primary)' }}>
                                {festivalKeyStreets.slice(0, 6).map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ul>
                            <div style={{ fontSize: '12px', color: 'var(--color-warning)', marginTop: '8px' }}>
                                Predicted high waste zones today: {predictedHighWasteZones.join(', ')}
                            </div>
                        </div>
                    </>
                )}

                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>
                            {hasRole('zonal_officer') ? 'Zonal Officer Dashboard'
                                : hasRole('ward_officer') ? 'Ward Officer Dashboard'
                                    : hasRole('sanitation_worker') ? 'Sanitation Worker Panel'
                                        : 'Officer Dashboard'}
                        </h1>
                        <p className={styles.subtitle}>
                            <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />
                            Ward: <strong>{profile?.ward ?? 'All Wards'}</strong>
                            {' · '}
                            <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                            {format(new Date(), 'dd MMM yyyy')}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            className={`btn btn-outline btn-sm ${showFilters ? 'btn-primary' : ''}`}
                            onClick={() => setShowFilters(v => !v)}
                        >
                            <Filter size={14} /> Filters {filterStatus !== 'all' || filterType !== 'all' ? '●' : ''}
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: liveConnected ? 'var(--color-success)' : 'var(--text-muted)', padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: liveConnected ? '#10B981' : loading ? '#F59E0B' : '#9CA3AF', display: 'inline-block', flexShrink: 0 }} />
                            {liveConnected ? 'Live' : loading ? 'Connecting…' : 'Reconnecting…'}
                        </div>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '16px 20px',
                        marginBottom: '16px',
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                    }}>
                        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
                            <label className="form-label" style={{ marginBottom: '6px' }}>Status</label>
                            <select className="select" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                                <option value="all">All Statuses</option>
                                {STATUS_OPTIONS.slice(0, 3).map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
                            <label className="form-label" style={{ marginBottom: '6px' }}>Issue Type</label>
                            <select className="select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                                <option value="all">All Types</option>
                                {uniqueTypes.map(t => (
                                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStatus('all'); setFilterType('all'); }}>
                            Clear
                        </button>
                    </div>
                )}

                {/* Stats */}
                <div className={styles.statsGrid}>
                    <div className={`${styles.statCard} ${styles.statDanger}`}>
                        <Flame size={22} />
                        <div className={styles.statVal}>{sosCount}</div>
                        <div className={styles.statLabel}>Glass SOS</div>
                    </div>
                    <div className={`${styles.statCard} ${styles.statWarning}`}>
                        <AlertTriangle size={22} />
                        <div className={styles.statVal}>{openCount}</div>
                        <div className={styles.statLabel}>Open</div>
                    </div>
                    <div className={`${styles.statCard} ${styles.statInfo}`}>
                        <Clock size={22} />
                        <div className={styles.statVal}>{assignedCount}</div>
                        <div className={styles.statLabel}>Assigned</div>
                    </div>
                    <div className={`${styles.statCard} ${styles.statPrimary}`}>
                        <User size={22} />
                        <div className={styles.statVal}>{inProgressCount}</div>
                        <div className={styles.statLabel}>In Progress</div>
                    </div>
                    <div className={`${styles.statCard} ${styles.statSuccess}`}>
                        <CheckCircle size={22} />
                        <div className={styles.statVal}>{reports.length}</div>
                        <div className={styles.statLabel}>Total Queue</div>
                    </div>
                </div>

                {/* Report Queue */}
                <div className={styles.queue}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h2 className={styles.queueTitle}>
                            Report Queue
                            {filteredReports.length !== reports.length && (
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'var(--fw-normal)', marginLeft: '8px' }}>
                                    ({filteredReports.length} of {reports.length})
                                </span>
                            )}
                        </h2>
                    </div>

                    {loading ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <RefreshCw size={28} style={{ marginBottom: '12px', opacity: 0.4 }} className="spin" />
                            <p>Loading reports...</p>
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">✅</div>
                            <div className="empty-state-title">All clear!</div>
                            <p>No reports matching the current filter for your ward.</p>
                        </div>
                    ) : (
                        <div className={styles.reportList}>
                            {filteredReports.map(r => (
                                <div
                                    key={r.id}
                                    className={`${styles.reportRow} ${r.isGlassSOS ? styles.sosRow : ''}`}
                                    onClick={() => selectReport(r)}
                                >
                                    <div className={styles.rowLeft}>
                                        <div
                                            className={styles.rowIcon}
                                            style={{
                                                background: r.isGlassSOS
                                                    ? 'rgba(239,68,68,0.12)'
                                                    : r.priority === 'high'
                                                        ? 'rgba(245,158,11,0.12)'
                                                        : 'var(--bg-subtle)',
                                            }}
                                        >
                                            {ISSUE_ICONS[r.issueType] ?? '⚠️'}
                                        </div>
                                        <div>
                                            <div className={styles.rowType}>
                                                {r.issueType.replace(/_/g, ' ')}
                                                <PriorityBadge priority={r.priority} isSOS={r.isGlassSOS} />
                                            </div>
                                            <div className={styles.rowAddress}>
                                                <MapPin size={11} style={{ display: 'inline', marginRight: '3px', opacity: 0.6 }} />
                                                {r.address?.slice(0, 70) ?? 'Location attached'}
                                            </div>
                                            <div className={styles.rowMeta}>
                                                {r.createdAt?.toDate
                                                    ? format(r.createdAt.toDate(), 'dd MMM hh:mm a')
                                                    : 'Just now'}
                                                {r.ward && <> · Ward {r.ward}</>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.rowRight}>
                                        <StatusBadge status={r.status} />
                                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Update Modal */}
                {selected && (
                    <div className="modal-overlay" onClick={() => setSelected(null)}>
                        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '95%' }}>
                            <div className="modal-header">
                                <div>
                                    <h3 className="modal-title">Update Report</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                                        {selected.issueType.replace(/_/g, ' ')} · {selected.address?.slice(0, 50)}
                                    </p>
                                </div>
                                <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="modal-body">
                                {/* Before Photo */}
                                {selected.photoURL && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'var(--fw-semibold)' }}>
                                            📸 BEFORE PHOTO
                                        </div>
                                        <img
                                            src={selected.photoURL}
                                            alt="Issue"
                                            style={{
                                                width: '100%', borderRadius: 'var(--radius-xl)',
                                                aspectRatio: '16/9', objectFit: 'cover',
                                                border: '1px solid var(--border-subtle)',
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Status Timeline */}
                                {selected.statusHistory && selected.statusHistory.length > 0 && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'var(--fw-semibold)' }}>
                                            📋 STATUS HISTORY
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                                            {selected.statusHistory.map((h, i) => (
                                                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
                                                    <StatusBadge status={h.status} />
                                                    <span style={{ color: 'var(--text-muted)' }}>by {h.changedByName}</span>
                                                    {h.note && <span style={{ color: 'var(--text-secondary)' }}>— {h.note}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 🤖 AI Verification Result Card */}
                                {(selected.aiImprovement || selected.aiVerified) && (
                                    <div style={{
                                        background: selected.aiVerified ? 'rgba(124,58,237,0.07)' : 'rgba(245,158,11,0.07)',
                                        border: `1px solid ${selected.aiVerified ? '#7C3AED' : '#F59E0B'}`,
                                        borderRadius: 'var(--radius-xl)',
                                        padding: '12px 16px',
                                        marginBottom: '14px',
                                    }}>
                                        <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Brain size={14} style={{ color: selected.aiVerified ? '#7C3AED' : '#F59E0B' }} />
                                            🤖 AI Verification
                                            {selected.aiVerified
                                                ? <span className="badge" style={{ background: '#7C3AED', color: '#fff', fontSize: '10px', marginLeft: 'auto' }}>AUTO-VERIFIED</span>
                                                : <span className="badge badge-warning" style={{ fontSize: '10px', marginLeft: 'auto' }}>NEEDS REVIEW</span>}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                                            {selected.aiConfidence != null && (
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>Confidence: </span>
                                                    <strong style={{ color: (selected.aiConfidence ?? 0) >= 0.75 ? '#10B981' : '#F59E0B' }}>
                                                        {Math.round((selected.aiConfidence ?? 0) * 100)}%
                                                    </strong>
                                                </div>
                                            )}
                                            {selected.aiImprovement && (
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>Improvement: </span>
                                                    <span className="badge" style={{
                                                        fontSize: '10px',
                                                        background: selected.aiImprovement === 'COMPLETE' ? '#10B981'
                                                            : selected.aiImprovement === 'SIGNIFICANT' ? '#22C55E'
                                                                : selected.aiImprovement === 'PARTIAL' ? '#F59E0B' : '#6B7280',
                                                        color: '#fff',
                                                    }}>
                                                        {selected.aiImprovement}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {selected.aiVerifyNote && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                                                "{selected.aiVerifyNote}"
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div className="form-group">
                                        <label className="form-label required">New Status</label>
                                        <select
                                            className="select"
                                            value={newStatus}
                                            onChange={e => setNewStatus(e.target.value as ReportStatus)}
                                        >
                                            {STATUS_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Assign Worker</label>
                                        <select
                                            className="select"
                                            value={workerName}
                                            onChange={e => setWorkerName(e.target.value)}
                                        >
                                            <option value="">-- Unassigned --</option>
                                            {workers.map(w => (
                                                <option key={w.id} value={w.name}>{w.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Note / Remarks</label>
                                        <textarea
                                            className="textarea"
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                            placeholder="Any remarks for audit log..."
                                            rows={2}
                                        />
                                    </div>

                                    {newStatus === 'resolved' && (
                                        <div className="form-group" style={{
                                            background: 'var(--color-success-bg)',
                                            border: '1px solid var(--color-success)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: '12px 16px',
                                        }}>
                                            <label className="form-label" style={{ color: 'var(--color-success)' }}>
                                                <Upload size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                                After Photo (Proof of Resolution)
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={e => setAfterPhotoFile(e.target.files?.[0] ?? null)}
                                                style={{ marginTop: '6px' }}
                                            />
                                            {afterPhotoFile && (
                                                <div style={{ fontSize: '12px', color: 'var(--color-success)', marginTop: '4px' }}>
                                                    ✓ {afterPhotoFile.name}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cancel</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpdateStatus}
                                    disabled={updating}
                                >
                                    {updating ? (
                                        <><RefreshCw size={14} className="spin" /> Updating...</>
                                    ) : (
                                        <>✓ Update Status</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            }

        </div>
    );
}

export default OfficerDashboard;
