import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Trophy, ArrowUpFromLine, MapPin, Users, Star, TrendingUp } from 'lucide-react';
import styles from '../HomePage.module.css';

interface TeamMember { id: string; displayName: string; points: number; }

export default function CollegeHome() {
    const { profile } = useAuth();
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [totalReports, setTotalReports] = useState(0);

    useEffect(() => {
        if (!profile) return;
        const load = async () => {
            try {
                // Volunteers who listed this college as organization
                const snap = await getDocs(query(
                    collection(db, 'users'),
                    where('organization', '==', profile.organization ?? profile.displayName ?? ''),
                    where('roles', 'array-contains', 'volunteer')
                ));
                const members = snap.docs
                    .map(d => ({ id: d.id, displayName: d.data().displayName ?? 'Volunteer', points: d.data().points ?? 0 }))
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 5);
                setTeam(members);

                // Total team reports
                const total = snap.docs.reduce((acc, d) => acc + (d.data().totalReports ?? 0), 0);
                setTotalReports(total);
            } catch (e) { console.error(e); }
        };
        load();
    }, [profile]);

    const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
    const teamPoints = team.reduce((a, m) => a + m.points, 0);

    return (
        <div className={styles.page}>
            <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()}, Admin 🎓</p>
                    <h1 className={styles.heroName}>{profile?.organization ?? profile?.displayName?.split(' ')[0] ?? 'College'}</h1>
                    <p className={styles.heroSub}>Managing volunteer teams & tracking institutional impact</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 30 }}>🎓</span>
                    </div>
                </div>
            </div>

            <div className={styles.statsGrid}>
                {[
                    { icon: <Users size={20} />, label: 'Team Members', val: team.length, color: '#3b82f6' },
                    { icon: <ArrowUpFromLine size={20} />, label: 'Team Reports', val: totalReports, color: 'var(--color-primary-500)' },
                    { icon: <Star size={20} />, label: 'Team Points', val: teamPoints, color: 'var(--color-accent-400)' },
                    { icon: <TrendingUp size={20} />, label: 'My Points', val: profile?.points ?? 0, color: 'var(--color-success)' },
                ].map(s => (
                    <div key={s.label} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: s.color, background: `${s.color}18` }}>{s.icon}</div>
                        <div className={styles.statVal}>{s.val}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Quick Actions</h2>
                <div className={styles.actionsGrid}>
                    {[
                        { to: '/leaderboard', icon: <Trophy size={22} />, label: 'Leaderboard', color: 'var(--color-accent-400)', bg: 'var(--color-accent-100)' },
                        { to: '/report', icon: <ArrowUpFromLine size={22} />, label: 'Report Issue', color: 'var(--color-primary-500)', bg: 'var(--color-primary-50)' },
                        { to: '/adopt', icon: <MapPin size={22} />, label: 'Adopt Block', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
                    ].map(a => (
                        <Link key={a.to} to={a.to} className={styles.actionCard}>
                            <div className={styles.actionIcon} style={{ color: a.color, background: a.bg }}>{a.icon}</div>
                            <span className={styles.actionLabel}>{a.label}</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🏆 Top Team Volunteers</h2>
                {team.length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px' }}>
                        <div className="empty-state-icon">🙋</div>
                        <div className="empty-state-title">No volunteers yet</div>
                        <p>Volunteers who list your college as their organization will appear here</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {team.map((m, i) => (
                            <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: i < 3 ? '#3b82f618' : 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', color: '#3b82f6', flexShrink: 0 }}>
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                </div>
                                <div style={{ flex: 1, fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)' }}>{m.displayName}</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: '#3b82f6', fontWeight: 'var(--fw-bold)' }}>{m.points} pts</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
