import React, { useState, useEffect } from 'react';
import { collection, getDocs, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { CheckCircle, AlertTriangle, TrendingUp, Users, Droplets, Building, MapPin, Heart, Trash2, Award } from 'lucide-react';
import styles from './SurvekshanDashboard.module.css';

interface Parameter {
    id: string;
    number: number;
    title: string;
    icon: React.ReactNode;
    score: number;
    maxScore: number;
    evidence: string;
    status: 'good' | 'average' | 'poor';
}

function scoreColor(status: string) {
    if (status === 'good') return '#10B981';
    if (status === 'average') return '#F59E0B';
    return '#EF4444';
}

function ScoreBar({ value, max }: { value: number; max: number }) {
    const pct = Math.min((value / max) * 100, 100);
    const color = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';
    return (
        <div style={{ height: 8, borderRadius: 999, background: 'var(--border-subtle)', overflow: 'hidden', flex: 1 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.8s ease' }} />
        </div>
    );
}

export default function SurvekshanDashboard() {
    const [params, setParams] = useState<Parameter[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalScore, setTotalScore] = useState(0);

    useEffect(() => {
        async function load() {
            try {
                const [reportsSnap, resolvedSnap, usersSnap, exchangeSnap, toiletsSnap, binsSnap, eventsSnap] = await Promise.all([
                    getDocs(collection(db, 'reports')),
                    getDocs(query(collection(db, 'reports'), where('status', '==', 'resolved'))),
                    getDocs(collection(db, 'users')),
                    getDocs(collection(db, 'exchange_listings')),
                    getDocs(collection(db, 'toilets')),
                    getDocs(collection(db, 'bins')),
                    getDocs(collection(db, 'events')),
                ]);

                const totalReports = reportsSnap.size;
                const resolved = resolvedSnap.size;
                const resolutionRate = totalReports > 0 ? (resolved / totalReports) * 100 : 0;
                const userCount = usersSnap.size;
                const exchangeCount = exchangeSnap.size;
                const toiletCount = toiletsSnap.size;
                const binCount = binsSnap.size;
                const eventCount = eventsSnap.size;

                // Toilet health: avg rating
                const toilets = toiletsSnap.docs.map(d => d.data());
                const avgToiletRating = toilets.length > 0
                    ? toilets.reduce((s, t) => s + (t.liveRating || 0), 0) / toilets.length
                    : 0;

                const params: Parameter[] = [
                    {
                        id: 'p1',
                        number: 1,
                        title: 'Solid Waste Collection & Transportation',
                        icon: <Trash2 size={20} />,
                        score: Math.min(Math.round(resolutionRate * 28 / 100), 28),
                        maxScore: 28,
                        evidence: `${resolved}/${totalReports} reports resolved (${resolutionRate.toFixed(0)}% resolution rate). ${binCount} bins registered.`,
                        status: resolutionRate >= 70 ? 'good' : resolutionRate >= 40 ? 'average' : 'poor',
                    },
                    {
                        id: 'p2',
                        number: 2,
                        title: 'Scientific Waste Processing',
                        icon: <CheckCircle size={20} />,
                        score: Math.min(exchangeCount * 2, 20),
                        maxScore: 20,
                        evidence: `${exchangeCount} waste exchange transactions. Each transaction diverts waste from landfill.`,
                        status: exchangeCount >= 10 ? 'good' : exchangeCount >= 3 ? 'average' : 'poor',
                    },
                    {
                        id: 'p3',
                        number: 3,
                        title: 'Visible Cleanliness',
                        icon: <MapPin size={20} />,
                        score: Math.min(Math.round(resolutionRate * 17 / 100), 17),
                        maxScore: 17,
                        evidence: `Street-level reports tracked and resolved. ${totalReports} total reports filed by citizens.`,
                        status: resolutionRate >= 70 ? 'good' : resolutionRate >= 40 ? 'average' : 'poor',
                    },
                    {
                        id: 'p4',
                        number: 4,
                        title: 'ODF / ODF+ Status (Public Toilets)',
                        icon: <Building size={20} />,
                        score: Math.min(Math.round(avgToiletRating * 10 / 5), 10),
                        maxScore: 10,
                        evidence: `${toiletCount} public toilets registered. Avg rating: ${avgToiletRating.toFixed(1)}/5 stars from citizen reviews.`,
                        status: avgToiletRating >= 3.5 ? 'good' : avgToiletRating >= 2.5 ? 'average' : 'poor',
                    },
                    {
                        id: 'p5',
                        number: 5,
                        title: 'Source Segregation',
                        icon: <Droplets size={20} />,
                        score: Math.min(exchangeCount, 8),
                        maxScore: 8,
                        evidence: `${exchangeCount} segregated waste listings posted. Exchange requires classification (organic/dry/mixed).`,
                        status: exchangeCount >= 8 ? 'good' : exchangeCount >= 3 ? 'average' : 'poor',
                    },
                    {
                        id: 'p6',
                        number: 6,
                        title: 'Dark Spot Elimination',
                        icon: <AlertTriangle size={20} />,
                        score: Math.min(Math.round(resolutionRate * 8 / 100), 8),
                        maxScore: 8,
                        evidence: `${resolved} dump spots cleared. Waste Crime module tracks repeat locations.`,
                        status: resolutionRate >= 75 ? 'good' : resolutionRate >= 50 ? 'average' : 'poor',
                    },
                    {
                        id: 'p7',
                        number: 7,
                        title: 'Citizen Engagement & Feedback',
                        icon: <Users size={20} />,
                        score: Math.min(Math.round(userCount / 10), 15),
                        maxScore: 15,
                        evidence: `${userCount} registered citizens. ${totalReports} grievances filed. ${eventCount} community events organized.`,
                        status: userCount >= 100 ? 'good' : userCount >= 20 ? 'average' : 'poor',
                    },
                    {
                        id: 'p8',
                        number: 8,
                        title: 'Sanitation Worker Welfare',
                        icon: <Heart size={20} />,
                        score: 5,
                        maxScore: 7,
                        evidence: `Worker task tracking active. Digital task records maintained. Worker streak badges awarded.`,
                        status: 'average',
                    },
                    {
                        id: 'p9',
                        number: 9,
                        title: 'Water Body Cleanliness',
                        icon: <Droplets size={20} />,
                        score: Math.min(Math.round(resolutionRate * 5 / 100), 5),
                        maxScore: 5,
                        evidence: `Reports near water bodies tracked. Vaigai Watch feature monitors river banks.`,
                        status: resolutionRate >= 60 ? 'good' : 'average',
                    },
                    {
                        id: 'p10',
                        number: 10,
                        title: 'GFC Star Rating',
                        icon: <Award size={20} />,
                        score: 0, // calculated from total
                        maxScore: 8,
                        evidence: `Composite score from all parameters. Minimum 3-Star GFC requires 70%+ across all metrics.`,
                        status: 'average',
                    },
                ];

                const subtotal = params.slice(0, 9).reduce((s, p) => s + p.score, 0);
                const maxTotal = params.slice(0, 9).reduce((s, p) => s + p.maxScore, 0);
                const gfcScore = Math.round((subtotal / maxTotal) * 8);
                params[9].score = gfcScore;
                params[9].status = gfcScore >= 6 ? 'good' : gfcScore >= 4 ? 'average' : 'poor';

                const total = params.reduce((s, p) => s + p.score, 0);
                setParams(params);
                setTotalScore(total);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const maxPossible = 126;
    const overallPct = Math.round((totalScore / maxPossible) * 100);
    const starLevel = overallPct >= 75 ? '5-Star' : overallPct >= 60 ? '3-Star' : overallPct >= 40 ? '1-Star' : 'Below 1-Star';

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h2 className={styles.title}>🏆 Swachh Survekshan Dashboard</h2>
                <p className={styles.subtitle}>Live evidence tracker for GFC certification · Auto-calculated from your data</p>
            </div>

            {/* Overall Score */}
            {!loading && (
                <div className={styles.scoreBanner}>
                    <div className={styles.scoreLeft}>
                        <div className={styles.scoreNum}>{totalScore}<span>/{maxPossible}</span></div>
                        <div className={styles.scoreLabel}>Estimated Score</div>
                    </div>
                    <div className={styles.scoreRight}>
                        <div className={styles.starBadge} style={{ color: overallPct >= 60 ? '#F59E0B' : '#9CA3AF' }}>
                            {starLevel === '5-Star' ? '⭐⭐⭐⭐⭐' : starLevel === '3-Star' ? '⭐⭐⭐' : '⭐'} {starLevel}
                        </div>
                        <div className={styles.pctLabel}>{overallPct}% of max score</div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className={styles.loading}>Calculating scores…</div>
            ) : (
                <div className={styles.paramList}>
                    {params.map((p) => (
                        <div key={p.id} className={styles.paramCard}>
                            <div className={styles.paramHeader}>
                                <div className={styles.paramIcon} style={{ color: scoreColor(p.status), background: scoreColor(p.status) + '18' }}>
                                    {p.icon}
                                </div>
                                <div className={styles.paramInfo}>
                                    <div className={styles.paramNum}>Parameter {p.number}</div>
                                    <div className={styles.paramTitle}>{p.title}</div>
                                </div>
                                <div className={styles.paramScore} style={{ color: scoreColor(p.status) }}>
                                    {p.score}<span>/{p.maxScore}</span>
                                </div>
                            </div>
                            <div className={styles.barRow}>
                                <ScoreBar value={p.score} max={p.maxScore} />
                                <span className={styles.pct} style={{ color: scoreColor(p.status) }}>
                                    {Math.round((p.score / p.maxScore) * 100)}%
                                </span>
                            </div>
                            <p className={styles.evidence}>{p.evidence}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.exportBanner}>
                <div>
                    <div className={styles.exportTitle}>Generate Survekshan Package</div>
                    <div className={styles.exportSub}>Export all evidence as a formatted PDF for official submission</div>
                </div>
                <button className={styles.exportBtn} onClick={() => window.print()}>
                    📄 Export PDF
                </button>
            </div>
        </div>
    );
}
