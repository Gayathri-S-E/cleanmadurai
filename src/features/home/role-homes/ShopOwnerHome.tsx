import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Repeat2, ArrowUpFromLine, Package, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import styles from '../HomePage.module.css';

export default function ShopOwnerHome() {
    const { profile } = useAuth();
    const [listings, setListings] = useState({ active: 0, claimed: 0 });

    useEffect(() => {
        if (!profile) return;
        const load = async () => {
            try {
                const snap = await getDocs(query(collection(db, 'waste_listings'), where('listerId', '==', profile.uid)));
                const active = snap.docs.filter(d => d.data().status === 'open').length;
                const claimed = snap.docs.filter(d => d.data().status === 'claimed' || d.data().status === 'picked').length;
                setListings({ active, claimed });
            } catch (e) { console.error(e); }
        };
        load();
    }, [profile]);

    const isApproved = profile?.approved !== false;
    const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

    return (
        <div className={styles.page}>
            {/* Approval Banner */}
            {!isApproved && (
                <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Clock size={18} color="var(--color-warning)" />
                    <div>
                        <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-warning)' }}>Approval Pending</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Your shop owner account is under review by the Corporation admin.</div>
                    </div>
                </div>
            )}

            {/* Hero */}
            <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()}, Shop Owner 🏪</p>
                    <h1 className={styles.heroName}>{profile?.displayName?.split(' ')[0] ?? 'Owner'}</h1>
                    <p className={styles.heroSub}>Legally dispose dry waste through our exchange network</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={28} color="white" />
                    </div>
                    <span style={{ color: 'white', fontSize: 'var(--text-xs)' }}>Waste Exchanger</span>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                {[
                    { icon: <Package size={20} />, label: 'Active Listings', val: listings.active, color: '#8b5cf6' },
                    { icon: <CheckCircle size={20} />, label: 'Claimed', val: listings.claimed, color: 'var(--color-success)' },
                    { icon: <AlertCircle size={20} />, label: 'My Reports', val: profile?.totalReports ?? 0, color: 'var(--color-info)' },
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
                    <Link to="/exchange" className={styles.actionCard}>
                        <div className={styles.actionIcon} style={{ color: '#8b5cf6', background: '#8b5cf618' }}><Repeat2 size={22} /></div>
                        <span className={styles.actionLabel}>Waste Exchange</span>
                    </Link>
                    <Link to="/report" className={styles.actionCard}>
                        <div className={styles.actionIcon} style={{ color: 'var(--color-primary-500)', background: 'var(--color-primary-50)' }}><ArrowUpFromLine size={22} /></div>
                        <span className={styles.actionLabel}>Report Issue</span>
                    </Link>
                </div>
            </section>

            {/* Exchange Info */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🔄 Dry Waste Categories You Can List</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                    {['📰 Paper & Cardboard', '🥫 Metal Scrap', '🥤 Plastic Bottles', '🪟 Glass Bottles', '⚡ Electronics', '👗 Textiles'].map(item => (
                        <div key={item} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '10px 12px', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                            {item}
                        </div>
                    ))}
                </div>
                <Link to="/exchange" className="btn btn-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
                    <Repeat2 size={16} /> Post New Listing
                </Link>
            </section>
        </div>
    );
}
