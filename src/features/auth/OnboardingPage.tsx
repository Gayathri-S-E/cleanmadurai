import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';
import { Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

const ROLES: { value: UserRole; emoji: string; label: string; desc: string; autoApprove: boolean }[] = [
    { value: 'citizen', emoji: '🏘️', label: 'Citizen / Resident', desc: 'Report waste, track resolution, participate in your ward', autoApprove: true },
    { value: 'volunteer', emoji: '🙋', label: 'Volunteer / Student', desc: 'Organize cleanups, compete in leaderboards', autoApprove: true },
    { value: 'shop_owner', emoji: '🏪', label: 'Shop Owner', desc: 'Legally dispose dry waste through our exchange network', autoApprove: false },
    { value: 'hotel_owner', emoji: '🍽️', label: 'Hotel / Restaurant', desc: 'Exchange food waste with farmers and shelters', autoApprove: false },
    { value: 'market_vendor', emoji: '🥦', label: 'Market Vendor', desc: 'Connect unsold produce with farmers and feed stores', autoApprove: false },
    { value: 'farmer', emoji: '🌾', label: 'Farmer', desc: 'Receive organic waste for compost and animal feed', autoApprove: false },
    { value: 'animal_shelter', emoji: '🐄', label: 'Animal Shelter', desc: 'Access organic food waste for shelter animals', autoApprove: false },
    { value: 'recycler', emoji: '♻️', label: 'Recycler', desc: 'Collect plastic, paper, metal from shops; schedule pickup via app', autoApprove: false },
    { value: 'college_admin', emoji: '🎓', label: 'College / NGO Admin', desc: 'Manage volunteer teams, track institutional impact', autoApprove: false },
    { value: 'corp_officer', emoji: '👷', label: 'Corporation Officer', desc: 'Manage ward complaints and coordinate workers', autoApprove: false },
];

function OnboardingPage() {
    const { user, profile, profileChecked, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [selected, setSelected] = useState<UserRole | null>(null);
    const [ward, setWard] = useState('');
    const [org, setOrg] = useState('');
    const [loading, setLoading] = useState(false);
    const [wardOptions, setWardOptions] = useState<string[]>([]);

    // Load ward names from Firestore
    useEffect(() => {
        getDocs(collection(db, 'wards')).then(snap => {
            const names = snap.docs.map(d => d.data().name ?? d.id).sort();
            setWardOptions(names);
        }).catch(console.error);
    }, []);

    // If user already has a profile in Firestore, skip onboarding
    if (profileChecked && profile) {
        navigate('/home', { replace: true });
        return null;
    }

    const handleSubmit = async () => {
        if (!selected || !user) return;
        if (!ward) { toast.error('Please enter your ward'); return; }

        const roleInfo = ROLES.find((r) => r.value === selected)!;
        setLoading(true);

        try {
            const userDoc = {
                uid: user.uid,
                displayName: user.displayName ?? 'User',
                email: user.email ?? '',
                phone: user.phoneNumber ?? '',
                photoURL: user.photoURL ?? '',
                roles: [selected], // always set role so role-specific home page is shown; approved flag gates actual feature access
                ward,
                organization: org,
                points: 0,
                badges: [],
                adoptedBlocks: [],
                totalReports: 0,
                resolvedReports: 0,
                language: 'en',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                ...(roleInfo.autoApprove
                    ? {}
                    : {
                        pendingRoleRequest: {
                            requestedRole: selected,
                            status: 'pending',
                            requestedAt: serverTimestamp(),
                        },
                    }),
            };

            await setDoc(doc(db, 'users', user.uid), userDoc);

            if (!roleInfo.autoApprove) {
                // Also create a roleRequests doc for admin review
                await setDoc(doc(db, 'roleRequests', user.uid), {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    requestedRole: selected,
                    ward,
                    organization: org,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                });
            }

            await refreshProfile();
            toast.success(
                roleInfo.autoApprove
                    ? 'Welcome to Clean Madurai! 🎉'
                    : 'Account created! Your role is pending approval.'
            );
            navigate('/home');
        } catch (err: any) {
            toast.error('Failed to save profile. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const selectedInfo = ROLES.find((r) => r.value === selected);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
            <div style={{ width: '100%', maxWidth: '680px' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-xl)', background: 'var(--color-primary-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', fontSize: '1.75rem' }}>
                        🌿
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--space-2)' }}>
                        What describes you?
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)' }}>
                        {selectedInfo?.autoApprove === false
                            ? 'Role requires admin approval — you can start using basic features immediately'
                            : 'Choose your role to get the right experience'}
                    </p>
                </div>

                {/* Role grid */}
                <div className={styles.roleGrid}>
                    {ROLES.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            className={`${styles.roleCard} ${selected === r.value ? styles.selected : ''}`}
                            onClick={() => setSelected(r.value)}
                        >
                            <div className={styles.roleEmoji}>{r.emoji}</div>
                            <div className={styles.roleName}>{r.label}</div>
                            <div className={styles.roleDesc}>{r.desc}</div>
                            {!r.autoApprove && (
                                <span className="badge badge-warning" style={{ marginTop: 'var(--space-1)', fontSize: '10px' }}>
                                    Needs Approval
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Ward + Org fields */}
                {selected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', animation: 'fadeIn 0.3s ease' }}>
                        <div className="form-group">
                            <label className="form-label required">Your Ward</label>
                            {wardOptions.length > 0 ? (
                                <select
                                    className="select"
                                    value={ward}
                                    onChange={(e) => setWard(e.target.value)}
                                >
                                    <option value="">— Select your ward —</option>
                                    {wardOptions.map(w => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    className="input"
                                    value={ward}
                                    onChange={(e) => setWard(e.target.value)}
                                    placeholder="e.g. Ward 1 – Meenakshi Nagar"
                                />
                            )}
                        </div>
                        {!['citizen', 'volunteer'].includes(selected) && (
                            <div className="form-group">
                                <label className="form-label">Organization Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={org}
                                    onChange={(e) => setOrg(e.target.value)}
                                    placeholder="Hotel / College / Market name..."
                                />
                            </div>
                        )}
                    </div>
                )}

                <button
                    className="btn btn-primary btn-full btn-lg"
                    disabled={!selected || !ward || loading}
                    onClick={handleSubmit}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    {loading ? 'Setting up...' : 'Continue to App'}
                </button>
            </div>
        </div>
    );
}

export default OnboardingPage;
