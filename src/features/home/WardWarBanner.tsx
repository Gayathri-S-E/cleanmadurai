import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Swords } from 'lucide-react';

interface WardWarData {
    myWardName: string;
    myScore: number;
    rivalWardName: string;
    rivalScore: number;
    isWinning: boolean;
    gap: number;
}

// Seeded demo fallback
const DEMO_WARD_WAR: WardWarData = {
    myWardName: 'Ward 12 (KK Nagar)',
    myScore: 74,
    rivalWardName: 'Ward 18 (Anna Nagar)',
    rivalScore: 61,
    isWinning: true,
    gap: 13,
};

export function WardWarBanner() {
    const { profile } = useAuth();
    const [data, setData] = useState<WardWarData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                if (profile?.ward) {
                    const wardDoc = await getDoc(doc(db, 'wards', profile.ward));
                    if (wardDoc.exists()) {
                        const wardData = wardDoc.data();
                        const rivalId = wardData.rival_ward_id;
                        if (rivalId) {
                            const rivalDoc = await getDoc(doc(db, 'wards', rivalId));
                            if (rivalDoc.exists()) {
                                const myScore = wardData.cleanlinessScore || wardData.clean_score || 0;
                                const rivalScore = rivalDoc.data().cleanlinessScore || rivalDoc.data().clean_score || 0;
                                setData({
                                    myWardName: wardData.name || profile.ward,
                                    myScore,
                                    rivalWardName: rivalDoc.data().name || rivalId,
                                    rivalScore,
                                    isWinning: myScore >= rivalScore,
                                    gap: Math.abs(myScore - rivalScore),
                                });
                                return;
                            }
                        }
                    }
                }
                // Fallback: check if any wards have rivalry set
                const wardsSnap = await getDocs(collection(db, 'wards'));
                if (!wardsSnap.empty) {
                    const wards = wardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                    const wardWithRival = wards.find((w: any) => w.rival_ward_id);
                    if (wardWithRival) {
                        const rival = wards.find((w: any) => w.id === wardWithRival.rival_ward_id);
                        if (rival) {
                            const myScore = wardWithRival.cleanlinessScore || wardWithRival.clean_score || 0;
                            const rivalScore = rival.cleanlinessScore || rival.clean_score || 0;
                            setData({
                                myWardName: wardWithRival.name || wardWithRival.id,
                                myScore,
                                rivalWardName: rival.name || rival.id,
                                rivalScore,
                                isWinning: myScore >= rivalScore,
                                gap: Math.abs(myScore - rivalScore),
                            });
                            return;
                        }
                    }
                }
                // Use demo fallback
                setData(DEMO_WARD_WAR);
            } catch {
                setData(DEMO_WARD_WAR);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [profile?.ward]);

    if (loading || !data) return null;

    const { myWardName, myScore, rivalWardName, rivalScore, isWinning, gap } = data;

    return (
        <div style={{
            background: isWinning
                ? 'linear-gradient(135deg, #15803d, #16a34a)'
                : 'linear-gradient(135deg, #b91c1c, #dc2626)',
            borderRadius: '16px',
            padding: '16px 20px',
            color: 'white',
            boxShadow: isWinning
                ? '0 4px 20px rgba(22,163,74,0.35)'
                : '0 4px 20px rgba(220,38,38,0.35)',
        }}>
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', opacity: 0.85, fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px' }}>
                <Swords size={14} />
                WARD WAR — {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}
            </div>

            {/* Score display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.85, marginBottom: '2px' }}>
                        {myWardName.split(' ').slice(0, 2).join(' ')}
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1 }}>{myScore}</div>
                    {isWinning && <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9 }}>🏆 LEADING</div>}
                </div>

                <div style={{ textAlign: 'center', padding: '0 8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 900, opacity: 0.6 }}>VS</div>
                </div>

                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.85, marginBottom: '2px' }}>
                        {rivalWardName.split(' ').slice(0, 2).join(' ')}
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1 }}>{rivalScore}</div>
                    {!isWinning && <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9 }}>🏆 LEADING</div>}
                </div>
            </div>

            {/* Call to action */}
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', opacity: 0.9 }}>
                {isWinning
                    ? `✊ You are winning by ${gap} points! Keep it up!`
                    : `⚡ ${gap} points behind. Report now to catch up!`}
            </div>
        </div>
    );
}

export default WardWarBanner;
