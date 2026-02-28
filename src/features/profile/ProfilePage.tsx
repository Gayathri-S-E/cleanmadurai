import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';
import { Camera, Star, MapPin, LogOut, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BadgeShowcase from './BadgeShowcase';
import styles from './ProfilePage.module.css';

const BADGE_MAP: Record<string, { emoji: string; name: string; desc: string }> = {
    first_report: { emoji: '🌟', name: 'First Reporter', desc: 'Submitted first report' },
    clean_ambassador: { emoji: '🌟', name: 'Clean Ambassador', desc: 'Reached 100 contribution points' },
    waste_warrior: { emoji: '⚔️', name: 'Waste Warrior', desc: 'Reached 500 contribution points' },
    glass_guardian: { emoji: '🛡️', name: 'Glass Guardian', desc: 'Reported 10 glass issues' },
    temple_zone_hero: { emoji: '🛕', name: 'Temple Zone Hero', desc: 'Active in temple/special zones' },
    street_savior: { emoji: '🏆', name: 'Street Savior', desc: 'Maintained clean block 7 days' },
    eco_champion: { emoji: '♻️', name: 'Eco Champion', desc: 'Completed first waste exchange' },
    active_volunteer: { emoji: '🙋', name: 'Active Volunteer', desc: 'Attended 5 cleanathons' },
};

function ProfilePage() {
    const { t } = useTranslation();
    const { user, profile, updateUserProfile, logout } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
    const [ward, setWard] = useState(profile?.ward ?? '');
    const [phone, setPhone] = useState(profile?.phone ?? '');
    const [saving, setSaving] = useState(false);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        const avatarRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(avatarRef, file);
        const url = await getDownloadURL(avatarRef);
        await updateUserProfile({ photoURL: url });
        toast.success('Profile photo updated!');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateUserProfile({ displayName, ward, phone });
            toast.success('Profile saved!');
            setEditing(false);
        } catch (e) { toast.error('Failed to save'); }
        finally { setSaving(false); }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const earnedBadges = (profile?.badges ?? []).map(id => BADGE_MAP[id]).filter(Boolean);

    return (
        <div className={styles.page}>
            {/* Hero */}
            <div className={styles.hero}>
                {/* Avatar */}
                <div className={styles.avatarWrapper}>
                    <div className={styles.avatar}>
                        {profile?.photoURL ? (
                            <img src={profile.photoURL} alt={profile.displayName} />
                        ) : (
                            <span>{profile?.displayName?.charAt(0)?.toUpperCase() ?? '?'}</span>
                        )}
                    </div>
                    <button
                        className={styles.avatarEdit}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Camera size={14} />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                </div>

                <div className={styles.heroInfo}>
                    <h1 className={styles.heroName}>{profile?.displayName}</h1>
                    <div className={styles.roles}>
                        {profile?.roles?.map(role => (
                            <span key={role} className="badge badge-primary">{t(`auth.roles.${role}`)}</span>
                        ))}
                    </div>
                    <div className={styles.heroMeta}>
                        <MapPin size={14} /> <span>{profile?.ward ?? 'Ward not set'}</span>
                    </div>
                </div>

                {/* Points ring */}
                <div className={styles.pointsRing}>
                    <Star size={20} style={{ color: 'var(--color-accent-400)' }} />
                    <div className={styles.pointsVal}>{profile?.points ?? 0}</div>
                    <div className={styles.pointsLabel}>{t('app.jigarthandaPoints')}</div>
                </div>
            </div>

            {/* Stats row */}
            <div className={styles.statsRow}>
                {[
                    { label: 'Reports Filed', val: profile?.totalReports ?? 0, icon: '📋' },
                    { label: 'Issues Resolved', val: profile?.resolvedReports ?? 0, icon: '✅' },
                    { label: 'Blocks Adopted', val: profile?.adoptedBlocks?.length ?? 0, icon: '🏠' },
                    { label: 'Badges Earned', val: profile?.badges?.length ?? 0, icon: '🏅' },
                ].map(s => (
                    <div key={s.label} className={styles.statItem}>
                        <div className={styles.statEmoji}>{s.icon}</div>
                        <div className={styles.statVal}>{s.val}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Edit form */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Profile Details</h2>
                    {!editing ? (
                        <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit</button>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    )}
                </div>
                <div className={styles.fields}>
                    {[
                        { field: 'Name', val: displayName, set: setDisplayName, type: 'text' },
                        { field: 'Email', val: user?.email ?? '', set: () => { }, type: 'email', readonly: true },
                        { field: 'Phone', val: phone, set: setPhone, type: 'tel' },
                        { field: 'Ward', val: ward, set: setWard, type: 'text' },
                    ].map(({ field, val, set, type, readonly }) => (
                        <div key={field} className={styles.field}>
                            <label className="form-label">{field}</label>
                            {editing && !readonly ? (
                                <input type={type} className="input" value={val} onChange={e => set(e.target.value)} />
                            ) : (
                                <div className={styles.fieldVal}>{val || '—'}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Badge Showcase – Jigarthanda Points + NFT-ready badges */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>🏅 Badges & Jigarthanda Points</h2>
                </div>
                <BadgeShowcase />
            </div>

            {/* Danger zone */}
            <div className={styles.dangerZone}>
                <button className="btn btn-danger" onClick={handleLogout}>
                    <LogOut size={16} /> {t('auth.logout')}
                </button>
            </div>
        </div>
    );
}

export default ProfilePage;
