/**
 * Voice Report Form – with Gemini NLP backend (processVoiceReport Cloud Function)
 * Records up to 30s audio, optionally transcribes via Web Speech API (Chrome only),
 * then sends transcript to Gemini to extract: landmark, waste_type, urgency, confidence.
 * Geocodes extracted landmark via Nominatim OpenStreetMap API.
 *
 * FIX: Speech-to-text (SpeechRecognition) is treated as a bonus — if unavailable or
 * unreliable (common for ta-IN on non-Chrome), users simply type the transcript.
 * The AI Extract button is enabled whenever ANY text is present in the description field.
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
            headers: { 'Accept-Language': 'en', 'User-Agent': 'Clean Madurai/1.0' },
        });
        const data = await res.json();
        if (data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
    } catch {
        return null;
    }
}

const LANG_OPTIONS: { code: LangCode; label: string; speechLang: string; placeholder: string }[] = [
    { code: 'ta', label: 'தமிழ்', speechLang: 'ta-IN', placeholder: 'குப்பை எங்கே உள்ளது என்று இங்கே தட்டச்சு செய்யுங்கள் (எ.கா: மீனாட்சி கோவில் அருகே குப்பை குவியல் உள்ளது)' },
    { code: 'en', label: 'English', speechLang: 'en-IN', placeholder: 'Type what you observed (e.g. Garbage pile near Meenakshi Temple east gate, Madurai)' },
];

export default function VoiceReportForm() {
    const { user, profile, updateUserProfile } = useAuth();
    const navigate = useNavigate();
    const { position, address, loading: geoLoading, fetchLocation } = useGeolocation();

    // Language & recording
    const [lang, setLang] = useState<LangCode>('ta');
    const [recording, setRecording] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(MAX_RECORD_SEC);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioURL, setAudioURL] = useState('');

    // Description — always editable; SpeechRecognition fills it as a bonus
    const [description, setDescription] = useState('');
    const [speechStatus, setSpeechStatus] = useState<'idle' | 'active' | 'processing' | 'unsupported' | 'error'>('idle');

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
    const liveTranscriptRef = useRef('');
    const recordingActiveRef = useRef(false);

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

    /** Start Web Speech API recognition — treated as optional bonus */
    const startSpeechRecognition = (speechLang: string) => {
        const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SRClass) {
            setSpeechStatus('unsupported');
            return;
        }

        const rec = new SRClass();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = speechLang;
        liveTranscriptRef.current = '';

        rec.onresult = (e: any) => {
            let full = '';
            for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
            liveTranscriptRef.current = full;
            setDescription(full); // live update the text area
        };

        rec.onerror = (e: any) => {
            if (e.error === 'not-allowed') {
                setSpeechStatus('error');
            } else if (e.error === 'network') {
                // network errors for speech recognition are common on localhost — ignore silently
                console.warn('SpeechRecognition network error (common on localhost)');
            } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
                console.warn('SpeechRecognition error:', e.error);
            }
        };

        // Auto-restart so recognition continues after silence gaps
        rec.onend = () => {
            if (recordingActiveRef.current) {
                try { rec.start(); } catch { /* ignore restart when already stopping */ }
            }
        };

        try {
            rec.start();
            speechRecRef.current = rec;
            setSpeechStatus('active');
        } catch (err) {
            console.warn('SpeechRecognition start failed:', err);
            setSpeechStatus('unsupported');
        }
    };

    const startRecording = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast.error('🎙️ Voice recording requires a secure connection (HTTPS) or localhost. Please type your report instead.', { duration: 5000 });
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            liveTranscriptRef.current = '';
            recordingActiveRef.current = true;

            recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioURL(URL.createObjectURL(blob));

                // Call Cloud Speech API backend
                setSpeechStatus('processing');
                try {
                    const base64String = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onload = () => resolve((reader.result as string).split(',')[1]);
                        reader.onerror = error => reject(error);
                    });

                    const fn = httpsCallable<{ audioBase64: string, lang: string }, { transcript: string, modelUsed: string }>(functions, 'processAudioReport');
                    const result = await fn({ audioBase64: base64String, lang: lang });
                    const data = result.data;
                    if (data.transcript) {
                        setDescription(data.transcript);
                        liveTranscriptRef.current = data.transcript;
                        toast.success(`☁️ Google Cloud Speech (${data.modelUsed || 'Chirp'}): Audio transcribed!`);
                    } else if (liveTranscriptRef.current) {
                        setDescription(liveTranscriptRef.current); // Use Web API fallback
                    }
                } catch (err) {
                    console.error("Cloud Speech API error:", err);
                    if (liveTranscriptRef.current) {
                        setDescription(liveTranscriptRef.current);
                    }
                } finally {
                    setSpeechStatus('idle');
                }
            };

            const speechLang = LANG_OPTIONS.find(l => l.code === lang)?.speechLang ?? 'ta-IN';
            startSpeechRecognition(speechLang);

            recorder.start();
            mediaRecorderRef.current = recorder;
            setRecording(true);
            setSecondsLeft(MAX_RECORD_SEC);
            setAiResult(null);
            setGeocodedLocation(null);
        } catch (err: any) {
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                toast.error('Microphone access denied. Please allow microphone access in your browser settings and try again.');
            } else {
                toast.error('Could not start recording: ' + (err?.message || 'Unknown error'));
            }
        }
    };

    const stopRecording = () => {
        recordingActiveRef.current = false;
        if (speechRecRef.current) {
            try { speechRecRef.current.stop(); } catch { }
            speechRecRef.current = null;
        }
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
        setRecording(false);
        setSpeechStatus('idle');
    };

    const resetAll = () => {
        setAudioBlob(null);
        setAudioURL('');
        setDescription('');
        setAiResult(null);
        setGeocodedLocation(null);
        setSpeechStatus('idle');
    };

    // Call Gemini NLP via Cloud Function
    const handleAIExtract = async () => {
        const text = description.trim();
        if (!text) {
            toast.error('Please type or speak a description first.');
            return;
        }
        setAiLoading(true);
        try {
            const fn = httpsCallable<{ transcript: string; lang: string }, AIResult>(functions, 'processVoiceReport');
            const result = await fn({ transcript: text, lang });
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
                    toast(`⚠️ Landmark "${data.landmark}" not found on map – your GPS location will be used.`);
                }
            }

            if (data.urgency === 'sos') toast('🚨 SOS flagged! Report marked high priority.', { icon: '🚨' });
            if (!data.landmark) toast('ℹ️ No specific landmark detected. Please specify the location below.', { duration: 4000 });
        } catch (err: any) {
            const msg = err?.message || 'Unknown error';
            if (msg.includes('unauthenticated')) {
                toast.error('You must be logged in to use AI extraction.');
            } else if (msg.includes('GEMINI_API_KEY')) {
                toast.error('AI service is not configured (missing API key). Please contact support.');
            } else {
                toast.error('AI extraction failed: ' + msg.slice(0, 100));
            }
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
        if (!audioBlob && !description.trim()) {
            toast.error('Please record audio or type a description first.');
            return;
        }

        setSubmitting(true);
        try {
            let audioURLStored = '';
            if (audioBlob) {
                const aRef = storageRef(storage, `reports/audio/${user.uid}/${Date.now()}.webm`);
                await uploadBytes(aRef, audioBlob);
                audioURLStored = await getDownloadURL(aRef);
            }

            const isGlassSOS = aiResult?.urgency === 'sos' || suggestedType === 'glass_on_road';

            await addDoc(collection(db, 'reports'), {
                reporterId: user.uid,
                reporterName: profile?.displayName ?? user.displayName,
                issueType: suggestedType,
                description: description || locationNote || 'Voice report',
                location: { lat: finalPosition.lat, lng: finalPosition.lng },
                address: (geocodedLocation?.displayName ?? locationNote) || (address ?? `${finalPosition.lat.toFixed(5)}, ${finalPosition.lng.toFixed(5)}`),
                ward: profile?.ward ?? '',
                status: 'open',
                priority: isGlassSOS ? 'sos' : aiResult?.urgency === 'high' ? 'high' : 'normal',
                isGlassSOS,
                isAnonymous: false,
                source: 'voice',
                audioURL: audioURLStored,
                transcript: description,
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

    const langOption = LANG_OPTIONS.find(l => l.code === lang)!;

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

    const canExtractAI = description.trim().length > 0;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>🎙️ Voice Report</h1>
                <p className={styles.subtitle}>Powered by Google Cloud Speech-to-Text & Gemini. Speak in Tamil or English.</p>
            </div>

            {/* Language Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {LANG_OPTIONS.map(l => (
                    <button
                        key={l.code}
                        type="button"
                        className={`btn btn-sm ${lang === l.code ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setLang(l.code as LangCode)}
                        disabled={recording}
                    >
                        <Languages size={14} /> {l.label}
                    </button>
                ))}
            </div>

            {/* ── Description Box — ALWAYS visible & editable ── */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                    {lang === 'ta' ? '📝 உங்கள் புகாரை தட்டச்சு செய்யுங்கள் (அல்லது குரல் பதிவு செய்யுங்கள்)' : '📝 Describe the issue (or use voice recording below)'}
                </label>
                <textarea
                    className="textarea"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    placeholder={langOption.placeholder}
                    style={{ fontSize: '15px', lineHeight: '1.6' }}
                />
                {description.trim().length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--color-success)', marginTop: '4px' }}>
                        ✓ {description.trim().length} characters — ready for Gemini AI extraction
                    </div>
                )}
                {recording && speechStatus === 'active' && (
                    <div style={{ fontSize: '13px', color: '#3B82F6', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#3B82F6', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                        ☁️ Google Cloud Speech-to-Text (Chirp Model) listening...
                    </div>
                )}
                {recording && speechStatus === 'unsupported' && (
                    <div style={{ fontSize: '12px', color: '#F59E0B', marginTop: '4px' }}>
                        ⚠️ Cloud Speech-to-Text unavailable — type above while recording.
                    </div>
                )}
            </div>

            {/* AI Extract Button — enabled when description has text */}
            <button
                type="button"
                className="btn btn-primary"
                onClick={handleAIExtract}
                disabled={aiLoading || !canExtractAI}
                title={!canExtractAI ? 'Type a description first, then click to analyse' : ''}
                style={{ marginBottom: '16px', width: '100%', background: 'var(--color-primary-500)' }}
            >
                {aiLoading
                    ? <><Loader2 size={16} className="animate-spin" /> Analysing with Gemini 1.5 Pro...</>
                    : <><Sparkles size={16} /> ✨ Extract info with Gemini AI</>
                }
            </button>
            {!canExtractAI && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-12px', marginBottom: '16px' }}>
                    ↑ Type or speak your complaint above to enable Gemini analysis
                </div>
            )}

            {/* ── Record Button / Recording UI ── */}
            {!recording && !audioBlob && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        — Optional: Record voice for audio attachment —
                    </div>
                    <button type="button" className={styles.cameraBtn} onClick={startRecording} style={{ padding: '24px' }}>
                        <Mic size={36} />
                        <span>Tap to record voice</span>
                        <span className={styles.cameraHint}>Max {MAX_RECORD_SEC}s · {lang === 'ta' ? 'தமிழ்' : 'English'}</span>
                    </button>
                </div>
            )}

            {/* Recording in progress */}
            {recording && (
                <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(239,68,68,0.05)', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '6px', animation: 'pulse 1s infinite' }}>🔴</div>
                    <div style={{ fontWeight: 'var(--fw-bold)', fontSize: '26px', color: 'var(--color-danger)', marginBottom: '4px' }}>
                        {secondsLeft}s
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                        {lang === 'ta' ? 'பேசுங்கள்...' : 'Speak now...'}
                        {speechStatus === 'active' ? ' (transcribing live 🎤)' : ' (type above while speaking)'}
                    </div>
                    <button type="button" className="btn btn-danger" onClick={stopRecording}>
                        <Square size={16} /> Stop Recording
                    </button>
                </div>
            )}

            {/* Audio playback after recording */}
            {audioBlob && !recording && (
                <div style={{ marginBottom: '16px' }}>
                    {audioURL && <audio src={audioURL} controls style={{ width: '100%', borderRadius: '8px', marginBottom: '8px' }} />}
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={resetAll}
                        style={{ width: '100%' }}
                    >
                        <X size={14} /> Record again
                    </button>
                </div>
            )}

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

            {/* Waste Type Select */}
            <div className="form-group">
                <label className="form-label">Waste Type</label>
                <select className="select" value={suggestedType} onChange={e => setSuggestedType(e.target.value as IssueType)}>
                    {['glass_on_road', 'garbage_pile', 'plastic_waste', 'organic_waste', 'drainage', 'burning', 'toilet_issue', 'dead_animal', 'others'].map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                </select>
            </div>

            {/* Location / Landmark */}
            <div className="form-group">
                <label className="form-label">Location / Landmark</label>
                <input
                    className="input"
                    value={locationNote}
                    onChange={e => setLocationNote(e.target.value)}
                    placeholder={address || (lang === 'ta' ? 'எ.கா: மீனாட்சி கோவில் கிழக்கு வாசல்' : 'e.g. Near Meenakshi Temple East Gate')}
                />
            </div>

            {/* Location - Auto Detected / Extracted */}
            <div className={styles.locationCard} style={{ marginTop: '16px' }}>
                <div className={styles.locationHeader}>
                    <MapPin size={18} style={{ color: 'var(--color-primary-500)' }} />
                    <span className={styles.sectionLabel} style={{ margin: 0 }}>Location</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={fetchLocation} style={{ marginLeft: 'auto' }}>
                        Refresh
                    </button>
                </div>
                {geocodedLocation ? (
                    <div className={styles.locationText} style={{ color: '#10B981', fontWeight: 500 }}>
                        ✅ {geocodedLocation.displayName}
                    </div>
                ) : geoLoading ? (
                    <div className={styles.locationLoading}>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Getting your location...</span>
                    </div>
                ) : position ? (
                    <div className={styles.locationText}>
                        📍 {address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
                    </div>
                ) : (
                    <div className={styles.locationError}>
                        ⚠️ Location not available. Please allow location permission.
                    </div>
                )}
            </div>

            {/* Submit */}
            <div style={{ marginTop: '20px' }}>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting || (!description.trim() && !audioBlob)}
                    style={{ width: '100%' }}
                >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : null} Submit Report
                </button>
            </div>
        </div>
    );
}
