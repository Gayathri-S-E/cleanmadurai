import { useAuth } from '../../contexts/AuthContext';
import { Share2, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './BadgeShowcase.module.css';

const ALL_BADGES = [
    {
        id: 'first_report',
        icon: '📝',
        name: 'First Reporter',
        description: 'Submitted your first waste report',
        rarity: 'common',
        pointsAwarded: 10,
        unlockedBy: 'File 1 report',
    },
    {
        id: 'glass_guardian',
        icon: '🛡️',
        name: 'Glass Guardian',
        description: 'Reported glass hazards to protect citizens',
        rarity: 'rare',
        pointsAwarded: 50,
        unlockedBy: 'Report 3 glass incidents',
    },
    {
        id: 'street_savior',
        icon: '🏆',
        name: 'Street Savior',
        description: 'A hero who transformed unsafe streets',
        rarity: 'epic',
        pointsAwarded: 100,
        unlockedBy: 'File 10+ reports',
    },
    {
        id: 'temple_zone_hero',
        icon: '🛕',
        name: 'Temple Zone Hero',
        description: 'Reported issues near Meenakshi Temple during festival',
        rarity: 'legendary',
        pointsAwarded: 200,
        unlockedBy: 'Report in temple zone on festival day',
    },
    {
        id: 'clean_ambassador',
        icon: '🌟',
        name: 'Clean Ambassador',
        description: 'Reached 100 Jigarthanda Points — a true champion!',
        rarity: 'epic',
        pointsAwarded: 50,
        unlockedBy: 'Earn 100 points total',
    },
    {
        id: 'waste_warrior',
        icon: '⚔️',
        name: 'Waste Warrior',
        description: 'Elite civic warrior with 500+ Jigarthanda Points',
        rarity: 'legendary',
        pointsAwarded: 100,
        unlockedBy: 'Earn 500 points total',
    },
    {
        id: 'block_adopter',
        icon: '🏠',
        name: 'Block Guardian',
        description: 'Adopted a street block and kept it clean',
        rarity: 'rare',
        pointsAwarded: 50,
        unlockedBy: 'Adopt 1 block',
    },
    {
        id: 'swachh_hero',
        icon: '🌿',
        name: 'Swachh Hero',
        description: 'Participated in 3+ community clean drives',
        rarity: 'epic',
        pointsAwarded: 75,
        unlockedBy: 'Join 3 cleanup events',
    },
];

const RARITY_STYLES: Record<string, { label: string; gradient: string; border: string; glow: string }> = {
    common: {
        label: 'Common',
        gradient: 'linear-gradient(135deg, #6B7280, #9CA3AF)',
        border: '#9CA3AF',
        glow: 'rgba(156,163,175,0.3)',
    },
    rare: {
        label: 'Rare',
        gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
        border: '#3B82F6',
        glow: 'rgba(59,130,246,0.3)',
    },
    epic: {
        label: 'Epic',
        gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
        border: '#8B5CF6',
        glow: 'rgba(139,92,246,0.35)',
    },
    legendary: {
        label: 'Legendary',
        gradient: 'linear-gradient(135deg, #F5A623, #EF4444)',
        border: '#F5A623',
        glow: 'rgba(245,166,35,0.4)',
    },
};

function BadgeShowcase() {
    const { profile } = useAuth();
    const earnedBadgeIds: string[] = (profile?.badges ?? []).map((b: any) => b.id ?? b);
    const points = profile?.points ?? 0;

    // Next badge to unlock
    const nextBadge = ALL_BADGES.find(b => !earnedBadgeIds.includes(b.id));

    // Progress to legendary
    const legendaryBadges = ALL_BADGES.filter(b => b.rarity === 'legendary');
    const legendaryEarned = legendaryBadges.filter(b => earnedBadgeIds.includes(b.id)).length;

    const handleShare = async (badge: typeof ALL_BADGES[0]) => {
        const text = `I just earned the "${badge.name}" ${badge.icon} badge on Smart Madurai! Helping keep Madurai clean. #SmartMadurai #SwachhMadurai`;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Smart Madurai Badge', text });
            } else {
                await navigator.clipboard.writeText(text);
                toast.success('Badge info copied!', { icon: badge.icon });
            }
        } catch { /* ignore */ }
    };

    return (
        <div className={styles.showcase}>
            {/* Header */}
            <div className={styles.showcaseHeader}>
                <div className={styles.pointsBall}>
                    <span className={styles.coinIcon}>🥤</span>
                    <div>
                        <div className={styles.pointsNum}>{points.toLocaleString()}</div>
                        <div className={styles.pointsLabel}>Jigarthanda Points</div>
                    </div>
                </div>

                <div className={styles.badgeSummary}>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryNum}>{earnedBadgeIds.length}</span>
                        <span className={styles.summaryLabel}>Earned</span>
                    </div>
                    <div className={styles.summarySep} />
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryNum}>{ALL_BADGES.length}</span>
                        <span className={styles.summaryLabel}>Total</span>
                    </div>
                    <div className={styles.summarySep} />
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryNum}>{legendaryEarned}</span>
                        <span className={styles.summaryLabel}>Legendary</span>
                    </div>
                </div>
            </div>

            {/* Next milestone */}
            {nextBadge && (
                <div className={styles.nextMilestone}>
                    <Star size={16} style={{ color: '#F5A623', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 'var(--fw-semibold)' }}>Next: {nextBadge.icon} {nextBadge.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{nextBadge.unlockedBy}</div>
                    </div>
                    <span className={styles.rewardChip}>+{nextBadge.pointsAwarded} pts</span>
                </div>
            )}

            {/* Badge Grid */}
            <div className={styles.badgeGrid}>
                {ALL_BADGES.map(badge => {
                    const earned = earnedBadgeIds.includes(badge.id);
                    const rarity = RARITY_STYLES[badge.rarity];
                    return (
                        <div
                            key={badge.id}
                            className={`${styles.badgeCard} ${earned ? styles.badgeEarned : styles.badgeLocked}`}
                            style={earned ? {
                                borderColor: rarity.border,
                                boxShadow: `0 4px 20px ${rarity.glow}`,
                            } : {}}
                        >
                            {/* NFT-style badge icon */}
                            <div
                                className={styles.badgeIcon}
                                style={earned ? { background: rarity.gradient } : {}}
                            >
                                <span className={styles.badgeEmoji}>{earned ? badge.icon : '🔒'}</span>
                                {earned && (
                                    <div className={styles.rarityPip} style={{ background: rarity.border }}>
                                        {rarity.label}
                                    </div>
                                )}
                            </div>

                            <div className={styles.badgeInfo}>
                                <div className={styles.badgeName}>{badge.name}</div>
                                <div className={styles.badgeDesc}>
                                    {earned ? badge.description : badge.unlockedBy}
                                </div>
                                {earned && (
                                    <div className={styles.badgePoints}>+{badge.pointsAwarded} pts earned</div>
                                )}
                            </div>

                            {earned && (
                                <button
                                    className={styles.shareBtn}
                                    onClick={() => handleShare(badge)}
                                    title="Share this badge"
                                >
                                    <Share2 size={13} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {earnedBadgeIds.length === 0 && (
                <div className="empty-state" style={{ marginTop: '8px' }}>
                    <div className="empty-state-icon">🏅</div>
                    <div className="empty-state-title">No badges yet</div>
                    <p>Start reporting issues to earn your first badge!</p>
                </div>
            )}
        </div>
    );
}

export default BadgeShowcase;
