import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Trophy, User } from 'lucide-react';
import styles from './Leaderboard.module.css';
import WardWarBanner from '../home/WardWarBanner';

type Category = 'wards' | 'blocks' | 'volunteers' | 'colleges' | 'citizens' | 'ward_war';
type Period = 'weekly' | 'monthly' | 'all';

interface LeaderEntry {
    id: string;
    name: string;
    score: number;
    ward?: string;
    badge?: string;
    photoURL?: string;
    userBadges?: any[];
}

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
    { value: 'wards', label: 'Wards', emoji: '🏘️' },
    { value: 'blocks', label: 'Streets / Blocks', emoji: '🛣️' },
    { value: 'volunteers', label: 'Volunteers', emoji: '🙋' },
    { value: 'colleges', label: 'Colleges', emoji: '🎓' },
    { value: 'citizens', label: 'Citizens', emoji: '🧑‍🤝‍🧑' },
    { value: 'ward_war', label: 'Ward War', emoji: '⚔️' },
];

const PERIODS: { value: Period; label: string }[] = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'all', label: 'All Time' },
];

const RANK_BADGES = ['🥇', '🥈', '🥉'];

function Leaderboard() {
    const { t } = useTranslation();
    const [category, setCategory] = useState<Category>('wards');
    const [period, setPeriod] = useState<Period>('weekly');
    const [data, setData] = useState<LeaderEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();
    }, [category, period]);

    const fetchLeaderboard = async () => {
        if (category === 'ward_war') {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let entries: LeaderEntry[] = [];

            // Compute period cutoff for filtering
            let cutoff: Date | null = null;
            if (period === 'weekly') {
                cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - 7);
            } else if (period === 'monthly') {
                cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - 30);
            }

            if (category === 'wards') {
                // Ward & block scores are cumulative — always all-time
                const snap = await getDocs(
                    query(collection(db, 'wards'), orderBy('cleanlinessScore', 'desc'), limit(10))
                );
                entries = snap.docs.map((d, i) => ({
                    id: d.id,
                    name: d.data().name ?? d.id,
                    score: d.data().cleanlinessScore ?? 0,
                    badge: i < 3 ? RANK_BADGES[i] : undefined,
                }));
            } else if (category === 'blocks') {
                const snap = await getDocs(
                    query(collection(db, 'blocks'), orderBy('score', 'desc'), limit(10))
                );
                entries = snap.docs.map((d, i) => ({
                    id: d.id,
                    name: d.data().name ?? d.data().address ?? d.id,
                    score: d.data().score ?? 0,
                    ward: d.data().ward,
                    badge: i < 3 ? RANK_BADGES[i] : undefined,
                }));
            } else if (category === 'volunteers') {
                // For time-based periods, filter by createdAt then rank by points
                const constraints: any[] = [
                    where('roles', 'array-contains', 'volunteer'),
                    orderBy('createdAt', 'desc'),
                    limit(200),
                ];
                if (cutoff) constraints.push(where('createdAt', '>=', cutoff));
                const snap = await getDocs(query(collection(db, 'users'), ...constraints));
                entries = snap.docs
                    .map((d, i) => ({
                        id: d.id,
                        name: d.data().displayName ?? 'Anonymous',
                        score: d.data().points ?? 0,
                        ward: d.data().ward,
                        badge: undefined as string | undefined,
                        photoURL: d.data().photoURL,
                        userBadges: d.data().badges,
                    }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10)
                    .map((e, i) => ({ ...e, badge: i < 3 ? RANK_BADGES[i] : undefined }));
            } else if (category === 'colleges') {
                const constraints: any[] = [
                    where('roles', 'array-contains', 'college_admin'),
                    orderBy('createdAt', 'desc'),
                    limit(200),
                ];
                if (cutoff) constraints.push(where('createdAt', '>=', cutoff));
                const snap = await getDocs(query(collection(db, 'users'), ...constraints));
                entries = snap.docs
                    .map(d => ({
                        id: d.id,
                        name: d.data().organization ?? d.data().displayName ?? 'College',
                        score: d.data().points ?? 0,
                        badge: undefined as string | undefined,
                        photoURL: d.data().photoURL,
                        userBadges: d.data().badges,
                    }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10)
                    .map((e, i) => ({ ...e, badge: i < 3 ? RANK_BADGES[i] : undefined }));
            } else if (category === 'citizens') {
                const constraints: any[] = [
                    where('roles', 'array-contains', 'citizen'),
                    orderBy('createdAt', 'desc'),
                    limit(200),
                ];
                if (cutoff) constraints.push(where('createdAt', '>=', cutoff));
                const snap = await getDocs(query(collection(db, 'users'), ...constraints));
                entries = snap.docs
                    .map(d => ({
                        id: d.id,
                        name: d.data().displayName ?? 'Citizen',
                        score: d.data().points ?? 0,
                        ward: d.data().ward,
                        badge: undefined as string | undefined,
                        photoURL: d.data().photoURL,
                        userBadges: d.data().badges,
                    }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10)
                    .map((e, i) => ({ ...e, badge: i < 3 ? RANK_BADGES[i] : undefined }));
            }

            setData(entries);
        } catch (e) {
            console.error('Leaderboard fetch error:', e);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const maxScore = data.length > 0 ? Math.max(...data.map(d => d.score)) : 1;

    const getRankColor = (i: number) => {
        if (i === 0) return '#F5A623';
        if (i === 1) return '#9CA3AF';
        if (i === 2) return '#CD7F32';
        return 'var(--text-muted)';
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerIcon}>
                    <Trophy size={28} />
                </div>
                <div>
                    <h1 className={styles.title}>{t('gamification.leaderboard')}</h1>
                    <p className={styles.subtitle}>{t('gamification.leaderboardSubtitle')}</p>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filters}>
                <div className={styles.catTabs}>
                    {CATEGORIES.map(c => (
                        <button
                            key={c.value}
                            className={`${styles.tab} ${category === c.value ? styles.tabActive : ''}`}
                            onClick={() => setCategory(c.value)}
                        >
                            {c.emoji} {c.label}
                        </button>
                    ))}
                </div>
                <div className={styles.periodTabs}>
                    {PERIODS.map(p => (
                        <button
                            key={p.value}
                            className={`${styles.periodTab} ${period === p.value ? styles.periodActive : ''}`}
                            onClick={() => setPeriod(p.value)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {category === 'ward_war' ? (
                <div style={{ marginTop: '24px' }}>
                    <WardWarBanner />
                </div>
            ) : loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading leaderboard...
                </div>
            ) : data.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🏆</div>
                    <div className="empty-state-title">No entries yet</div>
                    <p>Be the first to earn points in this category!</p>
                </div>
            ) : (
                <>
                    {/* Podium for top 3 */}
                    {data.length >= 3 && (
                        <div className={styles.podium}>
                            {data.slice(0, 3).map((entry, i) => {
                                const order = [1, 0, 2][i]; // 2nd, 1st, 3rd
                                return (
                                    <div key={entry.id} className={styles.podiumItem} style={{ order }}>
                                        <div className={styles.podiumName}>{entry.badge} {entry.name.split(' ').slice(0, 2).join(' ')}</div>
                                        <div
                                            className={styles.podiumBar}
                                            style={{
                                                height: `${[80, 100, 60][order]}px`,
                                                background: ['#9CA3AF', '#F5A623', '#CD7F32'][order],
                                            }}
                                        >
                                            <div className={styles.podiumRank}>{['#2', '#1', '#3'][order]}</div>
                                        </div>
                                        <div className={styles.podiumScore}>{entry.score}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Rankings list */}
                    <div className={styles.list}>
                        {data.map((entry, i) => (
                            <div key={entry.id} className={`${styles.row} ${i < 3 ? styles.topRow : ''}`}>
                                <div className={styles.rank} style={{ color: getRankColor(i), fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-black)', fontSize: i < 3 ? 'var(--text-xl)' : 'var(--text-base)' }}>
                                    {entry.badge ?? `#${i + 1}`}
                                </div>
                                {entry.photoURL ? (
                                    <img src={entry.photoURL} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                    <div style={{ width: '32px', height: '32px', background: 'var(--bg-subtle)', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={16} color="var(--text-muted)" />
                                    </div>
                                )}
                                <div className={styles.rowInfo}>
                                    <div className={styles.rowName}>
                                        {entry.name}
                                        {entry.userBadges && entry.userBadges.length > 0 && (
                                            <span style={{ marginLeft: '6px', fontSize: '14px' }} title={entry.userBadges[entry.userBadges.length - 1].name}>
                                                {entry.userBadges[entry.userBadges.length - 1].icon}
                                            </span>
                                        )}
                                        {i < 3 && period === 'weekly' && (category === 'citizens' || category === 'volunteers') && (
                                            <span style={{ marginLeft: '8px', fontSize: '11px', background: 'rgba(26,115,232,0.1)', color: '#1a73e8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(26,115,232,0.3)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                <span style={{ marginRight: '4px' }}>₹</span>GPay Reward
                                            </span>
                                        )}
                                    </div>
                                    {entry.ward && <div className={styles.rowMeta}>{entry.ward}</div>}
                                </div>
                                <div className={styles.rowScore}>
                                    <div className={styles.scoreFill}>
                                        <div className={styles.scoreProgress} style={{ width: `${(entry.score / maxScore) * 100}%`, background: getRankColor(i) }} />
                                    </div>
                                    <span className={styles.scoreNum}>{entry.score}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default Leaderboard;
