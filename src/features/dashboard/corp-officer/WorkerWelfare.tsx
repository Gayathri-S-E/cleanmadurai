import { useState, useEffect } from 'react';
import {
    collection, query, where, getDocs, orderBy, limit,
    addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { Users, Clock, CheckCircle, AlertTriangle, Shield, TrendingUp, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './WorkerWelfare.module.css';

interface SanitationWorker {
    id: string;
    displayName: string;
    ward: string;
    photoURL?: string;
    tasksCompleted?: number;
    avgResponseHrs?: number;
    performanceScore?: number;
    lastActive?: any;
    roles: string[];
}

interface SafetyLog {
    id: string;
    incident: string;
    reportedBy: string;
    date: string;
    severity: 'low' | 'medium' | 'high';
    workerId: string;
    workerName: string;
}

function WorkerWelfare() {
    const { user, profile } = useAuth();
    const [workers, setWorkers] = useState<SanitationWorker[]>([]);
    const [safetyLogs, setSafetyLogs] = useState<SafetyLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedWorker, setSelectedWorker] = useState<SanitationWorker | null>(null);
    const [logIncident, setLogIncident] = useState('');
    const [logSeverity, setLogSeverity] = useState<'low' | 'medium' | 'high'>('low');
    const [submittingLog, setSubmittingLog] = useState(false);
    const [showLogForm, setShowLogForm] = useState(false);

    useEffect(() => {
        loadWorkers();
        loadSafetyLogs();
    }, []);

    const loadWorkers = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'users'),
                    where('roles', 'array-contains', 'sanitation_worker'),
                    limit(50)
                )
            );

            // Compute performance from resolved reports
            const workerList: SanitationWorker[] = await Promise.all(snap.docs.map(async (d) => {
                const data = d.data();
                // Fetch reports assigned to this worker in last 30 days
                let tasksCompleted = 0;
                let totalHrs = 0;
                try {
                    const resolvedSnap = await getDocs(
                        query(collection(db, 'reports'),
                            where('assignedWorker', '==', data.displayName),
                            where('status', '==', 'resolved'),
                            limit(30)
                        )
                    );
                    tasksCompleted = resolvedSnap.size;
                    resolvedSnap.docs.forEach(r => {
                        const created = r.data().createdAt?.toDate?.();
                        const resolved = r.data().resolvedAt?.toDate?.();
                        if (created && resolved) {
                            totalHrs += (resolved.getTime() - created.getTime()) / 3600000;
                        }
                    });
                } catch {/* skip */ }

                const avgResponse = tasksCompleted > 0 ? totalHrs / tasksCompleted : 0;
                const score = Math.min(100, Math.round(
                    (tasksCompleted * 10) - (avgResponse > 4 ? (avgResponse - 4) * 5 : 0) + 50
                ));

                return {
                    id: d.id,
                    displayName: data.displayName ?? 'Worker',
                    ward: data.ward ?? '—',
                    photoURL: data.photoURL,
                    tasksCompleted,
                    avgResponseHrs: Math.round(avgResponse * 10) / 10,
                    performanceScore: Math.max(0, score),
                    lastActive: data.lastActive,
                    roles: data.roles ?? [],
                };
            }));

            setWorkers(workerList.sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0)));
        } catch (e) {
            console.error('Worker load error:', e);
        } finally {
            setLoading(false);
        }
    };

    const loadSafetyLogs = async () => {
        try {
            const snap = await getDocs(
                query(collection(db, 'safetyLogs'), orderBy('createdAt', 'desc'), limit(20))
            );
            setSafetyLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SafetyLog)));
        } catch {/* no logs yet */ }
    };

    const handleLogSubmit = async () => {
        if (!selectedWorker || !logIncident.trim() || !user || !profile) return;
        setSubmittingLog(true);
        try {
            await addDoc(collection(db, 'safetyLogs'), {
                workerId: selectedWorker.id,
                workerName: selectedWorker.displayName,
                incident: logIncident.trim(),
                severity: logSeverity,
                reportedBy: profile.displayName,
                reportedById: user.uid,
                date: new Date().toISOString().slice(0, 10),
                createdAt: serverTimestamp(),
            });
            toast.success('Safety incident logged!');
            setShowLogForm(false);
            setLogIncident('');
            setLogSeverity('low');
            await loadSafetyLogs();
        } catch (e: any) {
            toast.error('Failed to log: ' + e.message);
        } finally {
            setSubmittingLog(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'var(--color-success)';
        if (score >= 50) return 'var(--color-warning)';
        return 'var(--color-danger)';
    };

    const getSeverityClass = (s: string) => {
        if (s === 'high') return 'badge-danger';
        if (s === 'medium') return 'badge-warning';
        return 'badge-info';
    };

    // Summary stats
    const avgScore = workers.length ? Math.round(workers.reduce((a, w) => a + (w.performanceScore ?? 0), 0) / workers.length) : 0;
    const totalTasks = workers.reduce((a, w) => a + (w.tasksCompleted ?? 0), 0);
    const topWorker = workers[0];

    return (
        <div className={styles.panel}>
            <div className={styles.panelHeader}>
                <div className={styles.headerIcon}><Shield size={20} /></div>
                <div>
                    <h2 className={styles.panelTitle}>Sanitation Worker Welfare</h2>
                    <p className={styles.panelSubtitle}>Response time tracking · Safety logs · Performance scoring</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <Users size={20} style={{ color: 'var(--color-primary-500)' }} />
                    <div className={styles.summaryVal}>{workers.length}</div>
                    <div className={styles.summaryLabel}>Active Workers</div>
                </div>
                <div className={styles.summaryCard}>
                    <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                    <div className={styles.summaryVal}>{totalTasks}</div>
                    <div className={styles.summaryLabel}>Tasks Completed</div>
                </div>
                <div className={styles.summaryCard}>
                    <TrendingUp size={20} style={{ color: 'var(--color-warning)' }} />
                    <div className={styles.summaryVal}>{avgScore}</div>
                    <div className={styles.summaryLabel}>Avg Performance</div>
                </div>
                <div className={styles.summaryCard}>
                    <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />
                    <div className={styles.summaryVal}>{safetyLogs.length}</div>
                    <div className={styles.summaryLabel}>Safety Logs</div>
                </div>
            </div>

            {/* Top Performer */}
            {topWorker && (
                <div className={styles.topPerformer}>
                    <Star size={16} style={{ color: '#F5A623' }} />
                    <span>Top Performer: <strong>{topWorker.displayName}</strong></span>
                    <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--color-success)' }}>
                        Score: {topWorker.performanceScore}
                    </span>
                </div>
            )}

            {/* Worker List */}
            <div className={styles.section}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 className={styles.sectionTitle}><Users size={15} /> Worker Performance</h3>
                    {selectedWorker && (
                        <button className="btn btn-outline btn-sm" onClick={() => setShowLogForm(true)}>
                            + Log Safety Incident
                        </button>
                    )}
                </div>

                {loading ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading workers...</div>
                ) : workers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👷</div>
                        <div className="empty-state-title">No sanitation workers found</div>
                        <p>Workers with the sanitation_worker role will appear here.</p>
                    </div>
                ) : (
                    <div className={styles.workerList}>
                        {workers.map(w => (
                            <div
                                key={w.id}
                                className={`${styles.workerCard} ${selectedWorker?.id === w.id ? styles.workerSelected : ''}`}
                                onClick={() => setSelectedWorker(w.id === selectedWorker?.id ? null : w)}
                            >
                                <div className={styles.workerAvatar}>
                                    {w.photoURL ? (
                                        <img src={w.photoURL} alt={w.displayName} />
                                    ) : (
                                        <span>{w.displayName[0]?.toUpperCase()}</span>
                                    )}
                                </div>
                                <div className={styles.workerInfo}>
                                    <div className={styles.workerName}>{w.displayName}</div>
                                    <div className={styles.workerMeta}>Ward {w.ward} · {w.tasksCompleted} tasks</div>
                                    <div className={styles.workerMeta}>
                                        <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                                        Avg response: {w.avgResponseHrs}h
                                    </div>
                                </div>
                                <div className={styles.workerScore}>
                                    <div
                                        className={styles.scoreCircle}
                                        style={{ borderColor: getScoreColor(w.performanceScore ?? 0) }}
                                    >
                                        <span style={{ color: getScoreColor(w.performanceScore ?? 0) }}>
                                            {w.performanceScore}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>score</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Safety Logs */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}><AlertTriangle size={15} /> Recent Safety Logs</h3>
                {safetyLogs.length === 0 ? (
                    <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>No safety incidents logged yet.</div>
                ) : (
                    <div className={styles.logList}>
                        {safetyLogs.map(log => (
                            <div key={log.id} className={styles.logRow}>
                                <span className={`badge ${getSeverityClass(log.severity)}`} style={{ fontSize: '11px' }}>
                                    {log.severity.toUpperCase()}
                                </span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 'var(--fw-medium)' }}>{log.workerName}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.incident}</div>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{log.date}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Safety Log Modal */}
            {showLogForm && selectedWorker && (
                <div className="modal-overlay" onClick={() => setShowLogForm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Log Safety Incident</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowLogForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Worker: <strong>{selectedWorker.displayName}</strong>
                            </p>
                            <div className="form-group">
                                <label className="form-label required">Incident Description</label>
                                <textarea
                                    className="textarea"
                                    value={logIncident}
                                    onChange={e => setLogIncident(e.target.value)}
                                    placeholder="Describe the safety incident..."
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Severity</label>
                                <select className="select" value={logSeverity} onChange={e => setLogSeverity(e.target.value as any)}>
                                    <option value="low">Low – Minor issue</option>
                                    <option value="medium">Medium – Needs attention</option>
                                    <option value="high">High – Urgent safety risk</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowLogForm(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleLogSubmit} disabled={submittingLog || !logIncident.trim()}>
                                {submittingLog ? 'Logging...' : 'Submit Log'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkerWelfare;
