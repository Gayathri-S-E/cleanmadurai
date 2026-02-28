import { useState } from 'react';
import ReportForm from './ReportForm';
import VoiceReportForm from './VoiceReportForm';
import { Camera, Mic } from 'lucide-react';

export default function ReportPage() {
    const [mode, setMode] = useState<'photo' | 'voice'>('photo');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{ display: 'flex', gap: '8px', padding: '0 16px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                <button
                    type="button"
                    className={`btn ${mode === 'photo' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setMode('photo')}
                    style={{ flex: 1 }}
                >
                    <Camera size={18} /> Photo
                </button>
                <button
                    type="button"
                    className={`btn ${mode === 'voice' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setMode('voice')}
                    style={{ flex: 1 }}
                >
                    <Mic size={18} /> Voice
                </button>
            </div>
            {mode === 'photo' ? <ReportForm /> : <VoiceReportForm />}
        </div>
    );
}
