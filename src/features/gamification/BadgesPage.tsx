import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './BadgesPage.module.css';

interface BadgeDef {
    id: string;
    emoji: string;
    name: string;
    desc: string;
    requirement?: string;
    threshold?: number;
}

export default function BadgesPage() {
    const { profile } = useAuth();
    const [allBadges, setAllBadges] = useState<BadgeDef[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDocs(collection(db, 'badges'))
            .then(snap => setAllBadges(snap.docs.map(d => ({ id: d.id, ...d.data() } as BadgeDef))))
            .finally(() => setLoading(false));
    }, []);

    const userBadgeIds = new Set(profile?.badges ?? []);
    const earned = allBadges.filter(b => userBadgeIds.has(b.id));
    const locked = allBadges.filter(b => !userBadgeIds.has(b.id));

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>🏅 My Badges</h1>
                <p className={styles.subtitle}>{earned.length} of {allBadges.length} badges earned</p>
            </div>

            <div className={styles.progressBar}>
                <div
                    className={styles.progressFill}
                    style={{ width: allBadges.length > 0 ? `${(earned.length / allBadges.length) * 100}%` : '0%' }}
                />
            </div>

            {loading ? (
                <div className={styles.loading}>Loading badges…</div>
            ) : (
                <>
                    {earned.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>✅ Earned</h2>
                            <div className={styles.grid}>
                                {earned.map(b => (
                                    <div key={b.id} className={`${styles.card} ${styles.earned}`}>
                                        <div className={styles.emoji}>{b.emoji}</div>
                                        <div className={styles.badgeName}>{b.name}</div>
                                        <div className={styles.badgeDesc}>{b.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {locked.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>🔒 Locked</h2>
                            <div className={styles.grid}>
                                {locked.map(b => (
                                    <div key={b.id} className={`${styles.card} ${styles.locked}`}>
                                        <div className={styles.emoji} style={{ filter: 'grayscale(1)', opacity: 0.4 }}>{b.emoji}</div>
                                        <div className={styles.badgeName} style={{ opacity: 0.5 }}>{b.name}</div>
                                        {b.requirement && (
                                            <div className={styles.requirement}>🎯 {b.requirement}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {allBadges.length === 0 && (
                        <div className={styles.empty}>
                            <span style={{ fontSize: 48 }}>🏅</span>
                            <p>No badges defined yet.</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Admins can add badges from the admin panel.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
