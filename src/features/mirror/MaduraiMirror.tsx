import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
    Database, Activity, Map as MapIcon, Users,
    ArrowUpRight, TrendingUp, Search
} from 'lucide-react';
import styles from './MaduraiMirror.module.css';

export default function MaduraiMirror() {
    const { t } = useTranslation();
    const [wasteTrendData, setWasteTrendData] = useState<any[]>([]);
    const [issueStatusData, setIssueStatusData] = useState<any[]>([]);
    const [totalReports, setTotalReports] = useState(0);
    const [resolvedCount, setResolvedCount] = useState(0);
    const [activeCitizens, setActiveCitizens] = useState(0);

    useEffect(() => {
        const q = query(collection(db, 'reports'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reports = snapshot.docs.map(doc => doc.data());

            // 1. Calculate Status Distribution
            let resolved = 0;
            let inProgress = 0;
            let open = 0;

            reports.forEach(r => {
                if (r.status === 'resolved') resolved++;
                else if (r.status === 'in_progress' || r.status === 'assigned') inProgress++;
                else open++;
            });

            setTotalReports(reports.length);
            setResolvedCount(resolved);

            const newStatusData = [
                { name: 'Resolved', value: resolved, color: '#10B981' },
                { name: 'In Progress', value: inProgress, color: '#3B82F6' },
                { name: 'Open', value: open, color: '#F59E0B' },
            ].filter(d => d.value > 0);

            setIssueStatusData(newStatusData.length > 0 ? newStatusData : [{ name: 'No Data', value: 1, color: '#cbd5e1' }]);

            // 2. Calculate 7-Day Trend
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const trendMap: Record<string, { name: string, resolved: number, reported: number }> = {};

            // Initialize last 7 days in order
            const trendArray = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayName = days[d.getDay()];
                const entry = { name: dayName, resolved: 0, reported: 0 };
                trendMap[d.toDateString()] = entry;
                trendArray.push(entry);
            }

            reports.forEach(r => {
                // Count reported
                if (r.createdAt?.toDate) {
                    const d = r.createdAt.toDate();
                    const dateStr = d.toDateString();
                    if (trendMap[dateStr]) {
                        trendMap[dateStr].reported++;
                    }
                }

                // Count resolved
                if (r.status === 'resolved' && r.statusHistory) {
                    const resolvedStatus = r.statusHistory.find((h: any) => h.status === 'resolved');
                    if (resolvedStatus?.timestamp?.toDate) {
                        const d = resolvedStatus.timestamp.toDate();
                        const dateStr = d.toDateString();
                        if (trendMap[dateStr]) {
                            trendMap[dateStr].resolved++;
                        }
                    }
                }
            });

            setWasteTrendData(trendArray);
        });

        // Query total active citizens
        const usersSub = onSnapshot(collection(db, 'users'), (snapshot) => {
            setActiveCitizens(snapshot.size);
        });

        return () => {
            unsubscribe();
            usersSub();
        };
    }, []);

    return (
        <div className={styles.mirrorPage}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div>
                        <h1 className={styles.title}>Madurai Mirror</h1>
                        <p className={styles.subtitle}>
                            City Open Data Portal · Live Waste Analytics
                        </p>
                    </div>
                    <div className={styles.poweredBy}>
                        <Database size={16} />
                        <span>Powered by <strong>Google BigQuery</strong> & <strong>Looker Studio</strong></span>
                    </div>
                </div>
            </header>

            {/* Top Stats */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.1)' }}>
                        <Activity size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <div className={styles.statValue}>{totalReports.toLocaleString()}</div>
                        <div className={styles.statLabel}>Reports Logged</div>
                        <div className={styles.statTrend} style={{ color: '#10B981' }}>
                            <ArrowUpRight size={14} /> Live Sync
                        </div>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: '#10B981', background: 'rgba(16,185,129,0.1)' }}>
                        <MapIcon size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <div className={styles.statValue}>{resolvedCount.toLocaleString()}</div>
                        <div className={styles.statLabel}>Issues Resolved</div>
                        <div className={styles.statTrend} style={{ color: '#10B981' }}>
                            <ArrowUpRight size={14} /> Live Sync
                        </div>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: '#8B5CF6', background: 'rgba(139,92,246,0.1)' }}>
                        <Users size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <div className={styles.statValue}>{activeCitizens.toLocaleString()}</div>
                        <div className={styles.statLabel}>Active Users</div>
                        <div className={styles.statTrend} style={{ color: '#F59E0B' }}>
                            <TrendingUp size={14} /> Steady
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className={styles.chartsGrid}>
                {/* Waste Trend */}
                <div className={styles.chartCard} style={{ gridColumn: 'span 2' }}>
                    <h3 className={styles.chartTitle}>7-Day Issue vs Resolution Trend</h3>
                    <div style={{ height: 300, marginTop: '20px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={wasteTrendData}>
                                <defs>
                                    <linearGradient id="colorOrg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorPlast" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorOrg)" />
                                <Area type="monotone" dataKey="reported" name="Reported" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorPlast)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution */}
                <div className={styles.chartCard}>
                    <h3 className={styles.chartTitle}>Current Week Resolution Rate</h3>
                    <div style={{ height: 300, marginTop: '20px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={issueStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {issueStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        {issueStatusData.map(s => (
                            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                                {s.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Banner */}
            <div className={styles.dataBanner}>
                <div className={styles.bannerInfo}>
                    <h3>Data Transparency Guarantee</h3>
                    <p>
                        This portal streams live sanitized data connected directly to our core operations.
                        No manipulation. Just raw facts to keep us accountable.
                    </p>
                </div>
                <button className={styles.exportBtn}>
                    <Search size={16} /> Export Raw CSV
                </button>
            </div>
        </div>
    );
}
