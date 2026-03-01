import { useState, useRef, useCallback } from 'react';

interface BeforeAfterViewProps {
    report: {
        id: string;
        photoURL?: string;
        photo_before_url?: string;
        afterPhotoURL?: string;
        photo_after_url?: string;
        createdAt?: any;
        resolved_at?: any;
        resolvedAt?: any;
        ai_verification_level?: string;
        aiImprovement?: string;
        ai_verification_confidence?: number;
        aiConfidence?: number;
        aiVerifyNote?: string;
        aiVerified?: boolean;
        community_yes_votes?: number;
        community_no_votes?: number;
        status?: string;
    };
}

function timeStr(ts: any): string {
    if (!ts) return '';
    try {
        const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
        return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function timeDiff(from: any, to: any): string {
    if (!from || !to) return '';
    try {
        const a = from.toDate ? from.toDate() : new Date(from.seconds ? from.seconds * 1000 : from);
        const b = to.toDate ? to.toDate() : new Date(to.seconds ? to.seconds * 1000 : to);
        const diffMs = Math.abs(b.getTime() - a.getTime());
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
        return `${hours}h ${mins}m`;
    } catch { return ''; }
}

const AI_LEVEL_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    complete: { label: 'COMPLETE', color: '#16a34a', icon: '✅' },
    significant: { label: 'SIGNIFICANT', color: '#22c55e', icon: '✅' },
    partial: { label: 'PARTIAL', color: '#d97706', icon: '⚠️' },
    none: { label: 'NO IMPROVEMENT', color: '#dc2626', icon: '❌' },
    COMPLETE: { label: 'COMPLETE', color: '#16a34a', icon: '✅' },
    SIGNIFICANT: { label: 'SIGNIFICANT', color: '#22c55e', icon: '✅' },
    PARTIAL: { label: 'PARTIAL', color: '#d97706', icon: '⚠️' },
};

export function BeforeAfterView({ report }: BeforeAfterViewProps) {
    const [sliderX, setSliderX] = useState(50); // 0–100 %
    const containerRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const beforeUrl = report.photo_before_url || report.photoURL;
    const afterUrl = report.photo_after_url || report.afterPhotoURL;

    const updateSlider = useCallback((clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
        setSliderX(pct);
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging.current) return;
        updateSlider(e.clientX);
    }, [updateSlider]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!dragging.current) return;
        updateSlider(e.touches[0].clientX);
    }, [updateSlider]);

    if (!beforeUrl && !afterUrl) {
        return (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: '12px' }}>
                📷 Photos not yet available
            </div>
        );
    }

    if (!afterUrl) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ borderRadius: '12px', overflow: 'hidden', aspectRatio: '4/3', position: 'relative' }}>
                    {beforeUrl
                        ? <img src={beforeUrl} alt="Before" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ background: 'var(--bg-subtle)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No photo</div>
                    }
                    <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                        BEFORE · {timeStr(report.createdAt)}
                    </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    ⏳ After photo not yet uploaded — pending officer resolution
                </div>
            </div>
        );
    }

    const aiLevel = report.ai_verification_level || report.aiImprovement;
    const aiConf = report.ai_verification_confidence || (report.aiConfidence ? Math.round((report.aiConfidence as number) * 100) : null);
    const aiCfg = aiLevel ? AI_LEVEL_CONFIG[aiLevel] : null;
    const resolveTime = timeDiff(report.createdAt, report.resolved_at || report.resolvedAt);
    const yesVotes = report.community_yes_votes || 0;
    const noVotes = report.community_no_votes || 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Slider */}
            <div
                ref={containerRef}
                style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', aspectRatio: '4/3', cursor: 'col-resize', userSelect: 'none' }}
                onMouseDown={() => { dragging.current = true; }}
                onMouseUp={() => { dragging.current = false; }}
                onMouseLeave={() => { dragging.current = false; }}
                onMouseMove={onMouseMove}
                onTouchStart={() => { dragging.current = true; }}
                onTouchEnd={() => { dragging.current = false; }}
                onTouchMove={onTouchMove}
            >
                {/* After (full) */}
                {afterUrl
                    ? <img src={afterUrl} alt="After" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ position: 'absolute', inset: 0, background: '#bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d', fontSize: '13px' }}>AFTER (Photo pending)</div>
                }

                {/* Before (clipped) */}
                <div style={{
                    position: 'absolute', inset: 0,
                    clipPath: `inset(0 ${100 - sliderX}% 0 0)`,
                }}>
                    {beforeUrl
                        ? <img src={beforeUrl} alt="Before" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ position: 'absolute', inset: 0, background: '#fef08a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#854d0e', fontSize: '13px' }}>BEFORE (No photo)</div>
                    }
                </div>

                {/* Labels */}
                <div style={{ position: 'absolute', top: '10px', left: '12px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.5px', pointerEvents: 'none' }}>
                    BEFORE · {timeStr(report.createdAt)}
                </div>
                <div style={{ position: 'absolute', top: '10px', right: '12px', background: 'rgba(22,163,74,0.8)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.5px', pointerEvents: 'none' }}>
                    AFTER · {timeStr(report.resolved_at || report.resolvedAt)}
                </div>

                {/* Drag handle */}
                <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `calc(${sliderX}% - 1px)`, width: '2px',
                    background: 'white', boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', color: '#374151', fontWeight: 700,
                    }}>
                        ◀▶
                    </div>
                </div>
            </div>

            {/* Info row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {/* AI Badge */}
                {aiCfg && (
                    <div style={{
                        flex: 1, minWidth: '160px',
                        background: `${aiCfg.color}14`,
                        border: `1px solid ${aiCfg.color}44`,
                        borderRadius: '10px', padding: '10px 12px',
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>AI VERIFICATION</div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: aiCfg.color }}>
                            {aiCfg.icon} {aiCfg.label}
                            {aiConf && <span style={{ fontSize: '12px', fontWeight: 500, marginLeft: '6px' }}>({aiConf}%)</span>}
                        </div>
                        {report.aiVerifyNote && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                                "{report.aiVerifyNote}"
                            </div>
                        )}
                    </div>
                )}

                {/* Time to resolve */}
                {resolveTime && (
                    <div style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '10px 12px', minWidth: '120px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>RESOLVED IN</div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>⏱ {resolveTime}</div>
                    </div>
                )}

                {/* Community votes */}
                {(yesVotes > 0 || noVotes > 0) && (
                    <div style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '10px 12px', minWidth: '120px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>COMMUNITY</div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>
                            <span style={{ color: '#16a34a' }}>👍 {yesVotes}</span>
                            {noVotes > 0 && <span style={{ color: '#dc2626', marginLeft: '8px' }}>👎 {noVotes}</span>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default BeforeAfterView;
