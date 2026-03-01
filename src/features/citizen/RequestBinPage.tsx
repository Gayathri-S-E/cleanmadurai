import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import toast from 'react-hot-toast';
import { Trash2, MapPin, CheckCircle, Loader2 } from 'lucide-react';

const BIN_TYPES = [
    { value: 'mixed', label: '🗑️ Mixed Waste', desc: 'General purpose bin for all types of waste' },
    { value: 'organic', label: '🍂 Organic / Wet', desc: 'Food scraps, vegetable waste, garden waste' },
    { value: 'plastic', label: '🧴 Plastic / Dry', desc: 'Bottles, packets, wrappers' },
    { value: 'market', label: '🛒 Market Waste', desc: 'Near market areas with high footfall' },
];

function RequestBinPage() {
    const { user, profile } = useAuth();
    const { position, address, loading: geoLoading, fetchLocation } = useGeolocation();

    const [binType, setBinType] = useState('mixed');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => { fetchLocation(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!position) { toast.error('Please allow location access so we know where you want the bin.'); return; }
        if (!user) { toast.error('Please login to submit a request.'); return; }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'bin_requests'), {
                requesterId: user.uid,
                requesterName: profile?.displayName || user.displayName || 'Citizen',
                binType,
                reason: reason.trim(),
                location: { lat: position.lat, lng: position.lng },
                address: address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,
                ward: profile?.ward || '',
                status: 'pending', // pending | approved | rejected
                createdAt: serverTimestamp(),
            });
            toast.success('Bin request submitted! Our officers will review it soon.');
            setSubmitted(true);
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to submit request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div style={{ maxWidth: '520px', margin: '60px auto', padding: '32px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <CheckCircle size={36} color="#16a34a" />
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-black)', fontSize: '22px', marginBottom: '12px' }}>Request Submitted!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
                    Thank you! A Corporation Officer will review your request and may deploy a bin in your area soon.
                </p>
                <button className="btn btn-primary" onClick={() => { setSubmitted(false); setReason(''); setBinType('mixed'); }}>Submit Another</button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={22} color="#7c3aed" />
                    </div>
                    <div>
                        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-black)', fontSize: '22px', margin: 0 }}>Request a Bin</h1>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No bin near you? Let us know and we'll deploy one.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Location */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <label style={{ fontWeight: 'var(--fw-semibold)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={16} color="var(--color-primary-500)" /> Your Location <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={fetchLocation}>Re-detect</button>
                    </div>
                    {geoLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            <Loader2 size={14} className="spin" /> Getting location...
                        </div>
                    ) : position ? (
                        <div style={{ fontSize: '13px', background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)' }}>
                            📍 {address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
                        </div>
                    ) : (
                        <div style={{ fontSize: '13px', color: 'var(--color-danger)', background: 'rgba(220,38,38,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
                            ⚠️ Location not detected. Please allow location access.
                        </div>
                    )}
                </div>

                {/* Bin Type */}
                <div>
                    <label style={{ fontWeight: 'var(--fw-semibold)', fontSize: '14px', marginBottom: '10px', display: 'block' }}>
                        Bin Type Needed <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {BIN_TYPES.map(bt => (
                            <button
                                key={bt.value}
                                type="button"
                                onClick={() => setBinType(bt.value)}
                                style={{
                                    textAlign: 'left', padding: '12px 14px', borderRadius: '12px',
                                    border: binType === bt.value ? '2px solid #7c3aed' : '1px solid var(--border-subtle)',
                                    background: binType === bt.value ? 'rgba(124,58,237,0.07)' : 'var(--bg-card)',
                                    cursor: 'pointer', transition: 'all 0.18s'
                                }}
                            >
                                <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: '13px', marginBottom: '3px' }}>{bt.label}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{bt.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Reason */}
                <div className="form-group">
                    <label className="form-label">Why is a bin needed here?</label>
                    <textarea
                        className="textarea"
                        rows={3}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="e.g. There's always litter here after the evening market. No bin within 500m."
                        maxLength={250}
                    />
                    <div className="form-hint">{reason.length}/250</div>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary btn-full btn-lg"
                    disabled={submitting || !position}
                    style={{ background: '#7c3aed', border: 'none' }}
                >
                    {submitting ? <><Loader2 size={16} className="spin" /> Submitting...</> : '🙋 Submit Bin Request'}
                </button>
            </form>
        </div>
    );
}

export default RequestBinPage;
