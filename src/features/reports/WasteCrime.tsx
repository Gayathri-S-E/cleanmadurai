import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Camera, MapPin, FileText, AlertTriangle, Loader2, CheckCircle, ShieldAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './WasteCrime.module.css';

const CRIME_TYPES = [
    { value: 'illegal_dumping', emoji: '🗑️', label: 'Illegal Dumping' },
    { value: 'plastic_burning', emoji: '🔥', label: 'Plastic Burning' },
    { value: 'drain_clogging', emoji: '💧', label: 'Drain Clogging' },
    { value: 'hazardous_waste', emoji: '☣️', label: 'Hazardous Waste' },
    { value: 'vehicle_dumping', emoji: '🚛', label: 'Vehicle Dumping' },
    { value: 'construction_waste', emoji: '🧱', label: 'Construction Waste' },
    { value: 'other', emoji: '⚠️', label: 'Other Crime' },
];

function WasteCrime() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const { position, address, loading: geoLoading, fetchLocation } = useGeolocation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    const [crimeType, setCrimeType] = useState('');
    const [description, setDescription] = useState('');
    const [licensePlate, setLicensePlate] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState('');
    const [isVideo, setIsVideo] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handlePhotoCapture = () => fileInputRef.current?.click();
    const handleVideoCapture = () => videoInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, video = false) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMediaFile(file);
        setIsVideo(video);
        setMediaPreview(URL.createObjectURL(file));
        e.target.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!crimeType) { toast.error('Please select the crime type'); return; }
        if (!position) { toast.error('Location required. Please allow location access.'); return; }

        setSubmitting(true);
        try {
            let mediaURL = '';
            if (mediaFile) {
                const mediaRef = ref(storage, `wasteCrimes/${user?.uid ?? 'anon'}/${Date.now()}_${mediaFile.name}`);
                await uploadBytes(mediaRef, mediaFile);
                mediaURL = await getDownloadURL(mediaRef);
            }

            const crimeLabel = CRIME_TYPES.find(t => t.value === crimeType)?.label ?? crimeType;

            await addDoc(collection(db, 'wasteCrimes'), {
                crimeType,
                crimeLabel,
                description: description.trim(),
                licensePlate: licensePlate.trim().toUpperCase() || null,
                location: { lat: position.lat, lng: position.lng },
                address,
                ward: profile?.ward ?? '',
                mediaURL: mediaURL || null,
                isVideo,
                isAnonymous,
                reporterId: isAnonymous ? null : (user?.uid ?? null),
                reporterName: isAnonymous ? null : (profile?.displayName ?? null),
                status: 'pending_review',
                fineDraftGenerated: !!licensePlate.trim(),
                fineDraft: licensePlate.trim()
                    ? `FINE DRAFT – PENDING OFFICER REVIEW\nVehicle: ${licensePlate.trim().toUpperCase()}\nOffence: ${crimeLabel}\nLocation: ${address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}\nDate: ${new Date().toLocaleDateString('en-IN')}\n\n[Officer must review and approve before issuing]`
                    : null,
                createdAt: serverTimestamp(),
            });

            setSubmitted(true);
        } catch (err: any) {
            console.error(err);
            toast.error('Submission failed: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className={styles.success}>
                <div className={styles.successIcon}><CheckCircle size={52} /></div>
                <h2 className={styles.successTitle}>Crime Reported!</h2>
                <p className={styles.successDesc}>
                    Your waste crime report has been submitted for officer review.
                    {licensePlate && ' A fine draft has been auto-generated pending officer approval.'}
                </p>
                <div className={styles.successActions}>
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/home')}>Back to Home</button>
                    <button className="btn btn-outline" onClick={() => { setSubmitted(false); setMediaFile(null); setMediaPreview(''); setCrimeType(''); setDescription(''); setLicensePlate(''); }}>
                        Report Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerIcon}><ShieldAlert size={24} /></div>
                <div>
                    <h1 className={styles.title}>Waste Crime Report</h1>
                    <p className={styles.subtitle}>Anonymous • Secure • Officer-reviewed before any penalty</p>
                </div>
            </div>

            <div className={styles.infoBox}>
                <AlertTriangle size={16} />
                <span>Reports are reviewed by officers. No penalty is issued without officer approval. You can remain anonymous.</span>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                {/* Crime Type */}
                <div className={styles.section}>
                    <label className={styles.sectionLabel}>
                        Crime Type <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.crimeGrid}>
                        {CRIME_TYPES.map(t => (
                            <button
                                key={t.value}
                                type="button"
                                className={`${styles.crimeCard} ${crimeType === t.value ? styles.crimeSelected : ''}`}
                                onClick={() => setCrimeType(t.value)}
                            >
                                <span className={styles.crimeEmoji}>{t.emoji}</span>
                                <span className={styles.crimeLabel}>{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Media Upload */}
                <div className={styles.section}>
                    <label className={styles.sectionLabel}>Evidence Photo / Video</label>
                    {mediaPreview ? (
                        <div className={styles.mediaPreview}>
                            {isVideo ? (
                                <video src={mediaPreview} controls className={styles.previewMedia} />
                            ) : (
                                <img src={mediaPreview} alt="Evidence" className={styles.previewMedia} />
                            )}
                            <button
                                type="button"
                                className={styles.removeMedia}
                                onClick={() => { setMediaFile(null); setMediaPreview(''); }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className={styles.mediaButtons}>
                            <button type="button" className={styles.mediaBtn} onClick={handlePhotoCapture}>
                                <Camera size={28} />
                                <span>Photo</span>
                            </button>
                            <button type="button" className={styles.mediaBtn} onClick={handleVideoCapture}>
                                <span style={{ fontSize: '28px' }}>🎬</span>
                                <span>Video</span>
                            </button>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFileChange(e, false)} />
                    <input ref={videoInputRef} type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFileChange(e, true)} />
                </div>

                {/* License Plate */}
                <div className="form-group">
                    <label className="form-label">
                        <span>🚘</span> Vehicle License Plate <span className={styles.optional}>(Optional)</span>
                    </label>
                    <input
                        type="text"
                        className="input"
                        value={licensePlate}
                        onChange={e => setLicensePlate(e.target.value)}
                        placeholder="e.g. TN 59 AB 1234"
                        maxLength={15}
                        style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                    />
                    {licensePlate.trim() && (
                        <div className="form-hint">
                            <FileText size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            A fine draft will be auto-generated (officer must approve)
                        </div>
                    )}
                </div>

                {/* Description */}
                <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                        className="textarea"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe what you witnessed..."
                        maxLength={500}
                        rows={3}
                    />
                    <div className="form-hint">{description.length}/500</div>
                </div>

                {/* Location */}
                <div className={styles.locationCard}>
                    <MapPin size={16} style={{ color: 'var(--color-primary-500)' }} />
                    <div style={{ flex: 1 }}>
                        {geoLoading ? (
                            <span className={styles.locationText}><Loader2 size={14} className="animate-spin" /> Getting location...</span>
                        ) : position ? (
                            <span className={styles.locationText}>📍 {address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}</span>
                        ) : (
                            <span className={styles.locationError}>⚠️ Location unavailable</span>
                        )}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={fetchLocation}>Refresh</button>
                </div>

                {/* Anonymous Toggle */}
                <label className={styles.anonRow}>
                    <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
                    <span>
                        <strong>Stay Anonymous</strong>
                        <span className={styles.anonHint}>Your identity will not be shared with the offender</span>
                    </span>
                </label>

                <button
                    type="submit"
                    className="btn btn-primary btn-full btn-lg"
                    disabled={submitting || !crimeType}
                >
                    {submitting ? (
                        <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                    ) : (
                        <><ShieldAlert size={18} /> Submit Crime Report</>
                    )}
                </button>
            </form>
        </div>
    );
}

export default WasteCrime;
