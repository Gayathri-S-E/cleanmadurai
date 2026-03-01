import { useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
    ArrowUpFromLine, Map, Trophy, Repeat2, MapPin,
    AlertCircle, CheckCircle, TrendingUp, Star,
    ShieldCheck, LayoutDashboard, Flame, Mic
} from 'lucide-react';
import { canAccessAdminPanel, canAccessOfficerDashboard, canAccessWasteExchange } from '../../config/navRoles';
import { WardWarBanner } from './WardWarBanner';
import styles from './HomePage.module.css';

// Lazy-load role-specific home pages
const VolunteerHome = lazy(() => import('./role-homes/VolunteerHome'));
const ShopOwnerHome = lazy(() => import('./role-homes/ShopOwnerHome'));
const HotelOwnerHome = lazy(() => import('./role-homes/HotelOwnerHome'));
const MarketVendorHome = lazy(() => import('./role-homes/MarketVendorHome'));
const FarmerHome = lazy(() => import('./role-homes/FarmerHome'));
const AnimalShelterHome = lazy(() => import('./role-homes/AnimalShelterHome'));
const CollegeHome = lazy(() => import('./role-homes/CollegeHome'));

const QUICK_STATS = [
    { key: 'totalReports', icon: <AlertCircle size={20} />, label: 'My Reports', color: 'var(--color-info)' },
    { key: 'resolvedReports', icon: <CheckCircle size={20} />, label: 'Resolved', color: 'var(--color-success)' },
    { key: 'loginStreak', icon: <Flame size={20} />, label: 'Day Streak', color: 'var(--color-danger)' },
    { key: 'points', icon: <Star size={20} />, label: 'Points', color: 'var(--color-accent-400)' },
];

interface BadgeDef { id: string; emoji: string; name: string; desc: string; }
interface CityStats { score: number; delta: number; }

function CitizenHome() {
    const { t } = useTranslation();
    const { profile } = useAuth();
    const { pendingCount, syncPendingReports } = useOfflineQueue();
    const [allBadges, setAllBadges] = useState<BadgeDef[]>([]);
    const [cityStats, setCityStats] = useState<CityStats | null>(null);

    useEffect(() => {
        if (navigator.onLine && pendingCount > 0) syncPendingReports();
    }, [pendingCount]);

    useEffect(() => {
        getDocs(collection(db, 'badges'))
            .then(snap => setAllBadges(snap.docs.map(d => ({ id: d.id, ...d.data() } as BadgeDef))))
            .catch(console.error);
    }, []);

    useEffect(() => {
        getDoc(doc(db, 'cityStats', 'current'))
            .then(snap => { if (snap.exists()) setCityStats(snap.data() as CityStats); })
            .catch(console.error);
    }, []);

    const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
    const userBadges = allBadges.filter(b => profile?.badges?.includes(b.id));

    const quickActions = [
        { to: '/report?mode=photo', icon: <ArrowUpFromLine size={22} />, label: 'Report Issue', color: 'var(--color-primary-500)', bg: 'var(--color-primary-50)' },
        { to: '/report?mode=voice', icon: <Mic size={22} />, label: 'Voice Report', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
        { to: '/map', icon: <Map size={22} />, label: 'View Map', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
    ];
    if (canAccessAdminPanel(profile?.roles ?? [])) {
        quickActions.push({ to: '/admin', icon: <ShieldCheck size={22} />, label: 'Admin Panel', color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' });
    } else if (canAccessOfficerDashboard(profile?.roles ?? [])) {
        quickActions.push({ to: '/dashboard', icon: <LayoutDashboard size={22} />, label: 'Dashboard', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' });
    } else {
        quickActions.push({ to: '/adopt', icon: <MapPin size={22} />, label: 'Adopt Block', color: 'var(--color-success)', bg: 'var(--color-success-bg)' });
    }
    quickActions.push({ to: '/leaderboard', icon: <Trophy size={22} />, label: 'Leaderboard', color: 'var(--color-accent-400)', bg: 'var(--color-accent-100)' });
    if (canAccessWasteExchange(profile?.roles ?? [])) {
        quickActions.push({ to: '/exchange', icon: <Repeat2 size={22} />, label: 'Waste Exchange', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' });
    }

    return (
        <div className={styles.page}>
            {pendingCount > 0 && (
                <div className="offline-banner">⏳ {pendingCount} report{pendingCount > 1 ? 's' : ''} waiting to sync</div>
            )}
            <div className={styles.hero}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()},</p>
                    <h1 className={styles.heroName}>{profile?.displayName?.split(' ')[0] ?? 'Citizen'} 👋</h1>
                    <p className={styles.heroSub}>
                        Ward: <strong>{profile?.ward ?? 'Not set'}</strong>
                        {profile?.roles?.[0] && (<> · <span className={styles.roleChip}>{profile.roles[0].replace(/_/g, ' ')}</span></>)}
                    </p>
                </div>
                <div className={styles.heroScore}>
                    <div className={styles.scoreRing}>
                        <svg viewBox="0 0 80 80" className={styles.scoreCircle}>
                            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--color-primary-100)" strokeWidth="8" />
                            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--color-primary-500)" strokeWidth="8"
                                strokeDasharray={`${((cityStats?.score ?? 0) * 2 * Math.PI * 32) / 100} ${2 * Math.PI * 32}`}
                                strokeLinecap="round" strokeDashoffset={0} transform="rotate(-90 40 40)" />
                        </svg>
                        <span className={styles.scoreVal}>{profile?.points ?? 0}</span>
                    </div>
                    <span className={styles.scoreLabel}>Total Points</span>
                </div>
            </div>

            <div className={styles.statsGrid}>
                {QUICK_STATS.map(stat => (
                    <div key={stat.key} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: stat.color, background: `${stat.color}18` }}>{stat.icon}</div>
                        <div className={styles.statVal}>{(profile as any)?.[stat.key] ?? 0}</div>
                        <div className={styles.statLabel}>{stat.label}</div>
                    </div>
                ))}
            </div>

            <section className={styles.section}>
                <WardWarBanner />
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Quick Actions</h2>
                <div className={styles.actionsGrid}>
                    {quickActions.map(a => (
                        <Link key={a.to} to={a.to} className={styles.actionCard}>
                            <div className={styles.actionIcon} style={{ color: a.color, background: a.bg }}>{a.icon}</div>
                            <span className={styles.actionLabel}>{a.label}</span>
                        </Link>
                    ))}
                </div>
            </section>

            {userBadges.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>My Badges</h2>
                    <div className={styles.badgesRow}>
                        {userBadges.map(b => (
                            <div key={b.id} className={styles.badgeCard}>
                                <div className={styles.badgeEmoji}>{b.emoji}</div>
                                <div className={styles.badgeName}>{b.name}</div>
                                <div className={styles.badgeDesc}>{b.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {(profile?.totalReports ?? 0) === 0 && (
                <div className={styles.ctaCard}>
                    <div className={styles.ctaIcon}>🌆</div>
                    <h3 className={styles.ctaTitle}>Help Madurai Shine!</h3>
                    <p className={styles.ctaDesc}>Be the change — report your first issue and earn 10 points instantly.</p>
                    <Link to="/report" className="btn btn-primary btn-lg">
                        <ArrowUpFromLine size={18} /> Report Your First Issue
                    </Link>
                </div>
            )}

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Today's City Score</h2>
                <div className={styles.cityScore}>
                    <div className={styles.cityScoreHeader}>
                        <TrendingUp size={20} style={{ color: 'var(--color-primary-500)' }} />
                        <span>Madurai Overall</span>
                    </div>
                    <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${cityStats?.score ?? 0}%` }} />
                    </div>
                    <div className={styles.scoreRange}>
                        <span>{cityStats !== null ? `${cityStats.score} / 100` : 'Loading…'}</span>
                        {cityStats !== null && cityStats.delta !== 0 && (
                            <span style={{ color: cityStats.delta > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {cityStats.delta > 0 ? `↑ +${cityStats.delta}` : `↓ ${cityStats.delta}`} from yesterday
                            </span>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

const RoleLoader = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--color-primary-100)', borderTop: '3px solid var(--color-primary-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
);

/**
 * RoleHomePage — dispatches to the correct home screen based on the user's primary role.
 * Officers and admins are already redirected by RoleRedirect in App.tsx, so they will
 * never reach this component in normal flow.
 */
function HomePage() {
    const { profile } = useAuth();
    const primaryRole = profile?.roles?.[0];

    return (
        <Suspense fallback={<RoleLoader />}>
            {primaryRole === 'volunteer' && <VolunteerHome />}
            {primaryRole === 'shop_owner' && <ShopOwnerHome />}
            {primaryRole === 'hotel_owner' && <HotelOwnerHome />}
            {primaryRole === 'market_vendor' && <MarketVendorHome />}
            {primaryRole === 'farmer' && <FarmerHome />}
            {primaryRole === 'animal_shelter' && <AnimalShelterHome />}
            {primaryRole === 'college_admin' && <CollegeHome />}
            {/* citizen, recycler, undefined, or any other role → generic citizen home */}
            {(!primaryRole || primaryRole === 'citizen' ||
                !['volunteer', 'shop_owner', 'hotel_owner', 'market_vendor', 'farmer', 'animal_shelter', 'college_admin'].includes(primaryRole)) && (
                    <CitizenHome />
                )}
        </Suspense>
    );
}

export default HomePage;
