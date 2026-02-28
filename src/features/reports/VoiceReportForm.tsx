/**
 * Voice Report Form – with Gemini NLP backend (processVoiceReport Cloud Function)
 * Records up to 30s audio, transcribes via Web Speech API,
 * then sends transcript to Gemini to extract: landmark, waste_type, urgency, confidence.
 * Geocodes extracted landmark via Nominatim OpenStreetMap API.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { IssueType } from '../../types';
import { Mic, Square, MapPin, Loader2, CheckCircle, X, Languages, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './ReportForm.module.css';

const MAX_RECORD_SEC = 30;

type LangCode = 'ta' | 'en';
type Urgency = 'normal' | 'high' | 'sos';

interface AIResult {
    landmark: string;
    waste_type: IssueType;
    urgency: Urgency;
    confidence: number;
}

// Nominatim geocode a landmark name in Madurai
async function geocodeLandmark(landmark: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
    if (!landmark) return null;
    try {
        const q = encodeURIComponent(`${landmark}, Madurai, Tamil Nadu, India`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'CleanMadurai/1.0' },
        });
        const data = await res.json();
        if (data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
    } catch {
        return null;
    }
}

const LANG_OPTIONS: { code: LangCode; label: string; speechLang: string }[] = [
    { code: 'ta', label: 'தமிழ்', speechLang: 'ta-IN' },
    { code: 'en', label: 'English', speechLang: 'en-IN' },
];

export default function VoiceReportForm() {
    const { user, profile, updateUserProfile } = useAuth();
    const navigate = useNavigate();
    const { position, address, loading: geoLoading, fetchLocation } = useGeolocation();

    // Recording state
    const [lang, setLang] = useState<LangCode>('ta');
    const [recording, setRecording] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(MAX_RECORD_SEC);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioURL, setAudioURL] = useState('');
    const [transcript, setTranscript] = useState('');

    // AI NLP state
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<AIResult | null>(null);
    const [geocodedLocation, setGeocodedLocation] = useState<{ lat: number; lng: number; displayName: string } | null>(null);

    // Form state
    const [suggestedType, setSuggestedType] = useState<IssueType>('others');
    const [locationNote, setLocationNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const speechRecRef = useRef<any>(null);
    const transcriptRef = useRef('');

    useEffect(() => { fetchLocation(); }, []);

    // Countdown timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (recording && secondsLeft > 0) {
            interval = setInterval(() => setSecondsLeft(s => s - 1), 1000);
        } else if (recording && secondsLeft === 0) {
            stopRecording();
        }
        return () => clearInterval(interval);
    }, [recording, secondsLeft]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            transcriptRef.current = '';

            recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioURL(URL.createObjectURL(blob));
                setTranscript(transcriptRef.current || '');
            };

            // Web Speech API for live transcription
            const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SRClass) {
                const rec = new SRClass();
                rec.continuous = true;
                rec.interimResults = true;
                rec.lang = LANG_OPTIONS.find(l => l.code === lang)?.speechLang ?? 'ta-IN';
                rec.onresult = (e: any) => {
                    let full = '';
                    for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
                    transcriptRef.current = full;
                };
                rec.start();
                speechRecRef.current = rec;
            }

            recorder.start();
            mediaRecorderRef.current = recorder;
            setRecording(true);
            setSecondsLeft(MAX_RECORD_SEC);
            setAiResult(null);
            setGeocodedLocation(null);
        } catch {
            toast.error('Microphone access denied or unavailable');
        }
    };

    const stopRecording = () => {
        if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch { } speechRecRef.current = null; }
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
        setRecording(false);
    };

    // Call Gemini NLP via Cloud Function
    const handleAIExtract = async () => {
        if (!transcript.trim()) { toast.error('No transcript to analyse. Record audio first.'); return; }
        setAiLoading(true);
        try {
            const fn = httpsCallable<{ transcript: string; lang: string }, AIResult>(functions, 'processVoiceReport');
            const result = await fn({ transcript, lang });
            const data = result.data;
            setAiResult(data);
            setSuggestedType(data.waste_type ?? 'others');

            // Geocode the extracted landmark
            if (data.landmark) {
                const geo = await geocodeLandmark(data.landmark);
                setGeocodedLocation(geo);
                if (geo) {
                    setLocationNote(data.landmark);
                    toast.success(`📍 Location found: ${data.landmark}`);
                } else {
                    toast(`⚠️ Landmark "${data.landmark}" not found on map – please use your GPS location.`);
                }
            }

            // Auto-flag glass SOS
            if (data.urgency === 'sos') toast('🚨 SOS flagged! Report marked high priority.', { icon: '🚨' });
        } catch (err: any) {
            toast.error('AI extraction failed: ' + (err.message || 'Try again'));
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async () => {
        const finalPosition = geocodedLocation
            ? { lat: geocodedLocation.lat, lng: geocodedLocation.lng }
            : position;

        if (!user || !finalPosition) {
            toast.error('Location required. Allow GPS or let AI find your landmark.');
            return;
        }
        if (!audioBlob) { toast.error('Please record audio first.'); return; }

        setSubmitting(true);
        try {
            const aRef = storageRef(storage, `reports/audio/${user.uid}/${Date.now()}.webm`);
            await uploadBytes(aRef, audioBlob);
            const audioURLStored = await getDownloadURL(aRef);

            const isGlassSOS = aiResult?.urgency === 'sos' || suggestedType === 'glass_on_road';

            await addDoc(collection(db, 'reports'), {
                reporterId: user.uid,
                reporterName: profile?.displayName ?? user.displayName,
                issueType: suggestedType,
                description: transcript || locationNote || 'Voice report',
                location: { lat: finalPosition.lat, lng: finalPosition.lng },
                address: (geocodedLocation?.displayName ?? locationNote) || (address ?? `${finalPosition.lat.toFixed(5)}, ${finalPosition.lng.toFixed(5)}`),
                ward: profile?.ward ?? '',
                status: 'open',
                priority: isGlassSOS ? 'sos' : aiResult?.urgency === 'high' ? 'high' : 'normal',
                isGlassSOS,
                isAnonymous: false,
                source: 'voice',
                audioURL: audioURLStored,
                transcript,
                landmark: aiResult?.landmark ?? '',
                aiConfidence: aiResult?.confidence ?? 0,
                locationKeywords: aiResult?.landmark ? [aiResult.landmark] : [],
                statusHistory: [{ status: 'open', changedBy: user.uid, changedByName: 'System', timestamp: new Date().toISOString() }],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            await updateUserProfile({ totalReports: (profile?.totalReports ?? 0) + 1, points: (profile?.points ?? 0) + 10 });
            toast.success('Voice report submitted! +10 points 🎉');
            setSubmitted(true);
        } catch (e: any) {
            toast.error('Failed to submit: ' + (e.message || 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className={styles.successPage}>
                <div className={styles.successIcon}><CheckCircle size={48} /></div>
                <h2 className={styles.successTitle}>Voice Report Submitted!</h2>
                <p className={styles.successDesc}>Thank you. You've earned <strong>+10 points</strong>!</p>
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/home')}>Go to Dashboard</button>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>🎙️ Voice Report</h1>
                <p className={styles.subtitle}>Speak in Tamil or English. AI will detect waste type & location.</p>
            </div>

            {/* Language Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {LANG_OPTIONS.map(l => (
                    <button
                        key={l.code}
                        type="button"
                        className={`btn btn-sm ${lang === l.code ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setLang(l.code)}
                        disabled={recording}
                    >
                        <Languages size={14} /> {l.label}
                    </button>
                ))}
            </div>

            {/* Record Button */}
            {!recording && !audioBlob && (
                <button type="button" className={styles.cameraBtn} onClick={startRecording} style={{ padding: '32px' }}>
                    <Mic size={48} />
                    <span>Tap to start recording</span>
                    <span className={styles.cameraHint}>Max {MAX_RECORD_SEC} seconds · {lang === 'ta' ? 'தமிழ்' : 'English'}</span>
                </button>
            )}

            {/* Recording in progress */}
            {recording && (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px', animation: 'pulse 1s infinite' }}>🔴</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: '28px', color: 'var(--color-danger)', marginBottom: '4px' }}>
                        {secondsLeft}s
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        {lang === 'ta' ? 'பேசுங்கள்...' : 'Speak now...'}
                    </div>
                    <button type="button" className="btn btn-danger" onClick={stopRecording}>
                        <Square size={18} /> Stop Recording
                    </button>
                </div>
            )}

            {/* After recording */}
            {audioBlob && !submitted && (
                <>
                    {audioURL && <audio src={audioURL} controls style={{ width: '100%', marginBottom: '16px', borderRadius: '8px' }} />}

                    <div className="form-group">
                        <label className="form-label">Transcript</label>
                        <textarea
                            className="textarea"
                            value={transcript}
                            onChange={e => setTranscript(e.target.value)}
                            rows={3}
                            placeholder={lang === 'ta' ? 'பேசிய வார்த்தைகள் இங்கே...' : 'Spoken words appear here...'}
                        />
                    </div>

                    {/* AI Extract Button */}
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAIExtract}
                        disabled={aiLoading || !transcript.trim()}
                        style={{ marginBottom: '16px', width: '100%' }}
                    >
                        {aiLoading
                            ? <><Loader2 size={16} className="animate-spin" /> Analysing with AI...</>
                            : <><Sparkles size={16} /> 🤖 Find Location & Type via AI</>
                        }
                    </button>

                    {/* AI Result Card */}
                    {aiResult && (
                        <div style={{
                            background: aiResult.urgency === 'sos'
                                ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.07)',
                            border: `1px solid ${aiResult.urgency === 'sos' ? 'var(--color-danger)' : 'var(--color-success)'}`,
                            borderRadius: 'var(--radius-xl)',
                            padding: '14px 16px',
                            marginBottom: '16px',
                        }}>
                            <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🤖 AI Extraction Result
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                    Confidence: {Math.round((aiResult.confidence ?? 0) * 100)}%
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                                <div><span style={{ color: 'var(--text-muted)' }}>📍 Landmark: </span><strong>{aiResult.landmark || 'Not detected'}</strong></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>🗑️ Type: </span><strong>{aiResult.waste_type?.replace(/_/g, ' ')}</strong></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>⚡ Urgency: </span>
                                    <strong style={{ color: aiResult.urgency === 'sos' ? '#EF4444' : aiResult.urgency === 'high' ? '#F59E0B' : '#10B981' }}>
                                        {aiResult.urgency?.toUpperCase()}
                                    </strong>
                                </div>
                                {geocodedLocation && (
                                    <div style={{ color: '#10B981' }}>✅ Location found on map</div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Waste Type</label>
                        <select className="select" value={suggestedType} onChange={e => setSuggestedType(e.target.value as IssueType)}>
                            {['glass_on_road', 'garbage_pile', 'plastic_waste', 'organic_waste', 'drainage', 'burning', 'toilet_issue', 'dead_animal', 'others'].map(t => (
                                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Location / Landmark</label>
                        <input
                            className="input"
                            value={locationNote}
                            onChange={e => setLocationNote(e.target.value)}
                            placeholder={address || 'e.g. Near Meenakshi Temple East Gate'}
                        />
                    </div>

                    {/* GPS / Geocoded location status */}
                    {geocodedLocation ? (
                        <div style={{ fontSize: '13px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                            <MapPin size={14} /> {geocodedLocation.displayName.slice(0, 80)}
                        </div>
                    ) : geoLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
                            <Loader2 size={14} className="animate-spin" /> Getting GPS...
                        </div>
                    ) : position && (
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                            <MapPin size={14} /> {address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => { setAudioBlob(null); setAudioURL(''); setTranscript(''); setAiResult(null); setGeocodedLocation(null); }}
                        >
                            <X size={16} /> Record again
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 1 }}>
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : null} Submit Report
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
