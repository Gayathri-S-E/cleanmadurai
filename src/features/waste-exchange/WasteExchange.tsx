import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, serverTimestamp, where, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { WasteListing, WasteCategory, WasteType } from '../../types';
import { Plus, MapPin, Clock, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import styles from './WasteExchange.module.css';

// Fix Leaflet Default Icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
const WASTE_TYPES: { value: WasteType; label: string; emoji: string }[] = [
    { value: 'dry_plastic', label: 'Dry – Plastic', emoji: '♻️' },
    { value: 'dry_cardboard', label: 'Dry – Cardboard', emoji: '📦' },
    { value: 'dry_metal', label: 'Dry – Metal', emoji: '🔩' },
    { value: 'organic_veg', label: 'Organic – Vegetables', emoji: '🥦' },
    { value: 'organic_cooked', label: 'Organic – Cooked Food', emoji: '🍲' },
    { value: 'mixed', label: 'Mixed', emoji: '🗑️' },
];

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

function LocationPicker({ position, setPosition }: { position: { lat: number, lng: number } | null, setPosition: (p: { lat: number, lng: number }) => void }) {
    useMapEvents({
        click(e) {
            setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
    });
    return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

function WasteExchange() {
    const { user, profile, hasRole, updateUserProfile } = useAuth();
    const { position: geoPosition, fetchLocation } = useGeolocation();
    const [listings, setListings] = useState<WasteListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [tab, setTab] = useState<'available' | 'mine'>('available');

    // Create form state
    const [wasteType, setWasteType] = useState<WasteType>('organic_veg');
    const [quantity, setQuantity] = useState('');
    const [pickupWindow, setPickupWindow] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [pickedListing, setPickedListing] = useState<WasteListing | null>(null);
    const [pickedFeedback, setPickedFeedback] = useState('');
    const [pickerLocation, setPickerLocation] = useState<{ lat: number; lng: number } | null>(null);

    const isLister = hasRole(['shop_owner', 'hotel_owner', 'market_vendor']);
    const isClaimer = hasRole(['farmer', 'animal_shelter', 'recycler']);

    useEffect(() => { fetchListings(); }, [tab]);
    // Fetch GPS when create dialog opens
    useEffect(() => {
        if (showCreate) {
            fetchLocation();
            if (geoPosition && !pickerLocation) setPickerLocation(geoPosition);
        }
    }, [showCreate, geoPosition, fetchLocation]);
    const fetchListings = async () => {
        setLoading(true);
        try {
            let q;
            if (tab === 'mine') {
                // Claimers (farmer, animal_shelter, recycler) query by claimerId; listers query by listerId
                if (isClaimer) {
                    q = query(collection(db, 'waste_listings'), where('claimerId', '==', user?.uid), orderBy('createdAt', 'desc'));
                } else {
                    q = query(collection(db, 'waste_listings'), where('listerId', '==', user?.uid), orderBy('createdAt', 'desc'));
                }
            } else {
                q = query(collection(db, 'waste_listings'), where('status', '==', 'open'), orderBy('createdAt', 'desc'));
            }
            const snap = await getDocs(q);
            let results = snap.docs.map(d => ({ id: d.id, ...d.data() } as WasteListing));

            // During testing/demo, disable the 15km distance filter so users can see all listings 
            // regardless of their current real-world GPS location vs the shop owner's location.
            // if (tab === 'available' && geoPosition) {
            //     results = results.filter(l => {
            //         if (!l.location?.lat || !l.location?.lng) return true;
            //         return getDistance(geoPosition.lat, geoPosition.lng, l.location.lat, l.location.lng) <= 15;
            //     });
            // }

            setListings(results);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !profile) return;
        if (!quantity || !pickupWindow) { toast.error('Please fill all fields'); return; }
        if (!pickerLocation) { toast.error('Please pick a location on the map'); return; }
        setSubmitting(true);
        try {
            const category: WasteCategory = profile.roles.includes('hotel_owner') ? 'hotel' : profile.roles.includes('market_vendor') ? 'market' : 'shop';
            const expires = new Date(); expires.setDate(expires.getDate() + 2);

            await addDoc(collection(db, 'waste_listings'), {
                listerId: user.uid,
                listerName: profile.displayName,
                category,
                wasteType,
                quantity,
                pickupWindow,
                location: pickerLocation,
                ward: profile.ward,
                status: 'open',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                expiresAt: expires,
            });

            toast.success('Listing created! 🎉');
            setShowCreate(false);
            setQuantity(''); setPickupWindow(''); setPickerLocation(null);
            await fetchListings();
        } catch (e: any) { toast.error('Failed: ' + e.message); }
        finally { setSubmitting(false); }
    };

    const handleClaim = async (listing: WasteListing) => {
        if (!user || !profile) return;
        try {
            await updateDoc(doc(db, 'waste_listings', listing.id), {
                status: 'claimed',
                claimerId: user.uid,
                claimerName: profile.displayName,
                claimedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            // Award points
            await updateUserProfile({ points: (profile.points ?? 0) + 20 });
            toast.success('Listing claimed! +20 points 🎉');
            await fetchListings();
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    const handleMarkPicked = async () => {
        if (!user || !profile || !pickedListing) return;
        try {
            await updateDoc(doc(db, 'waste_listings', pickedListing.id), {
                status: 'picked',
                pickedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                feedback: pickedFeedback.trim() || null,
            });
            await updateUserProfile({ points: (profile.points ?? 0) + 30 });

            if (pickedListing.listerId) {
                try {
                    const listerRef = doc(db, 'users', pickedListing.listerId);
                    const listerSnap = await getDoc(listerRef);
                    if (listerSnap.exists()) {
                        await updateDoc(listerRef, { points: (listerSnap.data().points ?? 0) + 15 });
                    }
                } catch (e) { console.error("Could not reward lister", e); }
            }

            toast.success('Marked as picked! +30 points 🎉 (Lister gets +15)');
            setPickedListing(null);
            setPickedFeedback('');
            await fetchListings();
        } catch (e: any) { toast.error('Failed'); }
    };

    const wasteEmoji: Record<string, string> = {
        dry_plastic: '♻️', dry_cardboard: '📦', dry_metal: '🔩',
        organic_veg: '🥦', organic_cooked: '🍲', mixed: '🗑️',
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Waste Exchange</h1>
                    <p className={styles.subtitle}>Turn waste into a resource — connect listers with farmers & shelters</p>
                </div>
                {isLister && (
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> New Listing
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button className={`${styles.tab} ${tab === 'available' ? styles.tabActive : ''}`} onClick={() => setTab('available')}>
                    Available Listings
                </button>
                {(isLister || isClaimer) && (
                    <button className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`} onClick={() => setTab('mine')}>
                        {isLister ? 'My Listings' : 'My Claims'}
                    </button>
                )}
            </div>

            {/* Listings */}
            {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading listings...</div>
            ) : listings.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">♻️</div>
                    <div className="empty-state-title">No listings yet</div>
                    <p>{isLister ? 'Create the first listing to start exchanging waste!' : 'No waste available near you right now.'}</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {listings.map(l => (
                        <div key={l.id} className={styles.listingCard}>
                            <div className={styles.listingHeader}>
                                <div className={styles.listingEmoji}>{wasteEmoji[l.wasteType] ?? '♻️'}</div>
                                <div className={styles.listingMeta}>
                                    <div className={styles.listingType}>{l.wasteType.replace(/_/g, ' ')}</div>
                                    <span className={`badge badge-${l.category === 'hotel' ? 'info' : l.category === 'market' ? 'success' : 'warning'}`}>
                                        {l.category}
                                    </span>
                                </div>
                                <span className={`badge ${l.status === 'open' ? 'badge-success' : l.status === 'claimed' ? 'badge-warning' : 'badge-muted'}`}>
                                    {l.status}
                                </span>
                            </div>
                            <div className={styles.listingDetails}>
                                <div className={styles.listingDetail}><Package size={14} /> <span>{l.quantity}</span></div>
                                <div className={styles.listingDetail}><Clock size={14} /> <span>{l.pickupWindow}</span></div>
                                <div className={styles.listingDetail}><MapPin size={14} /> <span>{l.ward ?? 'Madurai'}</span></div>
                            </div>
                            <div className={styles.listingFooter}>
                                <div className={styles.listerName}>by {l.listerName}</div>
                                {l.status === 'open' && isClaimer && (
                                    <button className="btn btn-primary btn-sm" onClick={() => handleClaim(l)}>Claim →</button>
                                )}
                                {l.status === 'claimed' && l.claimerId === user?.uid && (
                                    <button className="btn btn-accent btn-sm" onClick={() => setPickedListing(l)}>Mark Picked ✓</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create listing modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Create Waste Listing</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <form className="modal-body" onSubmit={handleCreate}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label required">Waste Type</label>
                                    <select className="select" value={wasteType} onChange={e => setWasteType(e.target.value as WasteType)}>
                                        {WASTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Approximate Quantity</label>
                                    <input type="text" className="input" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g. 20 kg, 2 bags" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Pickup Window</label>
                                    <input type="text" className="input" value={pickupWindow} onChange={e => setPickupWindow(e.target.value)} placeholder="e.g. Today 4–6 PM, Tomorrow morning" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Pickup Location (Tap map to pin)</label>
                                    <div style={{ height: '200px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)', position: 'relative', zIndex: 0 }}>
                                        <MapContainer
                                            center={pickerLocation ? [pickerLocation.lat, pickerLocation.lng] : (geoPosition ? [geoPosition.lat, geoPosition.lng] : [9.9252, 78.1198])}
                                            zoom={14}
                                            style={{ height: '100%', width: '100%' }}
                                        >
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            <LocationPicker position={pickerLocation} setPosition={setPickerLocation} />
                                        </MapContainer>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ marginTop: '16px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Creating...' : 'Create Listing'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Mark Picked modal with optional feedback (PR-39) */}
            {pickedListing && (
                <div className="modal-overlay" onClick={() => { setPickedListing(null); setPickedFeedback(''); }}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Mark as Picked</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setPickedListing(null); setPickedFeedback(''); }}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Confirm pickup of <strong>{pickedListing.wasteType?.replace(/_/g, ' ')}</strong> from {pickedListing.listerName}. You'll earn +30 points.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Feedback (optional)</label>
                                <textarea
                                    className="textarea"
                                    value={pickedFeedback}
                                    onChange={e => setPickedFeedback(e.target.value)}
                                    placeholder="How was the pickup? Any notes for the lister..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ marginTop: '16px' }}>
                            <button className="btn btn-ghost" onClick={() => { setPickedListing(null); setPickedFeedback(''); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleMarkPicked}>Confirm Picked ✓</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WasteExchange;
