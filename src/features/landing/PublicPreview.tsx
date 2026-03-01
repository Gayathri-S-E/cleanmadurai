import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Box, Leaf, Clock, ArrowRight } from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import styles from './PublicPreview.module.css';
import { formatDistanceToNow } from 'date-fns';

export function PublicPreview() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [listings, setListings] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const handleActionClick = () => {
        navigate('/login');
    };

    useEffect(() => {
        const fetchPreviewData = async () => {
            setLoading(true);
            try {
                // Fetch recent open waste listings
                const listingsQuery = query(
                    collection(db, 'waste_listings'),
                    orderBy('createdAt', 'desc'),
                    limit(10)
                );
                const listingsSnap = await getDocs(listingsQuery);
                const fetchedListings = listingsSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as any))
                    .filter(item => item.status === 'open')
                    .slice(0, 3);

                // Fetch recent incident reports
                const reportsQuery = query(
                    collection(db, 'reports'),
                    orderBy('createdAt', 'desc'),
                    limit(3)
                );
                const reportsSnap = await getDocs(reportsQuery);
                const fetchedReports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setListings(fetchedListings);
                setReports(fetchedReports);
            } catch (err) {
                console.error("Failed to fetch public preview data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPreviewData();
    }, []);

    const wasteEmoji: Record<string, string> = {
        dry_plastic: '♻️', dry_cardboard: '📦', dry_metal: '🔩',
        organic_veg: '🥦', organic_cooked: '🍲', mixed: '🗑️',
    };

    if (loading) {
        return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading live data...</div>;
    }

    return (
        <div className={styles.container}>
            {/* Waste Exchange Marketplace Preview */}
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Available Organic Waste</h2>
                <p className={styles.sectionSubtitle}>Preview the Waste-to-Wealth Exchange. Find and claim organic resources or recyclables for your needs near Madurai.</p>
            </div>

            <div className={styles.grid}>
                {listings.length > 0 ? listings.map(item => (
                    <div key={item.id} className={styles.card}>
                        <div className={styles.cardImage}>
                            <div className={styles.tag}><Leaf size={14} /> {wasteEmoji[item.wasteType] ?? '♻️'} {item.category}</div>
                            <div className={styles.badge}>{item.ward || 'Madurai'}</div>
                        </div>
                        <div className={styles.cardBody}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h3 className={styles.cardTitle}>{item.wasteType ? item.wasteType.replace(/_/g, ' ') : `${item.category} Waste`}</h3>
                                    <div className={styles.cardSub}>
                                        <MapPin size={14} /> {item.listerName || 'Store'}
                                    </div>
                                </div>
                                <div className={styles.qtyBox}>
                                    <span className={styles.qtyLabel}>QTY</span>
                                    <span className={styles.qtyVal}>{item.quantity || '-'}</span>
                                </div>
                            </div>
                            <p className={styles.cardDesc}>
                                Pick up window: {item.pickupWindow || 'Contact to coordinate'}
                            </p>
                            <div className={styles.cardFooter}>
                                <button className={styles.claimBtn} onClick={handleActionClick}>
                                    Login to Claim <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>♻️</div>
                        <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>No open listings currently available</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Check back later or register to participate in the exchange.</p>
                    </div>
                )}
            </div>

            {/* Public Reports Preview */}
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Recent Incident Reports</h2>
                <p className={styles.sectionSubtitle}>Discover reported waste issues across the city waiting for resolution or pickup matches.</p>
            </div>

            <div className={styles.grid}>
                {reports.length > 0 ? reports.map(item => (
                    <div key={item.id} className={styles.card}>
                        <div className={styles.cardBody}>
                            <div className={styles.cardHeader}>
                                <div style={{ flex: 1 }}>
                                    <h3 className={styles.cardTitle} style={{ textTransform: 'capitalize' }}>{item.category?.replace(/_/g, ' ') || 'Incident'}</h3>
                                    <div className={styles.cardSub}>
                                        <Clock size={14} /> {item.createdAt?.toDate ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true }) : 'Recently'} &bull; {item.locationDisplay || item.ward || 'Madurai'}
                                    </div>
                                </div>
                                <div>
                                    <span className={styles.badge} style={{ position: 'relative', top: 0, right: 0 }}>{item.status || 'Pending'}</span>
                                </div>
                            </div>
                            <p className={styles.cardDesc} style={{ marginTop: '16px' }}>{item.description || 'No additional description provided.'}</p>
                            <div className={styles.cardFooter}>
                                <button className={styles.claimBtn} onClick={handleActionClick}>
                                    View Details <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                        <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>No recent reports available</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Log in to submit a new incident report.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
