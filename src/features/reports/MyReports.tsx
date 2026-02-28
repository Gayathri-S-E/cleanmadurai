import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Report, IssueType } from '../../types';
import { format, differenceInDays } from 'date-fns';
import { Clock, MapPin, ChevronRight, CheckCircle, Circle, AlertTriangle } from 'lucide-react';
import styles from './MyReports.module.css';

const STATUS_LABELS: Record<string, string> = {
    open: 'Open', assigned: 'Assigned',
    in_progress: 'In Progress', resolved: 'Resolved', rejected: 'Rejected',
};

const ISSUE_EMOJI: Record<IssueType, string> = {
    glass_on_road: '💎', garbage_pile: '🗑️', plastic_waste: '🧴',
    organic_waste: '🍂', drainage: '🌊', burning: '🔥',
    toilet_issue: '🚽', dead_animal: '⚠️', others: '❓',
};

// The linear progression of statuses
const STATUS_STEPS = ['open', 'assigned', 'in_progress', 'resolved'] as const;
type StatusStep = typeof STATUS_STEPS[number];

function ReportStepper({ status }: { status: string }) {
    const isRejected = status === 'rejected';
    const currentIdx = STATUS_STEPS.indexOf(status as StatusStep);

    if (isRejected) {
        return (
            <div className={styles.stepperRow}>
                <div className={styles.stepperItem}>
                    <div className={`${styles.stepCircle} ${styles.stepDone}`}><CheckCircle size={14} /></div>
                    <span className={styles.stepLabel}>Open</span>
                </div>
                <div className={styles.stepLine} />
                <div className={styles.stepperItem}>
                    <div className={`${styles.stepCircle} ${styles.stepRejected}`}><AlertTriangle size={14} /></div>
                    <span className={styles.stepLabel} style={{ color: 'var(--color-danger)' }}>Rejected</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.stepperRow}>
            {STATUS_STEPS.map((step, i) => {
                const isDone = currentIdx > i;
                const isActive = currentIdx === i;
                return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
                        <div className={styles.stepperItem}>
                            <div className={`${styles.stepCircle} ${isDone ? styles.stepDone : isActive ? styles.stepActive : styles.stepFuture}`}>
                                {isDone ? <CheckCircle size={14} /> : <Circle size={14} />}
                            </div>
                            <span className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ''}`}>
                                {STATUS_LABELS[step]}
                            </span>
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                            <div className={`${styles.stepLine} ${isDone ? styles.stepLineDone : ''}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function MyReports() {
    const { user } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Report | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [fallbackMode, setFallbackMode] = useState(false);

    // Real-time listener
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const q = fallbackMode
            ? query(collection(db, 'reports'), where('reporterId', '==', user.uid))
            : query(collection(db, 'reports'), where('reporterId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snap) => {
            const updated = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));
            if (fallbackMode) {
                updated.sort((a, b) => {
                    const tA = a.createdAt?.toMillis?.() || 0;
                    const tB = b.createdAt?.toMillis?.() || 0;
                    return tB - tA; // desc
                });
            }
            setReports(fallbackMode ? updated.slice(0, 50) : updated);
            setLoading(false);
            setSelected(prev => {
                if (!prev) return null;
                return updated.find(r => r.id === prev.id) ?? prev;
            });
        }, (error: any) => {
            console.error(error);
            if (!fallbackMode && String(error).includes('index')) {
                console.warn('Index missing, switching to fallback mode for MyReports');
                setFallbackMode(true);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [user, fallbackMode]);

    const getStatusClass = (status: string) =>
        `badge status-${status.replace('_', '-')}`;

    const isOverdue = (report: Report) => {
        if (['resolved', 'rejected'].includes(report.status)) return false;
        if (!report.createdAt?.toDate) return false;
        return differenceInDays(new Date(), report.createdAt.toDate()) >= 3;
    };

    const filteredReports = filterStatus === 'all'
        ? reports
        : reports.filter(r => r.status === filterStatus);

    // Last officer note from status history
    const lastOfficerNote = (report: Report) => {
        if (!report.statusHistory?.length) return null;
        const notes = [...report.statusHistory].reverse().find(h => h.note);
        return notes?.note ?? null;
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.header}>
                    <h1 className={styles.title}>My Reports</h1>
                </div>
                <div className={styles.list}>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className={styles.skeletonCard}>
                            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-xl)' }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div className="skeleton" style={{ height: '16px', width: '60%' }} />
                                <div className="skeleton" style={{ height: '12px', width: '80%' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>My Reports</h1>
                <span style={{ fontSize: '12px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                    Live
                </span>
            </div>

            {/* Summary stats */}
            {reports.length > 0 && (
                <div className={styles.statsRow}>
                    {(['all', 'open', 'in_progress', 'resolved'] as const).map(s => {
                        const count = s === 'all' ? reports.length : reports.filter(r => r.status === s).length;
                        return (
                            <button
                                key={s}
                                className={`${styles.statChip} ${filterStatus === s ? styles.statChipActive : ''}`}
                                onClick={() => setFilterStatus(s)}
                            >
                                <span className={styles.statCount}>{count}</span>
                                <span className={styles.statLabel}>{s === 'all' ? 'All' : STATUS_LABELS[s]}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {filteredReports.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">
                        {reports.length === 0 ? 'No reports yet' : `No ${STATUS_LABELS[filterStatus]} reports`}
                    </div>
                    <p>{reports.length === 0 ? 'Start reporting issues in your area to track them here!' : 'Try a different filter above.'}</p>
                    {reports.length === 0 && (
                        <a href="/report" className="btn btn-primary" style={{ marginTop: '16px' }}>Report an Issue</a>
                    )}
                </div>
            ) : (
                <>
                    <div className={styles.list}>
                        {filteredReports.map((report) => (
                            <div key={report.id} className={styles.reportCard} onClick={() => setSelected(report)}>
                                <div className={styles.reportEmoji}>
                                    {ISSUE_EMOJI[report.issueType] ?? '❓'}
                                </div>
                                <div className={styles.reportInfo}>
                                    <div className={styles.reportType}>
                                        {report.issueType.replace(/_/g, ' ')}
                                        {report.isGlassSOS && <span className="badge badge-danger" style={{ marginLeft: '8px' }}>SOS</span>}
                                        {isOverdue(report) && (
                                            <span className="badge badge-warning" style={{ marginLeft: '8px' }}>⚠️ Overdue</span>
                                        )}
                                    </div>
                                    <div className={styles.reportMeta}>
                                        <MapPin size={12} />
                                        <span>{report.address ? report.address.slice(0, 50) + (report.address.length > 50 ? '…' : '') : 'Location attached'}</span>
                                    </div>
                                    <div className={styles.reportMeta}>
                                        <Clock size={12} />
                                        <span>
                                            {report.createdAt?.toDate
                                                ? format(report.createdAt.toDate(), 'dd MMM yyyy, hh:mm a')
                                                : 'Just now'}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.reportRight}>
                                    <span className={getStatusClass(report.status)}>
                                        {STATUS_LABELS[report.status]}
                                    </span>
                                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Detail modal */}
                    {selected && (
                        <div className="modal-overlay" onClick={() => setSelected(null)}>
                            <div className="modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h3 className="modal-title">
                                        {ISSUE_EMOJI[selected.issueType]} {selected.issueType.replace(/_/g, ' ')}
                                    </h3>
                                    <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button>
                                </div>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                    {/* Progress Stepper */}
                                    <div className={styles.stepperCard}>
                                        <div className={styles.stepperTitle}>Progress</div>
                                        <ReportStepper status={selected.status} />
                                        {isOverdue(selected) && (
                                            <div className={styles.overdueAlert}>
                                                ⚠️ This report has been open for more than 3 days. Officers have been notified.
                                            </div>
                                        )}
                                    </div>

                                    {/* Before / After Photos */}
                                    {selected.afterPhotoURL ? (
                                        <div>
                                            <div className={styles.photoLabel}>Before & After</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                <div>
                                                    <div className={styles.photoTag}>Before</div>
                                                    <img src={selected.photoURL} alt="Before" style={{ width: '100%', borderRadius: 'var(--radius-lg)', aspectRatio: '4/3', objectFit: 'cover' }} />
                                                </div>
                                                <div>
                                                    <div className={styles.photoTag} style={{ color: 'var(--color-success)' }}>After ✓</div>
                                                    <img src={selected.afterPhotoURL} alt="After" style={{ width: '100%', borderRadius: 'var(--radius-lg)', aspectRatio: '4/3', objectFit: 'cover' }} />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        selected.photoURL && (
                                            <img src={selected.photoURL} alt="Report" style={{ width: '100%', borderRadius: 'var(--radius-xl)', aspectRatio: '4/3', objectFit: 'cover' }} />
                                        )
                                    )}

                                    {/* Officer note */}
                                    {lastOfficerNote(selected) && (
                                        <div className={styles.officerNote}>
                                            <div className={styles.officerNoteLabel}>💬 Officer Note</div>
                                            <p>{lastOfficerNote(selected)}</p>
                                        </div>
                                    )}

                                    {/* Details */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)' }}>Priority</span>
                                            <span className={`badge ${selected.priority === 'sos' ? 'badge-danger' : selected.priority === 'high' ? 'badge-warning' : 'badge-muted'}`}>
                                                {selected.priority?.toUpperCase()}
                                            </span>
                                        </div>
                                        {selected.description && (
                                            <div>
                                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)' }}>Description</span>
                                                <p style={{ marginTop: '4px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{selected.description}</p>
                                            </div>
                                        )}
                                        <div>
                                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)' }}>Location</span>
                                            <p style={{ marginTop: '4px', fontSize: 'var(--text-sm)' }}>📍 {selected.address || 'Location attached'}</p>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)' }}>Submitted</span>
                                            <p style={{ marginTop: '4px', fontSize: 'var(--text-sm)' }}>
                                                {selected.createdAt?.toDate ? format(selected.createdAt.toDate(), 'dd MMM yyyy, hh:mm a') : '—'}
                                            </p>
                                        </div>
                                        {selected.resolvedAt?.toDate && (
                                            <div>
                                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', fontWeight: 'var(--fw-semibold)' }}>Resolved</span>
                                                <p style={{ marginTop: '4px', fontSize: 'var(--text-sm)' }}>
                                                    ✅ {format(selected.resolvedAt.toDate(), 'dd MMM yyyy, hh:mm a')}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status history timeline */}
                                    {selected.statusHistory?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)', marginBottom: '10px' }}>
                                                Activity Timeline
                                            </div>
                                            <div className={styles.timeline}>
                                                {[...selected.statusHistory].reverse().map((h, i) => {
                                                    const ts = h.timestamp?.toDate ? h.timestamp.toDate() : (typeof h.timestamp === 'string' ? new Date(h.timestamp) : null);
                                                    return (
                                                        <div key={i} className={styles.timelineItem}>
                                                            <div className={styles.timelineDot} />
                                                            <div className={styles.timelineContent}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                    <span className={getStatusClass(h.status)}>{STATUS_LABELS[h.status]}</span>
                                                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                                        by {h.changedByName}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                                    {ts ? format(ts, 'dd MMM, hh:mm a') : 'Unknown time'}
                                                                </div>
                                                                {h.note && (
                                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                                                                        "{h.note}"
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default MyReports;
