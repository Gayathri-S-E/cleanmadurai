import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import type { IssueType } from '../../types';
import { Camera, MapPin, AlertTriangle, Loader2, CheckCircle, X, ImagePlus } from 'lucide-react';
import { checkReportBadges, checkAndAwardBadges } from '../../services/badgeService';
import toast from 'react-hot-toast';
import styles from './ReportForm.module.css';


const ISSUE_TYPES: { value: IssueType; emoji: string; label: string }[] = [
    { value: 'glass_on_road', emoji: '💎', label: 'Glass on Road' },
    { value: 'garbage_pile', emoji: '🗑️', label: 'Garbage Pile' },
    { value: 'plastic_waste', emoji: '🧴', label: 'Plastic Waste' },
    { value: 'organic_waste', emoji: '🍂', label: 'Organic Waste' },
    { value: 'drainage', emoji: '🌊', label: 'Drainage Issue' },
    { value: 'burning', emoji: '🔥', label: 'Burning / Fire' },
    { value: 'toilet_issue', emoji: '🚽', label: 'Toilet Issue' },
    { value: 'dead_animal', emoji: '⚠️', label: 'Dead Animal' },
    { value: 'others', emoji: '❓', label: 'Others' },
];

function ReportForm() {
    const { t } = useTranslation();
    const { user, profile, updateUserProfile } = useAuth();
    const navigate = useNavigate();
    const { position, address, loading: geoLoading, fetchLocation } = useGeolocation();
    const { enqueueReport } = useOfflineQueue();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [issueType, setIssueType] = useState<IssueType | ''>('');
    const [description, setDescription] = useState('');
    const [isGlassSOS, setIsGlassSOS] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [inFestivalZone, setInFestivalZone] = useState(false);
    const [aiSuggesting, setAiSuggesting] = useState(false);

    useEffect(() => {
        fetchLocation();
    }, []);

    // PR-54: Reports in special zones on festival days get higher priority
    useEffect(() => {
        if (!position) return;
        const today = new Date().toISOString().slice(0, 10);
        const checkZone = async () => {
            try {
                const snap = await getDocs(collection(db, 'specialZones'));
                for (const d of snap.docs) {
                    const z = d.data();
                    const lat = z.center?.lat ?? z.lat;
                    const lng = z.center?.lng ?? z.lng;
                    const radius = (z.radius ?? 500) / 1000;
                    const festivalDays = z.festivalDays ?? [];
                    if (!z.isActive || !festivalDays.includes(today) || lat == null || lng == null) continue;
                    const R = 6371;
                    const dLat = (position.lat - lat) * Math.PI / 180;
                    const dLon = (position.lng - lng) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(position.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    if (dist <= radius) {
                        setInFestivalZone(true);
                        return;
                    }
                }
                setInFestivalZone(false);
            } catch {
                setInFestivalZone(false);
            }
        };
        checkZone();
    }, [position]);

    // Auto-toggle glass SOS when glass selected
    useEffect(() => {
        if (issueType === 'glass_on_road') setIsGlassSOS(true);
        else setIsGlassSOS(false);
    }, [issueType]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleCameraCapture = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };
    const handleGalleryPick = () => {
        if (galleryInputRef.current) {
            galleryInputRef.current.removeAttribute('capture');
            galleryInputRef.current.setAttribute('accept', 'image/*');
            galleryInputRef.current.click();
        }
    };

    const handleAISuggestType = async () => {
        if (!photo) return;
        setAiSuggesting(true);
        try {
            const reader = new FileReader();
            const imageDataUrl = await new Promise<string>((res, rej) => {
                reader.onload = () => res(reader.result as string);
                reader.onerror = rej;
                reader.readAsDataURL(photo);
            });
            const suggest = httpsCallable<{ imageDataUrl: string }, { suggestedType: string }>(functions, 'suggestWasteType');
            const { data } = await suggest({ imageDataUrl });
            if (data?.suggestedType) {
                setIssueType(data.suggestedType as IssueType);
                toast.success(`AI suggested: ${data.suggestedType.replace(/_/g, ' ')}. You can change it.`);
            }
        } catch (e) {
            toast.error('AI suggest unavailable. Select type manually.');
        } finally {
            setAiSuggesting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo) { toast.error('Please take a photo'); return; }
        if (!issueType) { toast.error('Please select an issue type'); return; }
        if (!position) { toast.error('Location not available. Please allow location access.'); return; }
        if (!user) return;

        setSubmitting(true);

        try {
            const basePriority = isGlassSOS ? 'sos' : issueType === 'burning' ? 'high' : 'normal';
            const priority = (basePriority === 'normal' && inFestivalZone) ? 'high' : basePriority;
            const reportData: Record<string, unknown> = {
                reporterId: user.uid,
                reporterName: isAnonymous ? null : (profile?.displayName ?? user.displayName),
                issueType,
                description: description.trim(),
                location: { lat: position.lat, lng: position.lng },
                address,
                ward: profile?.ward ?? '',
                status: 'open',
                priority,
                festivalBoost: inFestivalZone,
                isGlassSOS,
                isAnonymous,
                statusHistory: [{
                    status: 'open',
                    changedBy: user.uid,
                    changedByName: 'System',
                    timestamp: new Date().toISOString(),
                }],
            };

            if (!navigator.onLine) {
                let imageDataUrl: string | undefined;
                if (photo) {
                    const reader = new FileReader();
                    imageDataUrl = await new Promise<string>((res, rej) => {
                        reader.onload = () => res(reader.result as string);
                        reader.onerror = rej;
                        reader.readAsDataURL(photo);
                    });
                }
                await enqueueReport(reportData, { imageDataUrl });
                toast.success('Saved offline! Will sync when connected.', { duration: 4000, icon: '📶' });
                setSubmitted(true);
                return;
            }

            // Online: upload photo + create report doc
            const photoRef = ref(storage, `reports/${user.uid}/${Date.now()}_${photo.name}`);
            await uploadBytes(photoRef, photo);
            const photoURL = await getDownloadURL(photoRef);

            await addDoc(collection(db, 'reports'), {
                ...reportData,
                photoURL,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Trigger notification email (if configured by admin)
            try {
                const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
                if (settingsSnap.exists() && settingsSnap.data().reportNotificationEmail) {
                    const toEmail = settingsSnap.data().reportNotificationEmail;
                    const issueLabel = ISSUE_TYPES.find(t => t.value === issueType)?.label || issueType;
                    const reporterNameStr = reportData.reporterName || 'Anonymous';

                    await addDoc(collection(db, 'mail'), {
                        to: [toEmail],
                        message: {
                            subject: `New Issue Reported: ${issueLabel} near ${reportData.ward}`,
                            html: `
                                <h3>New Issue Reported</h3>
                                <p><strong>Type:</strong> ${issueLabel}</p>
                                <p><strong>Ward:</strong> ${reportData.ward}</p>
                                <p><strong>Description:</strong> ${reportData.description}</p>
                                ${photoURL ? `<p><a href="${photoURL}">View Attached Photo</a></p>` : ''}
                                <p><em>Submitted by: ${reporterNameStr}</em></p>
                            `
                        }
                    });
                }
            } catch (mailErr) {
                console.error("Failed to queue notification email", mailErr);
            }

            // Update user stats
            const newTotalReports = (profile?.totalReports ?? 0) + 1;
            await updateUserProfile({
                totalReports: newTotalReports,
                points: (profile?.points ?? 0) + 10,
            });

            // PR-50: Award report-count badges (First Reporter, Glass Guardian, Street Savior, Temple Zone Hero)
            // and point-milestone badges (Clean Ambassador at 100pts, Waste Warrior at 500pts)
            if (user) {
                const BADGE_NAMES: Record<string, string> = {
                    first_report: '📝 First Reporter',
                    glass_guardian: '🛡️ Glass Guardian',
                    street_savior: '🏆 Street Savior',
                    temple_zone_hero: '🛕 Temple Zone Hero',
                    clean_ambassador: '🌟 Clean Ambassador',
                    waste_warrior: '⚔️ Waste Warrior',
                };
                try {
                    const [reportBadges, pointBadges] = await Promise.all([
                        checkReportBadges(user.uid, profile?.badges ?? [], newTotalReports, issueType, inFestivalZone),
                        checkAndAwardBadges(user.uid, profile ?? {} as any, (profile?.points ?? 0) + 10),
                    ]);
                    [...reportBadges, ...pointBadges].forEach(b => {
                        toast.success(`Badge unlocked: ${BADGE_NAMES[b] ?? b}!`, { duration: 4000, icon: '🏅' });
                    });
                } catch (badgeErr) {
                    console.error('Badge award check failed:', badgeErr);
                }
            }

            toast.success('Report submitted! +10 points earned 🎉');
            setSubmitted(true);
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className={styles.successPage}>
                <div className={styles.successIcon}>
                    <CheckCircle size={48} />
                </div>
                <h2 className={styles.successTitle}>Report Submitted!</h2>
                <p className={styles.successDesc}>
                    Thank you for helping keep Madurai clean. You've earned <strong>+10 points</strong>!
                </p>
                <div className={styles.successActions}>
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/home')}>
                        Go to Dashboard
                    </button>
                    <button className="btn btn-outline" onClick={() => { setSubmitted(false); setPhoto(null); setPhotoPreview(''); setIssueType(''); setDescription(''); }}>
                        Report Another Issue
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>{t('report.title')}</h1>
                <p className={styles.subtitle}>Takes less than 30 seconds · Helps your ward stay clean</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                {/* Photo capture */}
                <div className={styles.photoSection}>
                    <label className={styles.photoSectionLabel}>
                        📸 Photo <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    {photoPreview ? (
                        <div className={styles.photoPreview}>
                            <img src={photoPreview} alt="Report photo" className={styles.previewImg} />
                            <button
                                type="button"
                                className={styles.removePhoto}
                                onClick={() => { setPhoto(null); setPhotoPreview(''); }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className={styles.cameraBtn}
                                onClick={handleCameraCapture}
                            >
                                <Camera size={32} />
                                <span>Camera</span>
                                <span className={styles.cameraHint}>Take photo now</span>
                            </button>
                            <button
                                type="button"
                                className={styles.cameraBtn}
                                style={{ borderStyle: 'dashed' }}
                                onClick={handleGalleryPick}
                            >
                                <ImagePlus size={32} />
                                <span>Gallery</span>
                                <span className={styles.cameraHint}>Choose from device</span>
                            </button>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={handlePhotoChange}
                    />
                    <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) { setPhoto(file); setPhotoPreview(URL.createObjectURL(file)); }
                            e.target.value = '';
                        }}
                    />
                </div>

                {/* Issue type */}
                <div className={styles.issueTypeSection}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label className={styles.sectionLabel} style={{ margin: 0 }}>
                            Issue Type <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        {photo && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={handleAISuggestType} disabled={aiSuggesting}>
                                {aiSuggesting ? '…' : '🤖 AI suggest'}
                            </button>
                        )}
                    </div>
                    <div className={styles.issueGrid}>
                        {ISSUE_TYPES.map((type) => (
                            <button
                                key={type.value}
                                type="button"
                                className={`${styles.issueCard} ${issueType === type.value ? styles.issueSelected : ''}`}
                                onClick={() => setIssueType(type.value)}
                            >
                                <span className={styles.issueEmoji}>{type.emoji}</span>
                                <span className={styles.issueLabel}>{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Glass SOS toggle */}
                {(issueType === 'glass_on_road' || isGlassSOS) && (
                    <div className={`${styles.sosCard} ${isGlassSOS ? styles.sosActive : ''}`}>
                        <div className={styles.sosLeft}>
                            <AlertTriangle size={20} />
                            <div>
                                <div className={styles.sosTitle}>Glass SOS – High Priority</div>
                                <div className={styles.sosDesc}>Glass is causing immediate danger to people and animals</div>
                            </div>
                        </div>
                        <label className={styles.toggle}>
                            <input
                                type="checkbox"
                                checked={isGlassSOS}
                                onChange={(e) => setIsGlassSOS(e.target.checked)}
                            />
                            <span className={styles.toggleSlider} />
                        </label>
                    </div>
                )}

                {/* Location */}
                <div className={styles.locationCard}>
                    <div className={styles.locationHeader}>
                        <MapPin size={18} style={{ color: 'var(--color-primary-500)' }} />
                        <span className={styles.sectionLabel} style={{ margin: 0 }}>Location</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={fetchLocation} style={{ marginLeft: 'auto' }}>
                            Refresh
                        </button>
                    </div>
                    {geoLoading ? (
                        <div className={styles.locationLoading}>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Getting your location...</span>
                        </div>
                    ) : position ? (
                        <div className={styles.locationText}>
                            📍 {address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
                        </div>
                    ) : (
                        <div className={styles.locationError}>
                            ⚠️ Location not available. Please allow location permission.
                        </div>
                    )}
                </div>

                {/* Description */}
                <div className="form-group">
                    <label className="form-label" htmlFor="description">
                        Description <span className={styles.optional}>(Optional)</span>
                    </label>
                    <textarea
                        id="description"
                        className="textarea"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Any additional details about the issue..."
                        maxLength={300}
                        rows={3}
                    />
                    <div className="form-hint">{description.length}/300 characters</div>
                </div>

                {/* Anonymous toggle */}
                <label className={styles.anonRow}>
                    <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                    />
                    <span className={styles.anonLabel}>
                        Submit anonymously
                        <span className={styles.anonHint}>Your identity won't be shown to officers</span>
                    </span>
                </label>

                {/* Submit */}
                <button
                    type="submit"
                    className="btn btn-primary btn-full btn-lg"
                    disabled={submitting || !photo || !issueType}
                >
                    {submitting ? (
                        <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                    ) : (
                        <>{t('report.submit')}</>
                    )}
                </button>
            </form>
        </div>
    );
}

export default ReportForm;
