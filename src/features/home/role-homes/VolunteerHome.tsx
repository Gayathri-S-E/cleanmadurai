import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Trophy, ArrowUpFromLine, MapPin, Map, Star, Users, Calendar, CheckCircle } from 'lucide-react';
import styles from '../HomePage.module.css';

interface Event { id: string; title: string; date: string; location: string; volunteers: number; }
interface BadgeDef { id: string; emoji: string; name: string; desc: string; }

export default function VolunteerHome() {
    const { profile } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [badges, setBadges] = useState<BadgeDef[]>([]);
    const [rank, setRank] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                // Upcoming events
                const evSnap = await getDocs(query(
                    collection(db, 'cleanupEvents'),
                    where('date', '>=', new Date().toISOString().slice(0, 10)),
                    orderBy('date'), limit(3)
                ));
                setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));

                // Badge defs
                const bSnap = await getDocs(collection(db, 'badges'));
                setBadges(bSnap.docs.map(d => ({ id: d.id, ...d.data() } as BadgeDef)));

                // Leaderboard rank
                const lSnap = await getDocs(query(
                    collection(db, 'users'),
                    where('roles', 'array-contains', 'volunteer'),
                    where('points', '>', profile?.points ?? 0)
                ));
                setRank(lSnap.size + 1);
            } catch (e) { console.error(e); }
        };
        load();
    }, [profile?.points]);

    const userBadges = badges.filter(b => profile?.badges?.includes(b.id));
    const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

    return (
        <div className={styles.page}>
            {/* Hero */}
            <div className={styles.hero} style={{ background: 'linear-gradient(135deg, var(--color-success) 0%, var(--color-primary-600) 100%)' }}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()}, Volunteer 🙋</p>
                    <h1 className={styles.heroName}>{profile?.displayName?.split(' ')[0] ?? 'Hero'} 🌱</h1>
                    <p className={styles.heroSub}>Making Madurai greener, one cleanup at a time</p>
                </div>
                <div className={styles.heroScore}>
                    <div className={styles.scoreRing}>
                        <svg viewBox="0 0 80 80" className={styles.scoreCircle}>
                            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="8" />
                            <circle cx="40" cy="40" r="32" fill="none" stroke="white" strokeWidth="8"
                                strokeDasharray={`${Math.min((profile?.points ?? 0) / 500 * 100, 100) * 2 * Math.PI * 32 / 100} ${2 * Math.PI * 32}`}
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
                    { icon: <ArrowUpFromLine size={20} />, label: 'Reports Filed', val: profile?.totalReports ?? 0, color: 'var(--color-primary-500)' },
                    { icon: <CheckCircle size={20} />, label: 'Resolved', val: profile?.resolvedReports ?? 0, color: 'var(--color-success)' },
                    { icon: <Trophy size={20} />, label: 'My Rank', val: rank !== null ? `#${rank}` : '…', color: 'var(--color-accent-400)' },
                    { icon: <Star size={20} />, label: 'Badges', val: userBadges.length, color: 'var(--color-warning)' },
                ].map(s => (
                    <div key={s.label} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: s.color, background: `${s.color}18` }}>{s.icon}</div>
                        <div className={styles.statVal}>{s.val}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Quick Actions</h2>
                <div className={styles.actionsGrid}>
                    {[
                        { to: '/leaderboard', icon: <Trophy size={22} />, label: 'Leaderboard', color: 'var(--color-accent-400)', bg: 'var(--color-accent-100)' },
                        { to: '/report', icon: <ArrowUpFromLine size={22} />, label: 'Report Issue', color: 'var(--color-primary-500)', bg: 'var(--color-primary-50)' },
                        { to: '/adopt', icon: <MapPin size={22} />, label: 'Adopt Block', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
                        { to: '/map', icon: <Map size={22} />, label: 'View Map', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
                    ].map(a => (
                        <Link key={a.to} to={a.to} className={styles.actionCard}>
                            <div className={styles.actionIcon} style={{ color: a.color, background: a.bg }}>{a.icon}</div>
                            <span className={styles.actionLabel}>{a.label}</span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Upcoming Cleanup Events */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}><Calendar size={16} style={{ display: 'inline', marginRight: 6 }} />Upcoming Cleanup Events</h2>
                {events.length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px' }}>
                        <div className="empty-state-icon">🌿</div>
                        <div className="empty-state-title">No events yet</div>
                        <p>Check back soon — admin will post events here</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {events.map(ev => (
                            <div key={ev.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Calendar size={18} color="var(--color-success)" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)' }}>{ev.title}</div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>📅 {ev.date} · 📍 {ev.location}</div>
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Users size={12} />{ev.volunteers ?? 0}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Badges */}
            {userBadges.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>🏅 My Badges</h2>
                    <div className={styles.badgesRow}>
                        {userBadges.map(b => (
                            <div key={b.id} className={styles.badgeCard}>
                                <div className={styles.badgeEmoji}>{b.emoji}</div>
                                <div className={styles.badgeName}>{b.name}</div>
                                <div className={styles.badgeDesc}>{b.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
