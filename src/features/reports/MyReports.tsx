import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { type Report, type IssueType } from '../../types';
import { Loader2, MapPin, Clock, Calendar, FileText } from 'lucide-react';
import styles from './MyReports.module.css';

const ISSUE_TYPES: Record<IssueType, { emoji: string; label: string }> = {
    glass_on_road: { emoji: '💎', label: 'Glass on Road' },
    garbage_pile: { emoji: '🗑️', label: 'Garbage Pile' },
    plastic_waste: { emoji: '🥤', label: 'Plastic Waste' },
    organic_waste: { emoji: '🍎', label: 'Organic Waste' },
    drainage: { emoji: '🌊', label: 'Drainage Issue' },
    burning: { emoji: '🔥', label: 'Burning / Fire' },
    toilet_issue: { emoji: '🚽', label: 'Toilet Issue' },
    dead_animal: { emoji: '⚠️', label: 'Dead Animal' },
    others: { emoji: '❓', label: 'Others' },
};

function MyReports() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            if (!user) return;
            try {
                // Fetch reports descending by creation time
                const q = query(
                    collection(db, 'reports'),
                    where('reporterId', '==', user.uid),
                    orderBy('createdAt', 'desc')
                );

                const snapshot = await getDocs(q);
                const fetched: Report[] = [];
                snapshot.forEach((doc) => {
                    // Safety check to parse createdAt properly
                    const data = doc.data();
                    fetched.push({ id: doc.id, ...data } as Report);
                });

                setReports(fetched);
            } catch (error) {
                console.error("Error fetching user reports:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [user]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown date';
        // Handle Firestore Timestamp or string
        let date: Date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp instanceof Timestamp) {
            date = timestamp.toDate();
        } else {
            date = new Date(timestamp);
        }

        return new Intl.DateTimeFormat('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    if (loading) {
        return (
            <div className={styles.loading}>
                <Loader2 size={32} className="animate-spin" />
                <p>Loading your reports...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>{t('nav.my_reports') || 'My Reports'}</h1>
                <p className={styles.subtitle}>Track the status of the issues you've reported.</p>
            </div>

            {reports.length === 0 ? (
                <div className={styles.emptyState}>
                    <FileText className={styles.emptyIcon} />
                    <h3>No Reports Yet</h3>
                    <p>You haven't submitted any reports. When you report an issue, you can track its progress here.</p>
                </div>
            ) : (
                <div className={styles.reportList}>
                    {reports.map(report => (
                        <div key={report.id} className={styles.reportCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.typeBadge}>
                                    <span>{ISSUE_TYPES[report.issueType]?.emoji || '❓'}</span>
                                    <span>{ISSUE_TYPES[report.issueType]?.label || report.issueType}</span>
                                </div>
                                <div className={`${styles.statusBadge} ${styles['status_' + report.status]}`}>
                                    {report.status.replace('_', ' ')}
                                </div>
                            </div>

                            <div className={styles.cardBody}>
                                <div className={styles.imagesContainer}>
                                    <div className={styles.imageWrapper}>
                                        {report.afterPhotoURL && <span className={styles.imageLabel}>Before</span>}
                                        <img src={report.photoURL || '/placeholder.png'} alt="Report photo before" />
                                    </div>
                                    {report.afterPhotoURL && (
                                        <div className={styles.imageWrapper}>
                                            <span className={styles.imageLabel}>After</span>
                                            <img src={report.afterPhotoURL} alt="Report photo after" />
                                        </div>
                                    )}
                                </div>
                                <div className={styles.details}>
                                    {report.description && (
                                        <p className={styles.description}>{report.description}</p>
                                    )}
                                    <div className={styles.metaLine}>
                                        <MapPin size={12} />
                                        <span className={styles.truncate}>{report.address || 'Location provided'}</span>
                                    </div>
                                    <div className={styles.metaLine}>
                                        <Calendar size={12} />
                                        <span>{formatDate(report.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MyReports;
