import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Toilet, ToiletRating } from '../../types';
import { MapPin, Star, Navigation, Droplets, Zap, Accessibility, Baby, AlertTriangle, CheckCircle, Clock, Filter, Plus } from 'lucide-react';
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import styles from './RestroomFinder.module.css';

const FACILITY_ICONS: Record<string, React.ReactNode> = {
    water: <Droplets size={14} />,
    soap: <span style={{ fontSize: 12 }}>🧼</span>,
    lighting: <Zap size={14} />,
    divyang: <Accessibility size={14} />,
    baby_changing: <Baby size={14} />,
};

const TOILET_TAGS = ['dirty', 'no_water', 'no_soap', 'locked', 'broken_door', 'good'];

function getRatingColor(rating: number) {
    if (rating >= 4) return '#10B981';
    if (rating >= 2.5) return '#F59E0B';
    return '#EF4444';
}

function getStatusColor(status: string) {
    if (status === 'open') return '#10B981';
    if (status === 'repair') return '#3B82F6';
    return '#9CA3AF';
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0);
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map(s => (
                <button
                    key={s}
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(s)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                        color: s <= (hover || value) ? '#F59E0B' : 'var(--border-subtle)',
                        fontSize: 28, lineHeight: 1,
                    }}
                >★</button>
            ))}
        </div>
    );
}

function RateModal({ toilet, onClose }: { toilet: Toilet; onClose: () => void }) {
    const { user, profile } = useAuth();
    const [stars, setStars] = useState(0);
    const [tags, setTags] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

    const submit = async () => {
        if (!stars || !user) return;
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'toilet_ratings'), {
                toiletId: toilet.id,
                citizenId: user.uid,
                stars,
                tags,
                createdAt: serverTimestamp(),
            } as Omit<ToiletRating, 'id'>);
            toast.success('+3 points! Thanks for rating 🙏');
            onClose();
        } catch (e) {
            toast.error('Failed to submit rating');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Rate this Toilet</h3>
                <p className={styles.modalSub}>{toilet.name}</p>
                <div style={{ margin: '16px 0' }}>
                    <StarRating value={stars} onChange={setStars} />
                </div>
                <div className={styles.tagGrid}>
                    {TOILET_TAGS.map(tag => (
                        <button
                            key={tag}
                            className={`${styles.tag} ${tags.includes(tag) ? styles.tagActive : ''}`}
                            onClick={() => toggleTag(tag)}
                        >
                            {tag.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
                <button
                    className={styles.submitBtn}
                    onClick={submit}
                    disabled={!stars || submitting}
                >
                    {submitting ? 'Submitting…' : 'Submit Rating (+3 pts)'}
                </button>
            </div>
        </div>
    );
}

export default function RestroomFinder() {
    const { user } = useAuth();
    const [toilets, setToilets] = useState<Toilet[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'open' | 'clean'>('all');
    const [ratingTarget, setRatingTarget] = useState<Toilet | null>(null);

    // Request Restroom state
    const [isRequesting, setIsRequesting] = useState(false);
    const [requestMarker, setRequestMarker] = useState<{ lat: number, lng: number } | null>(null);
    const [requestReason, setRequestReason] = useState('');
    const [submittingRequest, setSubmittingRequest] = useState(false);

    useEffect(() => {
        getDocs(collection(db, 'toilets'))
            .then(snap => {
                setToilets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Toilet)));
            })
            .finally(() => setLoading(false));
    }, []);

    const filtered = toilets.filter(t => {
        if (filter === 'open') return t.status === 'open';
        if (filter === 'clean') return t.status === 'open' && t.liveRating >= 3.5;
        return true;
    });

    const navigate = (toilet: Toilet) => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${toilet.location.lat},${toilet.location.lng}`, '_blank');
    };

    const submitRequest = async () => {
        if (!user || !requestMarker) return;
        setSubmittingRequest(true);
        try {
            await addDoc(collection(db, 'restroom_requests'), {
                citizenId: user.uid,
                location: requestMarker,
                reason: requestReason,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            toast.success('Restroom request submitted! Thank you.');
            setIsRequesting(false);
            setRequestMarker(null);
            setRequestReason('');
        } catch (e) {
            toast.error('Failed to submit request');
        } finally {
            setSubmittingRequest(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>🚻 Find Toilet</h1>
                    <p className={styles.subtitle}>Restroom Network · Madurai</p>
                </div>
                {user && (
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setIsRequesting(true)}
                    >
                        <Plus size={16} style={{ marginRight: 4 }} /> Request Facility
                    </button>
                )}
            </div>

            {/* Legend */}
            <div className={styles.legend}>
                <span><span className={styles.dot} style={{ background: '#10B981' }} /> Open & Clean</span>
                <span><span className={styles.dot} style={{ background: '#F59E0B' }} /> Open</span>
                <span><span className={styles.dot} style={{ background: '#9CA3AF' }} /> Closed</span>
            </div>

            {/* Filter tabs */}
            <div className={styles.filterRow}>
                {(['all', 'open', 'clean'] as const).map(f => (
                    <button
                        key={f}
                        className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'all' ? 'All' : f === 'open' ? 'Open Now' : 'Clean (4★+)'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className={styles.loading}>Loading toilets…</div>
            ) : filtered.length === 0 ? (
                <div className={styles.empty}>
                    <span style={{ fontSize: 48 }}>🚻</span>
                    <p>No toilets found yet.</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Officers can add toilets from their dashboard.</p>
                </div>
            ) : (
                <div className={styles.list}>
                    {filtered.map(t => (
                        <div key={t.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardName}>{t.name}</div>
                                <div className={styles.statusBadge} style={{ background: getStatusColor(t.status) + '22', color: getStatusColor(t.status) }}>
                                    {t.status === 'open' ? '✅ Open' : t.status === 'repair' ? '🔧 Repair' : '❌ Closed'}
                                </div>
                            </div>

                            {t.address && (
                                <div className={styles.address}>
                                    <MapPin size={13} /> {t.address}
                                </div>
                            )}

                            <div className={styles.ratingRow}>
                                <div className={styles.stars} style={{ color: getRatingColor(t.liveRating) }}>
                                    {'★'.repeat(Math.round(t.liveRating || 0))}{'☆'.repeat(5 - Math.round(t.liveRating || 0))}
                                    <span> {(t.liveRating || 0).toFixed(1)}</span>
                                </div>
                                {t.lastCleaned && (
                                    <span className={styles.lastCleaned}>
                                        <Clock size={12} /> Cleaned recently
                                    </span>
                                )}
                            </div>

                            {t.facilities?.length > 0 && (
                                <div className={styles.facilities}>
                                    {t.facilities.map(f => (
                                        <span key={f} className={styles.facility} title={f}>
                                            {FACILITY_ICONS[f] ?? f}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className={styles.cardActions}>
                                <button className={styles.navBtn} onClick={() => navigate(t)}>
                                    <Navigation size={15} /> Navigate
                                </button>
                                {user && (
                                    <button className={styles.rateBtn} onClick={() => setRatingTarget(t)}>
                                        <Star size={15} /> Rate (+3 pts)
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {ratingTarget && (
                <RateModal toilet={ratingTarget} onClose={() => setRatingTarget(null)} />
            )}

            {isRequesting && (
                <div className={styles.modalOverlay} onClick={() => { setIsRequesting(false); setRequestMarker(null); }}>
                    <div className={styles.modal} style={{ maxWidth: 500, width: '90%' }} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>Request New Restroom</h3>
                        <p className={styles.modalSub}>Tap the map to suggest a location</p>

                        <div style={{ height: 250, width: '100%', borderRadius: 8, overflow: 'hidden', margin: '16px 0', border: '1px solid var(--border-subtle)', cursor: 'crosshair' }}>
                            <MapContainer center={[9.9252, 78.1198]} zoom={13} style={{ width: '100%', height: '100%' }}>
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                />
                                <MapEvents onClick={(e: any) => setRequestMarker(e.latlng)} />
                                {requestMarker && (
                                    <Circle center={[requestMarker.lat, requestMarker.lng]} radius={100} pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.5 }} />
                                )}
                            </MapContainer>
                        </div>

                        {requestMarker && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Why is a restroom needed here?</label>
                                    <textarea
                                        className="input"
                                        placeholder="E.g., High foot traffic area, near a busy market..."
                                        value={requestReason}
                                        onChange={e => setRequestReason(e.target.value)}
                                        style={{ width: '100%', minHeight: 60, marginTop: 4, resize: 'vertical' }}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={submitRequest}
                                    disabled={submittingRequest || !requestReason.trim()}
                                >
                                    {submittingRequest ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}

function MapEvents({ onClick }: { onClick: (e: any) => void }) {
    useMapEvents({ click: onClick });
    return null;
}
