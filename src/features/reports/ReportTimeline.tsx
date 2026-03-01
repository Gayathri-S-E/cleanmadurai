import { format } from 'date-fns';

interface TimelineEvent {
    status: string;
    changedBy?: string;
    changedByName?: string;
    timestamp?: string;
    note?: string;
}

interface ReportTimelineProps {
    report: {
        id: string;
        status: string;
        issueType?: string;
        waste_type?: string;
        createdAt?: any;
        reporterName?: string;
        reporter?: string;
        reporter_uid?: string;
        is_anonymous?: boolean;
        isAnonymous?: boolean;
        ai_waste_type?: string;
        aiWasteType?: string;
        ai_waste_confidence?: number;
        aiConfidence?: number;
        aiVerified?: boolean;
        ai_verification_result?: string;
        aiVerifyNote?: string;
        ai_verification_confidence?: number;
        aiImprovement?: string;
        ai_verification_level?: string;
        community_yes_votes?: number;
        community_no_votes?: number;
        resolved_at?: any;
        resolvedAt?: any;
        verified_at?: any;
        photo_before_url?: string;
        photo_after_url?: string;
        photoURL?: string;
        afterPhotoURL?: string;
        statusHistory?: TimelineEvent[];
        assigned_officer_uid?: string;
        assigned_worker_uid?: string;
        assignedWorker?: string;
    };
    isOfficer?: boolean;
}

interface StepDef {
    key: string;
    label: string;
    icon: string;
    desc: (r: ReportTimelineProps['report'], history: TimelineEvent[]) => string;
    statuses: string[];
}

const STEPS: StepDef[] = [
    {
        key: 'submitted',
        label: 'Report Submitted',
        icon: '📸',
        statuses: ['open', 'assigned', 'in_progress', 'resolved', 'verified', 'rejected', 'reopened', 'escalated'],
        desc: (r, _) => {
            const anon = r.is_anonymous || r.isAnonymous;
            const type = (r.waste_type || r.issueType || 'Unknown').replace(/_/g, ' ');
            return `${anon ? 'Anonymous' : (r.reporterName || 'Citizen')} reported ${type}`;
        },
    },
    {
        key: 'received',
        label: 'Officer Received',
        icon: '👮',
        statuses: ['assigned', 'in_progress', 'resolved', 'verified', 'reopened', 'escalated'],
        desc: (_, h) => {
            const e = h.find(x => x.status === 'assigned');
            return e ? `Received by ${e.changedByName || 'Officer'}` : 'Received by ward officer';
        },
    },
    {
        key: 'assigned',
        label: 'Worker Assigned',
        icon: '👷',
        statuses: ['in_progress', 'resolved', 'verified', 'reopened'],
        desc: (r, h) => {
            const worker = r.assignedWorker || r.assigned_worker_uid;
            const e = h.find(x => x.status === 'assigned' || x.status === 'in_progress');
            return worker ? `Assigned to ${worker}` : (e?.changedByName ? `Assigned by ${e.changedByName}` : 'Worker dispatched');
        },
    },
    {
        key: 'in_progress',
        label: 'In Progress',
        icon: '⚙️',
        statuses: ['in_progress', 'resolved', 'verified'],
        desc: (_, h) => {
            const e = h.find(x => x.status === 'in_progress');
            return e?.changedByName ? `Started by ${e.changedByName}` : 'Cleaning in progress';
        },
    },
    {
        key: 'resolved',
        label: 'Resolved',
        icon: '✅',
        statuses: ['resolved', 'verified'],
        desc: (r, h) => {
            const e = h.find(x => x.status === 'resolved');
            return e?.changedByName ? `Resolved by ${e.changedByName}` : 'Area cleaned';
        },
    },
    {
        key: 'ai_verified',
        label: 'AI Verification',
        icon: '🤖',
        statuses: ['verified'],
        desc: (r, _) => {
            const level = r.ai_verification_level || r.aiImprovement || '';
            const conf = r.ai_verification_confidence || (r.aiConfidence ? Math.round((r.aiConfidence as number) * 100) : null);
            return level
                ? `${level.toUpperCase()} improvement${conf ? ` — ${conf}% confidence` : ''}`
                : 'Before/after comparison complete';
        },
    },
    {
        key: 'verified',
        label: 'Community Verified',
        icon: '🏆',
        statuses: ['verified'],
        desc: (r, _) => {
            const yes = r.community_yes_votes || 0;
            const no = r.community_no_votes || 0;
            return `${yes} neighbours confirmed clean${no > 0 ? `, ${no} disputed` : ''}`;
        },
    },
];

function timeStr(ts: any): string {
    if (!ts) return '';
    try {
        const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
        return format(d, 'dd MMM · hh:mm a');
    } catch { return ''; }
}

function historyTime(history: TimelineEvent[], statusKey: string): string {
    const e = history.find((x: TimelineEvent) => x.status === statusKey);
    if (!e?.timestamp) return '';
    try { return format(new Date(e.timestamp), 'dd MMM · hh:mm a'); } catch { return ''; }
}

export function ReportTimeline({ report, isOfficer = false }: ReportTimelineProps) {
    const history = report.statusHistory || [];

    const currentStatuses = [
        report.status,
        ...(history.map(h => h.status)),
    ];

    const isComplete = (step: StepDef) =>
        step.statuses.some(s => currentStatuses.includes(s));

    const isCurrent = (step: StepDef) =>
        step.key === report.status || (step.key === 'received' && report.status === 'assigned');

    return (
        <div style={{ padding: '4px 0' }}>
            {STEPS.map((step, i) => {
                const done = isComplete(step);
                const current = isCurrent(step);
                const future = !done && !current;

                return (
                    <div key={step.key} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                        {/* Connector line */}
                        {i < STEPS.length - 1 && (
                            <div style={{
                                position: 'absolute', left: '15px', top: '32px',
                                width: '2px', height: 'calc(100% - 12px)',
                                background: done ? 'var(--color-success)' : 'var(--border-subtle)',
                                zIndex: 0,
                            }} />
                        )}

                        {/* Circle */}
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, zIndex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px',
                            background: done ? 'var(--color-success)' : future ? 'var(--bg-subtle)' : 'var(--color-warning)',
                            border: `2px solid ${done ? 'var(--color-success)' : future ? 'var(--border-subtle)' : 'var(--color-warning)'}`,
                            opacity: future ? 0.45 : 1,
                        }}>
                            {done ? '✓' : step.icon}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, paddingBottom: i < STEPS.length - 1 ? '20px' : '0', opacity: future ? 0.45 : 1 }}>
                            <div style={{
                                fontWeight: done ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                                fontSize: '13px',
                                color: done ? 'var(--text-primary)' : 'var(--text-muted)',
                            }}>
                                {step.label}
                                {current && (
                                    <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 6px', borderRadius: '99px', background: 'var(--color-warning)', color: 'white', fontWeight: 'var(--fw-bold)' }}>
                                        CURRENT
                                    </span>
                                )}
                            </div>
                            {done && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {step.desc(report, history)}
                                </div>
                            )}
                            {step.key === 'submitted' && report.createdAt && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {timeStr(report.createdAt)}
                                </div>
                            )}
                            {step.key !== 'submitted' && done && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                    {historyTime(history, step.key) || historyTime(history, step.statuses[0])}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default ReportTimeline;
