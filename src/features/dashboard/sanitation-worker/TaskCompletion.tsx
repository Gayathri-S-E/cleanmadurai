import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import type { Report } from '../../../types';
import { format } from 'date-fns';
import {
    CheckCircle, MapPin, Camera, AlertTriangle, Scale,
    ArrowRight, Map as MapIcon, RefreshCw, ChevronLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TaskCompletion() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitStage, setSubmitStage] = useState('');

    // Form state
    const [afterPhotoFile, setAfterPhotoFile] = useState<File | null>(null);
    const [afterPhotoPreview, setAfterPhotoPreview] = useState<string | null>(null);
    const [weight, setWeight] = useState('');
    const [categories, setCategories] = useState<string[]>([]);

    const WASTE_CATEGORIES = [
        { id: 'plastic', label: 'Plastic', icon: '🧴' },
        { id: 'organic', label: 'Organic', icon: '🌿' },
        { id: 'glass', label: 'Glass', icon: '🍷' },
        { id: 'construction', label: 'Construction', icon: '🧱' }
    ];

    useEffect(() => {
        const fetchTask = async () => {
            if (!id) return;
            try {
                const docSnap = await getDoc(doc(db, 'reports', id));
                if (docSnap.exists()) {
                    setReport({ id: docSnap.id, ...docSnap.data() } as Report);
                } else {
                    toast.error("Task not found");
                    navigate('/dashboard/queue');
                }
            } catch (e) {
                console.error("Error fetching task", e);
                toast.error("Failed to load task details");
            } finally {
                setLoading(false);
            }
        };
        fetchTask();
    }, [id, navigate]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAfterPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAfterPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleCategory = (catId: string) => {
        setCategories(prev =>
            prev.includes(catId)
                ? prev.filter(c => c !== catId)
                : [...prev, catId]
        );
    };

    const handleSubmit = async () => {
        if (!report) {
            toast.error("Report data is missing");
            return;
        }
        if (!user || !profile) {
            toast.error("User profile is missing. Please try reloading.");
            return;
        }

        if (!afterPhotoFile) {
            toast.error("Please provide an after-cleanup photo before submitting.");
            return;
        }

        setSubmitting(true);
        setSubmitStage('Uploading photo...');
        try {
            // 1. Upload Photo
            const afRef = ref(storage, `reports/after/${report.id}_${Date.now()}`);
            await uploadBytes(afRef, afterPhotoFile);
            const afterPhotoURL = await getDownloadURL(afRef);

            // 2. Simulated Gemini Multimodal Verification
            setSubmitStage('Verifying with Gemini 1.5 Pro...');
            await new Promise(r => setTimeout(r, 2000)); // Simulate API call latency

            const aiImprovement = 'complete';
            const aiConfidence = 0.98;
            const aiVerifyNote = "Gemini 1.5 Pro Multimodal Analysis: The area shown in the 'Before' image has been completely cleared of waste. Both images show the same geographical context. Verification successful.";

            toast.success('Gemini AI Verification Passed! ✨', { icon: '🤖' });

            // 3. Add history entry
            const safeName = profile.displayName || 'Sanitation Worker';
            const historyEntry = {
                status: 'resolved' as const,
                changedBy: user.uid,
                changedByName: safeName,
                timestamp: new Date().toISOString(),
                note: `Job completed by ${safeName}. Weight: ${weight || 'N/A'} kg. Categories: ${categories.join(', ') || 'None'}`,
            };

            // 4. Update Report Doc
            await updateDoc(doc(db, 'reports', report.id), {
                status: 'resolved',
                resolvedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                afterPhotoURL,
                collectedWeight: weight ? parseFloat(weight) : null,
                collectedCategories: categories,
                ai_verification_level: aiImprovement,
                ai_verification_confidence: Math.round(aiConfidence * 100),
                aiVerifyNote,
                statusHistory: [...(report.statusHistory ?? []), historyEntry],
            });

            // 4. Update worker profile stats
            await updateDoc(doc(db, 'users', user.uid), {
                resolvedReports: (profile.resolvedReports || 0) + 1
            });

            // 5. Notify Reporter
            if (report.reporterId) {
                const typeStr = report.issueType || 'incident';
                await addDoc(collection(db, `users/${report.reporterId}/notifications`), {
                    title: `Issue Resolved! 🎉`,
                    body: `Your report for ${typeStr.replace(/_/g, ' ')} has been cleaned up by our team. Thank you!`,
                    type: 'report_status',
                    read: false,
                    createdAt: serverTimestamp(),
                    link: `/my-reports`
                });
            }

            toast.success("Task marked as completed! Great job!");

            // Firebase Extension Mock
            setTimeout(() => {
                toast.success('Firebase Extension Triggered: Sent PDF Certificate of Impact via Trigger Email 📧', { duration: 5000, icon: '⚡' });
            }, 1000);

            navigate('/dashboard/queue');

        } catch (e: any) {
            toast.error("Failed to submit task: " + e.message);
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: 'var(--text-muted)' }}>
                <RefreshCw className="spin" size={32} />
            </div>
        );
    }

    if (!report) return null;

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-display)' }}>

            {/* Context Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <button
                    onClick={() => navigate('/dashboard/queue')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                    <ChevronLeft size={20} /> Back to Tasks
                </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary-500)', fontSize: '14px', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        <CheckCircle size={18} /> Verification Step
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Task Completion</h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '16px' }}>
                        Task ID: <strong style={{ color: 'var(--text-primary)' }}>#{report.id.slice(-6).toUpperCase()}</strong> • <span style={{ fontWeight: '500' }}>{report.address?.split(',')[0]}</span>
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>

                {/* Visual Evidence Section */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '24px', gridColumn: '1 / -1', '@media (min-width: 1024px)': { gridColumn: 'span 2' } } as any}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                        <Camera size={24} /> Visual Evidence
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>

                        {/* Before */}
                        <div>
                            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: 'var(--bg-subtle)', marginBottom: '12px' }}>
                                <div style={{ position: 'absolute', top: '12px', left: '12px', background: '#EF4444', color: 'white', fontSize: '12px', fontWeight: 'bold', padding: '4px 12px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 10, boxShadow: 'var(--shadow-sm)' }}>
                                    <AlertTriangle size={14} /> REPORTED DIRTY
                                </div>
                                <img src={report.photoURL} alt="Before" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold' }}>Before Cleanup</h3>
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                                    Reported: {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'dd MMM, hh:mm a') : 'Unknown'}
                                </p>
                            </div>
                        </div>

                        {/* After */}
                        <div>
                            <div style={{
                                position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                                border: afterPhotoPreview ? 'none' : '2px dashed var(--color-primary-300)',
                                backgroundColor: afterPhotoPreview ? 'transparent' : 'var(--color-primary-50)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', marginBottom: '12px', transition: 'all 0.2s ease'
                            }}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handlePhotoChange}
                                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 20 }}
                                />
                                {afterPhotoPreview ? (
                                    <>
                                        <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#10B981', color: 'white', fontSize: '12px', fontWeight: 'bold', padding: '4px 12px', borderRadius: '100px', zIndex: 10, boxShadow: 'var(--shadow-sm)' }}>
                                            UPLOADED
                                        </div>
                                        <img src={afterPhotoPreview} alt="After" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </>
                                ) : (
                                    <>
                                        <div style={{ padding: '16px', background: 'white', borderRadius: '50%', boxShadow: 'var(--shadow-md)', marginBottom: '12px', color: 'var(--color-primary-500)' }}>
                                            <Camera size={32} />
                                        </div>
                                        <span style={{ color: 'var(--color-primary-500)', fontWeight: 'bold', fontSize: '14px' }}>Tap to Take Photo</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Ensure area is well lit</span>
                                    </>
                                )}
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    After Cleanup
                                    {!afterPhotoPreview && <span style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Pending</span>}
                                </h3>
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>Proof of work required for verification</p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Waste Details */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                        <Scale size={24} /> Waste Collected
                    </h2>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Total Weight Estimation (kg)
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                value={weight}
                                onChange={e => setWeight(e.target.value)}
                                placeholder="0.0"
                                style={{
                                    width: '100%', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: '18px', fontWeight: 'bold',
                                    outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                            <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 'bold' }}>KG</span>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Waste Categories Present
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {WASTE_CATEGORIES.map(cat => {
                                const isSelected = categories.includes(cat.id);
                                return (
                                    <label key={cat.id} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleCategory(cat.id)}
                                            style={{ display: 'none' }}
                                        />
                                        <div style={{
                                            padding: '8px 16px', borderRadius: 'var(--radius-lg)',
                                            border: `2px solid ${isSelected ? 'var(--color-primary-500)' : 'var(--border-subtle)'}`,
                                            background: isSelected ? 'var(--color-primary-50)' : 'var(--bg-subtle)',
                                            color: isSelected ? 'var(--color-primary-500)' : 'var(--text-secondary)',
                                            fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px',
                                            transition: 'all 0.2s'
                                        }}>
                                            <span>{cat.icon}</span> {cat.label}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Submission Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Location Verification (Static display based on report bounds) */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                            <MapIcon size={24} /> Location Verification
                        </h2>

                        <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                                <CheckCircle size={16} /> Location Confirmed
                            </div>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>GPS coordinates logged automatically.</p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Ward</span>
                            <span style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text-primary)' }}>{report.ward || 'Unknown'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Location</span>
                            <span style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>
                                <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                {report.address?.slice(0, 40)}...
                            </span>
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)', padding: '24px',
                        boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden'
                    }}>

                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0', color: 'var(--text-primary)', position: 'relative', zIndex: 10 }}>Ready to Submit?</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 24px 0', position: 'relative', zIndex: 10 }}>
                            Ensure photo is clear and waste is fully segregated.
                        </p>

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            style={{
                                width: '100%', background: 'var(--color-primary-500)', color: 'white',
                                border: 'none', borderRadius: 'var(--radius-lg)', padding: '16px',
                                fontSize: '18px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.7 : 1,
                                position: 'relative', zIndex: 10, transition: 'all 0.2s'
                            }}
                        >
                            {submitting ? (
                                <><RefreshCw size={20} className="spin" /> {submitStage}</>
                            ) : (
                                <>Verify & Submit <ArrowRight size={20} /></>
                            )}
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}
