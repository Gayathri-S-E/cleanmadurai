import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import type { Report, ReportStatus, IssueType } from '../../../types';
import { format } from 'date-fns';
import { RefreshCw, MapPin, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import styles from '../corp-officer/OfficerDashboard.module.css';

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

export default function WorkerDashboard() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'reports'),
            where('assignedWorkerId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(
            q,
            (snap) => {
                let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Report));

                // Keep only open/assigned/in_progress
                data = data.filter(r => ['open', 'assigned', 'in_progress'].includes(r.status));

                // Sort by creation date
                data.sort((a, b) => {
                    const tA = a.createdAt?.toMillis?.() || 0;
                    const tB = b.createdAt?.toMillis?.() || 0;
                    return tB - tA; // desc
                });

                setReports(data);
                setLoading(false);
            },
            (error) => {
                console.error('Worker reports listener failed:', error);
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, [user]);

    const handleTaskClick = (reportId: string) => {
        navigate(`/worker/task/${reportId}`);
    };

    return (
        <div className={styles.page}>
            <div className={styles.queueTabContent}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>My Assigned Tasks</h1>
                        <p className={styles.subtitle}>
                            Welcome, {profile?.displayName || 'Worker'}
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className={styles.statsGrid}>
                    <div className={`${styles.statCard} ${styles.statInfo}`}>
                        <Clock size={22} />
                        <div className={styles.statVal}>{reports.length}</div>
                        <div className={styles.statLabel}>Pending Tasks</div>
                    </div>
                    <div className={`${styles.statCard} ${styles.statSuccess}`}>
                        <CheckCircle size={22} />
                        <div className={styles.statVal}>{profile?.resolvedReports || 0}</div>
                        <div className={styles.statLabel}>Completed Lifetime</div>
                    </div>
                </div>

                <div className={styles.queue}>
                    <h2 className={styles.queueTitle}>Current Assignments</h2>

                    {loading ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <RefreshCw size={28} style={{ marginBottom: '12px', opacity: 0.4 }} className="spin" />
                            <p>Loading tasks...</p>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">✅</div>
                            <div className="empty-state-title">All caught up!</div>
                            <p>You have no pending task assignments.</p>
                        </div>
                    ) : (
                        <div className={styles.reportList}>
                            {reports.map((r) => (
                                <div
                                    key={r.id}
                                    className={styles.reportRow}
                                    onClick={() => handleTaskClick(r.id)}
                                >
                                    <div className={styles.rowLeft}>
                                        <div className={styles.rowIcon} style={{ background: 'var(--bg-subtle)' }}>
                                            {ISSUE_ICONS[r.issueType as IssueType] ?? '⚠️'}
                                        </div>
                                        <div>
                                            <div className={styles.rowType}>
                                                {r.issueType.replace(/_/g, ' ')}
                                            </div>
                                            <div className={styles.rowAddress}>
                                                <MapPin size={11} style={{ display: 'inline', marginRight: '3px', opacity: 0.6 }} />
                                                {r.address?.slice(0, 70) ?? 'Location attached'}
                                            </div>
                                            <div className={styles.rowMeta}>
                                                Assigned: {r.updatedAt?.toDate
                                                    ? format(r.updatedAt.toDate(), 'dd MMM hh:mm a')
                                                    : 'Recently'}
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
            </div>
        </div>
    );
}
