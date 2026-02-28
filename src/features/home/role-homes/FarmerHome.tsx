import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Repeat2, Map, CheckCircle, Heart, Clock } from 'lucide-react';
import styles from '../HomePage.module.css';

interface Listing { id: string; wasteType: string; quantity: string; listerName?: string; ward?: string; }

export default function FarmerHome() {
    const { profile } = useAuth();
    const [available, setAvailable] = useState<Listing[]>([]);
    const [claimed, setClaimed] = useState(0);

    useEffect(() => {
        if (!profile) return;
        const load = async () => {
            try {
                // waste_listings written by WasteExchange.tsx: types are organic_veg, organic_cooked
                const avSnap = await getDocs(query(
                    collection(db, 'waste_listings'),
                    where('status', '==', 'open'),
                    where('wasteType', 'in', ['organic_veg', 'organic_cooked']),
                    orderBy('createdAt', 'desc'), limit(5)
                ));
                setAvailable(avSnap.docs.map(d => ({ id: d.id, ...d.data() } as Listing)));
                // claimerId is set when claimed in WasteExchange
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

    const WASTE_LABELS: Record<string, string> = {
        organic_veg: '🥦 Organic Vegetables',
        organic_cooked: '🍲 Cooked Food Waste',
        dry_plastic: '♻️ Dry Plastic',
        dry_cardboard: '📦 Cardboard',
        dry_metal: '🔩 Metal',
        mixed: '🗑️ Mixed',
    };

    return (
        <div className={styles.page}>
            {!isApproved && (
                <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Clock size={18} color="var(--color-warning)" />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning)', fontWeight: 'var(--fw-semibold)' }}>Approval Pending — account under review</span>
                </div>
            )}

            <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #84cc16, #65a30d)' }}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()}, Farmer 🌾</p>
                    <h1 className={styles.heroName}>{profile?.displayName?.split(' ')[0] ?? 'Farmer'}</h1>
                    <p className={styles.heroSub}>Receive organic waste for compost and animal feed</p>
                </div>
            </div>

            <div className={styles.statsGrid}>
                {[
                    { icon: <CheckCircle size={20} />, label: 'Pickups Claimed', val: claimed, color: '#84cc16' },
                    { icon: <Heart size={20} />, label: 'Est. Compost (kg)', val: `~${claimed * 15}`, color: 'var(--color-success)' },
                ].map(s => (
                    <div key={s.label} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: s.color, background: `${s.color}18` }}>{s.icon}</div>
                        <div className={styles.statVal}>{s.val}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            <section className={styles.section}>
                <div className={styles.actionsGrid}>
                    {[
                        { to: '/exchange', icon: <Repeat2 size={22} />, label: 'Browse & Claim', color: '#84cc16', bg: '#84cc1618' },
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
                <h2 className={styles.sectionTitle}>🌿 Available Organic Waste Near You</h2>
                {available.length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px' }}>
                        <div className="empty-state-icon">🌱</div>
                        <div className="empty-state-title">No organic listings yet</div>
                        <p>Hotel owners and market vendors will post pickups here once they list waste</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {available.map(l => (
                            <div key={l.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)' }}>{WASTE_LABELS[l.wasteType] ?? l.wasteType}</div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                                        🏷️ {l.quantity} · by {l.listerName ?? 'Vendor'}{l.ward ? ` · 📍 ${l.ward}` : ''}
                                    </div>
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
