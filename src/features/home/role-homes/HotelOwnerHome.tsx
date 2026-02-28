import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Repeat2, ArrowUpFromLine, Utensils, CheckCircle, Users, TrendingUp, Clock } from 'lucide-react';
import styles from '../HomePage.module.css';

export default function HotelOwnerHome() {
    const { profile } = useAuth();
    const [stats, setStats] = useState({ active: 0, claimed: 0, partners: 0 });

    useEffect(() => {
        if (!profile) return;
        const load = async () => {
            try {
                const snap = await getDocs(query(collection(db, 'waste_listings'), where('listerId', '==', profile.uid)));
                const active = snap.docs.filter(d => d.data().status === 'open').length;
                const claimed = snap.docs.filter(d => d.data().status === 'claimed' || d.data().status === 'picked').length;
                // Unique claimers = food partners
                const partners = new Set(snap.docs.filter(d => d.data().claimerId).map(d => d.data().claimerId)).size;
                setStats({ active, claimed, partners });
            } catch (e) { console.error(e); }
        };
        load();
    }, [profile]);

    const isApproved = profile?.approved !== false;
    const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

    return (
        <div className={styles.page}>
            {!isApproved && (
                <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Clock size={18} color="var(--color-warning)" />
                    <div>
                        <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-warning)' }}>Approval Pending</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Your hotel account is under review. You'll be notified once approved.</div>
                    </div>
                </div>
            )}

            {/* Hero */}
            <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()}, Restaurant Owner 🍽️</p>
                    <h1 className={styles.heroName}>{profile?.displayName?.split(' ')[0] ?? 'Owner'}</h1>
                    <p className={styles.heroSub}>Turning food waste into farmers' compost & shelter meals</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Utensils size={28} color="white" />
                    </div>
                    <span style={{ color: 'white', fontSize: 'var(--text-xs)', textAlign: 'center' }}>Food Waste Partner</span>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                {[
                    { icon: <Utensils size={20} />, label: 'Active Listings', val: stats.active, color: '#ef4444' },
                    { icon: <CheckCircle size={20} />, label: 'Pickups Done', val: stats.claimed, color: 'var(--color-success)' },
                    { icon: <Users size={20} />, label: 'Farm/Shelter Partners', val: stats.partners, color: 'var(--color-info)' },
                    { icon: <TrendingUp size={20} />, label: 'Impact Points', val: profile?.points ?? 0, color: 'var(--color-accent-400)' },
                ].map(s => (
                    <div key={s.label} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: s.color, background: `${s.color}18` }}>{s.icon}</div>
                        <div className={styles.statVal}>{s.val}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <section className={styles.section}>
                <Link to="/exchange" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white', borderRadius: 'var(--radius-xl)', padding: '18px',
                    fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', textDecoration: 'none', boxShadow: 'var(--shadow-md)',
                }}>
                    <Repeat2 size={24} /> List Food Waste for Exchange
                </Link>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Quick Actions</h2>
                <div className={styles.actionsGrid}>
                    {[
                        { to: '/exchange', icon: <Repeat2 size={22} />, label: 'My Listings', color: '#ef4444', bg: '#ef444418' },
                        { to: '/report', icon: <ArrowUpFromLine size={22} />, label: 'Report Issue', color: 'var(--color-primary-500)', bg: 'var(--color-primary-50)' },
                    ].map(a => (
                        <Link key={a.to} to={a.to} className={styles.actionCard}>
                            <div className={styles.actionIcon} style={{ color: a.color, background: a.bg }}>{a.icon}</div>
                            <span className={styles.actionLabel}>{a.label}</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>💡 How It Works</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                        { step: '1', text: 'Post your leftover food waste with quantity & pickup time', icon: '📋' },
                        { step: '2', text: 'Verified farmers and animal shelters claim the listing', icon: '🌾' },
                        { step: '3', text: 'They pick it up — you earn impact points + zero landfill!', icon: '🏆' },
                    ].map(s => (
                        <div key={s.step} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 20 }}>{s.icon}</span>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
