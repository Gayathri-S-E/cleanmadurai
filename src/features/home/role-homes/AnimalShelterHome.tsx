import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Repeat2, Map, CheckCircle, Heart, Clock } from 'lucide-react';
import styles from '../HomePage.module.css';

interface Listing { id: string; wasteType: string; quantity: string; listerName?: string; }

const WASTE_LABELS: Record<string, string> = {
    organic_veg: '🥦 Organic Vegetables',
    organic_cooked: '🍲 Cooked Food Waste',
    dry_plastic: '♻️ Dry Plastic',
    dry_cardboard: '📦 Cardboard',
    dry_metal: '🔩 Metal',
    mixed: '🗑️ Mixed',
};

export default function AnimalShelterHome() {
    const { profile } = useAuth();
    const [available, setAvailable] = useState<Listing[]>([]);
    const [claimed, setClaimed] = useState(0);

    useEffect(() => {
        if (!profile) return;
        const load = async () => {
            try {
                // Food available for animals: cooked food waste from hotels
                const avSnap = await getDocs(query(
                    collection(db, 'waste_listings'),
                    where('status', '==', 'open'),
                    where('wasteType', 'in', ['organic_cooked', 'organic_veg']),
                    orderBy('createdAt', 'desc'), limit(5)
                ));
                setAvailable(avSnap.docs.map(d => ({ id: d.id, ...d.data() } as Listing)));
                // My claimed items
                const clSnap = await getDocs(query(
                    collection(db, 'waste_listings'),
                    where('claimerId', '==', profile.uid)
                ));
                setClaimed(clSnap.size);
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
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning)', fontWeight: 'var(--fw-semibold)' }}>Approval Pending — account under review</span>
                </div>
            )}

            <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #f472b6, #db2777)' }}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()}, Shelter 🐄</p>
                    <h1 className={styles.heroName}>{profile?.displayName?.split(' ')[0] ?? 'Shelter'}</h1>
                    <p className={styles.heroSub}>Access food waste to nourish your shelter animals</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 30 }}>🐄</span>
                    </div>
                </div>
            </div>

            <div className={styles.statsGrid}>
                {[
                    { icon: <CheckCircle size={20} />, label: 'Meals Claimed', val: claimed, color: '#f472b6' },
                    { icon: <Heart size={20} />, label: 'Animals Helped (est.)', val: claimed * 5, color: 'var(--color-danger)' },
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
                    background: 'linear-gradient(135deg, #f472b6, #db2777)',
                    color: 'white', borderRadius: 'var(--radius-xl)', padding: '18px',
                    fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', textDecoration: 'none', boxShadow: 'var(--shadow-md)',
                }}>
                    <Repeat2 size={24} /> Browse & Claim Food Waste
                </Link>
            </section>

            <section className={styles.section}>
                <div className={styles.actionsGrid}>
                    {[
                        { to: '/exchange', icon: <Repeat2 size={22} />, label: 'Exchange', color: '#f472b6', bg: '#f472b618' },
                        { to: '/map', icon: <Map size={22} />, label: 'View Map', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
                    ].map(a => (
                        <Link key={a.to} to={a.to} className={styles.actionCard}>
                            <div className={styles.actionIcon} style={{ color: a.color, background: a.bg }}>{a.icon}</div>
                            <span className={styles.actionLabel}>{a.label}</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🍲 Available Food Waste</h2>
                {available.length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px' }}>
                        <div className="empty-state-icon">🥘</div>
                        <div className="empty-state-title">No food waste listed yet</div>
                        <p>Restaurants and hotels post pickups here — check the Waste Exchange for all listings</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {available.map(l => (
                            <div key={l.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)' }}>{WASTE_LABELS[l.wasteType] ?? l.wasteType}</div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>🏷️ {l.quantity} · from {l.listerName ?? 'Hotel'}</div>
                                </div>
                                <Link to="/exchange" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Claim</Link>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
