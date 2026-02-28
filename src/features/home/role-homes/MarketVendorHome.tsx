import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Repeat2, ArrowUpFromLine, Leaf, CheckCircle, Package, Clock } from 'lucide-react';
import styles from '../HomePage.module.css';

export default function MarketVendorHome() {
    const { profile } = useAuth();
    const [stats, setStats] = useState({ active: 0, claimed: 0 });

    useEffect(() => {
        if (!profile) return;
        const load = async () => {
            try {
                const snap = await getDocs(query(collection(db, 'waste_listings'), where('listerId', '==', profile.uid)));
                setStats({
                    active: snap.docs.filter(d => d.data().status === 'open').length,
                    claimed: snap.docs.filter(d => d.data().status === 'claimed' || d.data().status === 'picked').length,
                });
            } catch (e) { console.error(e); }
        };
        load();
    }, [profile]);

    const isApproved = profile?.approved !== false;
    const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
    const produce = (profile?.points ?? 0) * 0.5; // rough estimate: ~0.5 kg per point

    return (
        <div className={styles.page}>
            {!isApproved && (
                <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Clock size={18} color="var(--color-warning)" />
                    <div>
                        <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-warning)' }}>Approval Pending</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Your market vendor account is under review.</div>
                    </div>
                </div>
            )}

            <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()}, Vendor 🥦</p>
                    <h1 className={styles.heroName}>{profile?.displayName?.split(' ')[0] ?? 'Vendor'}</h1>
                    <p className={styles.heroSub}>Connect surplus produce with farmers & feed stores</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Leaf size={28} color="white" />
                    </div>
                    <span style={{ color: 'white', fontSize: 'var(--text-xs)' }}>Market Vendor</span>
                </div>
            </div>

            <div className={styles.statsGrid}>
                {[
                    { icon: <Package size={20} />, label: 'Active Listings', val: stats.active, color: '#10b981' },
                    { icon: <CheckCircle size={20} />, label: 'Produce Saved', val: `~${produce.toFixed(0)} kg`, color: 'var(--color-success)' },
                    { icon: <Leaf size={20} />, label: 'Pickups Done', val: stats.claimed, color: 'var(--color-info)' },
                ].map(s => (
                    <div key={s.label} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: s.color, background: `${s.color}18` }}>{s.icon}</div>
                        <div className={styles.statVal}>{s.val}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            <section className={styles.section}>
                <Link to="/exchange" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white', borderRadius: 'var(--radius-xl)', padding: '18px',
                    fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', textDecoration: 'none', boxShadow: 'var(--shadow-md)',
                }}>
                    <Repeat2 size={24} /> List Unsold Produce
                </Link>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Quick Actions</h2>
                <div className={styles.actionsGrid}>
                    {[
                        { to: '/exchange', icon: <Repeat2 size={22} />, label: 'My Listings', color: '#10b981', bg: '#10b98118' },
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
                <h2 className={styles.sectionTitle}>🌾 What Can You List?</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                    {['🥬 Leafy Greens', '🍅 Overripe Fruits', '🥕 Vegetables', '🌽 Corn Husks', '🥦 Broccoli Stalks', '🍌 Bananas'].map(item => (
                        <div key={item} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '10px 12px', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                            {item}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
