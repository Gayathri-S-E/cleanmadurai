import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { ArrowUpFromLine, Map, Trophy, Clock, CheckCircle, Flame, Star } from 'lucide-react';
import styles from '../HomePage.module.css';

interface Report { id: string; issueType: string; status: string; address?: string; createdAt: any; }

const STATUS_COLOR: Record<string, string> = {
    open: 'var(--color-danger)',
    in_progress: 'var(--color-warning)',
    resolved: 'var(--color-success)',
};

export default function AutoDriverHome() {
    const { profile, user } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            try {
                const snap = await getDocs(query(
                    collection(db, 'reports'),
                    where('reporterId', '==', user.uid),
                    orderBy('createdAt', 'desc'),
                    limit(5)
                ));
                setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
            } catch (e) { console.error(e); }
        };
        load();
    }, [user]);

    const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
    const streak = profile?.loginStreak ?? 0;

    return (
        <div className={styles.page}>
            {/* Hero */}
            <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()}, Driver 🛺</p>
                    <h1 className={styles.heroName}>{profile?.displayName?.split(' ')[0] ?? 'Hero'}</h1>
                    <p className={styles.heroSub}>Protecting Madurai on every route 🛡️</p>
                    {streak > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'white', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>
                            <Flame size={16} /> {streak}-day reporting streak! Keep it up!
                        </div>
                    )}
                </div>
                <div className={styles.heroScore}>
                    <div className={styles.scoreRing}>
                        <svg viewBox="0 0 80 80" className={styles.scoreCircle}>
                            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="8" />
                            <circle cx="40" cy="40" r="32" fill="none" stroke="white" strokeWidth="8"
                                strokeDasharray={`${Math.min((profile?.points ?? 0) / 300 * 100, 100) * 2 * Math.PI * 32 / 100} ${2 * Math.PI * 32}`}
                                strokeLinecap="round" strokeDashoffset={0} transform="rotate(-90 40 40)" />
                        </svg>
                        <span className={styles.scoreVal} style={{ color: 'white' }}>{profile?.points ?? 0}</span>
                    </div>
                    <span className={styles.scoreLabel} style={{ color: 'rgba(255,255,255,0.85)' }}>Points</span>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                {[
                    { icon: <ArrowUpFromLine size={20} />, label: 'Reports Filed', val: profile?.totalReports ?? 0, color: '#f59e0b' },
                    { icon: <CheckCircle size={20} />, label: 'Resolved', val: profile?.resolvedReports ?? 0, color: 'var(--color-success)' },
                    { icon: <Flame size={20} />, label: 'Day Streak', val: streak, color: 'var(--color-danger)' },
                    { icon: <Star size={20} />, label: 'Points', val: profile?.points ?? 0, color: 'var(--color-accent-400)' },
                ].map(s => (
                    <div key={s.label} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: s.color, background: `${s.color}18` }}>{s.icon}</div>
                        <div className={styles.statVal}>{s.val}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Big Report CTA */}
            <section className={styles.section}>
                <Link to="/report" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: 'white', borderRadius: 'var(--radius-xl)', padding: '18px',
                    fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)',
                    textDecoration: 'none', boxShadow: 'var(--shadow-md)',
                }}>
                    <ArrowUpFromLine size={26} /> Spot Something? Report It Now!
                </Link>
            </section>

            {/* Quick Actions */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>More Actions</h2>
                <div className={styles.actionsGrid}>
                    {[
                        { to: '/map', icon: <Map size={22} />, label: 'Issue Map', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
                        { to: '/leaderboard', icon: <Trophy size={22} />, label: 'Leaderboard', color: '#f59e0b', bg: '#fef3c718' },
                        { to: '/my-reports', icon: <Clock size={22} />, label: 'My Reports', color: 'var(--color-primary-500)', bg: 'var(--color-primary-50)' },
                    ].map(a => (
                        <Link key={a.to} to={a.to} className={styles.actionCard}>
                            <div className={styles.actionIcon} style={{ color: a.color, background: a.bg }}>{a.icon}</div>
                            <span className={styles.actionLabel}>{a.label}</span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Recent Reports */}
            {reports.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>My Recent Reports</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {reports.map(r => (
                            <div key={r.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', textTransform: 'capitalize' }}>{r.issueType?.replace(/_/g, ' ')}</div>
                                    {r.address && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>📍 {r.address}</div>}
                                </div>
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: STATUS_COLOR[r.status] ?? 'var(--text-muted)', background: `${STATUS_COLOR[r.status] ?? 'var(--text-muted)'}18`, padding: '3px 8px', borderRadius: 99 }}>
                                    {r.status?.replace(/_/g, ' ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
