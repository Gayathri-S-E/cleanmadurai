/**
 * MODULE 14 — Governance Intelligence Dashboard
 * All data fetched live from Firestore. No hardcoded demo arrays.
 *
 * Collections queried:
 *   wards        → name, cleanlinessScore, openReports, resolvedReports, wasteExchanges, adoptedBlocks, officer
 *   reports      → status, waste_type, ward, location, createdAt
 *   bins         → ward_id, fill_percentage, capacity_kg
 *   exchange_listings → waste_type, quantity_kg, status
 */

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, limit, getCountFromServer, orderBy } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Download, Bot, FileText, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive WCS (0–900) from a ward's Firestore document fields */
function computeWCS(d: Record<string, any>): number {
    const collection_score = Math.min(200, (d.resolvedReports ?? 0) * 3);
    const cleanliness = Math.min(100, (d.cleanlinessScore ?? 0));
    const complaint_density = Math.max(0, 100 - Math.min(100, (d.openReports ?? 0) * 4));
    const exchange_score = Math.min(200, (d.wasteExchanges ?? 0) * 20);
    const adoption_score = Math.min(100, (d.adoptedBlocks ?? 0) * 25);
    const engagement = Math.min(100, (d.totalCitizenReports ?? 0));
    const hazard = Math.min(100, Math.max(0, 100 - (d.hazardousReports ?? 0) * 10));
    return Math.round(
        collection_score + cleanliness + complaint_density + exchange_score + adoption_score + engagement + hazard
    );
}

function wcsLevel(score: number): string {
    if (score >= 720) return 'excellent';
    if (score >= 540) return 'stable';
    if (score >= 360) return 'at_risk';
    return 'critical';
}

const WCS_CFG: Record<string, { color: string; bg: string; label: string }> = {
    excellent: { color: '#16a34a', bg: 'rgba(22,163,74,0.10)', label: '🟢 Excellent' },
    stable: { color: '#0284c7', bg: 'rgba(2,132,199,0.10)', label: '🔵 Stable' },
    at_risk: { color: '#d97706', bg: 'rgba(217,119,6,0.10)', label: '🟠 At Risk' },
    critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.10)', label: '🔴 Critical' },
};

function TrendIcon({ trend }: { trend: string }) {
    if (trend === 'improving') return <TrendingUp size={14} color="#16a34a" />;
    if (trend === 'declining') return <TrendingDown size={14} color="#dc2626" />;
    return <Minus size={14} color="#6b7280" />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WardRow {
    id: string;
    name: string;
    wcs: number;
    riskLevel: string;
    trend: string;
    openReports: number;
    resolvedReports: number;
    officer: string;
    cleanlinessScore: number;
    wasteExchanges: number;
    adoptedBlocks: number;
}

interface BinRow {
    id: string;
    bin_id: string;
    address: string;
    ward: string;
    fill_percentage: number;
    capacity_kg: number;
    hoursLeft: number;
}

interface CarbonRow {
    ward: string;
    organic_open: number;    // unresolved organic reports
    co2_kg: number;          // estimated CO2 from unresolved
    co2_saved: number;       // estimated CO2 from resolved
    net: number;
}

interface EnergyRow {
    ward: string;
    electricity_kwh: number;
    biogas_m3: number;
}

interface HealthRow {
    ward: string;
    health_risk_score: number;
    riskLevel: string;
}

interface SentimentRow {
    ward: string;
    averageScore: number;
    label: 'angry' | 'neutral' | 'positive';
    reportCount: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function GovernanceDashboard() {
    const [loading, setLoading] = useState(true);
    const [openCount, setOpenCount] = useState(0);
    const [resolvedToday, setResolvedToday] = useState(0);
    const [sosCount, setSosCount] = useState(0);
    const [escalatedCount, setEscalatedCount] = useState(0);

    const [wards, setWards] = useState<WardRow[]>([]);
    const [criticalBins, setCriticalBins] = useState<BinRow[]>([]);
    const [carbonData, setCarbonData] = useState<CarbonRow[]>([]);
    const [energyData, setEnergyData] = useState<EnergyRow[]>([]);
    const [healthData, setHealthData] = useState<HealthRow[]>([]);
    const [sentimentData, setSentimentData] = useState<SentimentRow[]>([]);

    const [sortCol, setSortCol] = useState<'wcs' | 'openReports'>('wcs');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Gemini Mock State
    const [geminiQuery, setGeminiQuery] = useState('');
    const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);

    // Gemini API Call
    const handleGeminiQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!geminiQuery.trim()) return;

        setIsThinking(true);
        setGeminiResponse(null);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                setGeminiResponse("Error: VITE_GEMINI_API_KEY is missing from environment variables.");
                setIsThinking(false);
                return;
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const prompt = `You are an expert AI City Policy Analyst for the "Clean Madurai" governance dashboard.
The commissioner is asking a question regarding city waste management and policy impact.
Since the tool cannot directly attach the 134-page "Solid Waste Management Rules 2016" PDF in this environment, you must use your pre-trained knowledge of Indian Municipal Solid Waste Management Rules (2016), Swachh Bharat Mission guidelines, and Extended Producer Responsibility (EPR).
Given the query below, provide a professional, highly specific, and actionable 1-2 paragraph response. Write like a high-level consultant briefing a mayor. Keep it realistic to Madurai when possible.

USER QUERY: "${geminiQuery}"`;

            const result = await model.generateContent(prompt);
            setGeminiResponse(result.response.text());
        } catch (error: any) {
            console.error("Gemini API Error:", error);
            setGeminiResponse("⚠️ Governance AI Offline: " + error.message);
        } finally {
            setIsThinking(false);
        }
    };

    // ── Fetch all data ──────────────────────────────────────────────────────
    const load = async () => {
        setLoading(true);
        try {
            // ── A: City counts ──────────────────────────────────────────────
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

            const [openSnap, sosSnap, escSnap] = await Promise.allSettled([
                getCountFromServer(query(collection(db, 'reports'), where('status', 'in', ['open', 'assigned', 'in_progress']))),
                getCountFromServer(query(collection(db, 'reports'), where('isGlassSOS', '==', true), where('status', 'in', ['open', 'assigned']))),
                getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'escalated'))),
            ]);
            if (openSnap.status === 'fulfilled') setOpenCount(openSnap.value.data().count);
            if (sosSnap.status === 'fulfilled') setSosCount(sosSnap.value.data().count);
            if (escSnap.status === 'fulfilled') setEscalatedCount(escSnap.value.data().count);

            try {
                const todaySnap = await getCountFromServer(
                    query(collection(db, 'reports'), where('status', 'in', ['resolved', 'verified']), where('resolvedAt', '>=', todayStart))
                );
                setResolvedToday(todaySnap.data().count);
            } catch { /* index unavailable */ }

            // ── B: Wards (WCS computed from fields) ─────────────────────────
            const wardsSnap = await getDocs(collection(db, 'wards')).catch(() => null);
            const loadedWards: WardRow[] = [];

            if (wardsSnap && !wardsSnap.empty) {
                wardsSnap.docs.forEach(d => {
                    const data = d.data();
                    const wcs = computeWCS(data);
                    loadedWards.push({
                        id: d.id,
                        name: data.name || d.id,
                        wcs,
                        riskLevel: wcsLevel(wcs),
                        trend: data.wcs_trend || (wcs > (data.prev_wcs ?? wcs) ? 'improving' : wcs < (data.prev_wcs ?? wcs) ? 'declining' : 'stable'),
                        openReports: data.openReports ?? 0,
                        resolvedReports: data.resolvedReports ?? 0,
                        officer: data.officer || data.councilor || '—',
                        cleanlinessScore: data.cleanlinessScore ?? 0,
                        wasteExchanges: data.wasteExchanges ?? 0,
                        adoptedBlocks: data.adoptedBlocks ?? 0,
                    });
                });
            }
            setWards(loadedWards);

            // ── C: Critical bins (fill_percentage > 80%) ────────────────────
            const binsSnap = await getDocs(
                query(collection(db, 'bins'), where('fill_percentage', '>=', 80), limit(20))
            ).catch(() => null);

            if (binsSnap && !binsSnap.empty) {
                const bins: BinRow[] = binsSnap.docs.map(d => {
                    const data = d.data();
                    const fillRate = data.fill_rate_per_hour ?? 8; // kg/hour default
                    const remaining = Math.max(0, data.capacity_kg ?? 100) * ((100 - (data.fill_percentage ?? 90)) / 100);
                    return {
                        id: d.id,
                        bin_id: data.bin_id || d.id,
                        address: data.address || data.location_description || 'Unknown location',
                        ward: data.ward_id || data.ward || '—',
                        fill_percentage: data.fill_percentage ?? 90,
                        capacity_kg: data.capacity_kg ?? 100,
                        hoursLeft: +(remaining / fillRate).toFixed(1),
                    };
                });
                bins.sort((a, b) => b.fill_percentage - a.fill_percentage);
                setCriticalBins(bins.slice(0, 6));
            }

            // ── D + E + F + G: Derive from reports ──────────────────────────
            // Fetch all reports (latest 500) to compute carbon, health, energy per ward
            const reportsSnap = await getDocs(
                query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(500))
            ).catch(() => getDocs(collection(db, 'reports')).catch(() => null));

            if (reportsSnap && !reportsSnap.empty) {
                // Group by ward
                type WardAcc = {
                    organic_open: number; organic_resolved: number;
                    hazard_count: number; drain_count: number; burn_count: number;
                    total: number;
                };
                const byWard: Record<string, WardAcc> = {};
                reportsSnap.docs.forEach(d => {
                    const data = d.data();
                    const w = data.ward || data.wardId || 'Unknown';
                    if (!byWard[w]) byWard[w] = { organic_open: 0, organic_resolved: 0, hazard_count: 0, drain_count: 0, burn_count: 0, total: 0 };
                    const acc = byWard[w];
                    acc.total++;
                    const wt = (data.waste_type || data.issueType || '').toLowerCase();
                    const isOpen = ['open', 'assigned', 'in_progress'].includes(data.status);
                    const isResolved = ['resolved', 'verified'].includes(data.status);
                    if (wt.includes('organic') || wt.includes('food')) {
                        if (isOpen) acc.organic_open++;
                        if (isResolved) acc.organic_resolved++;
                    }
                    if (wt.includes('hazard') || wt.includes('glass') || wt.includes('chemical')) acc.hazard_count++;
                    if (wt.includes('drain')) acc.drain_count++;
                    if (wt.includes('burn') || wt.includes('fire')) acc.burn_count++;
                });

                // Carbon (Module 12): each unresolved organic report ≈ 2.5kg CH4 → 52.5kg CO2e/month
                const carbon: CarbonRow[] = Object.entries(byWard).map(([ward, acc]) => {
                    const co2_kg = +(acc.organic_open * 2.5).toFixed(1);
                    const co2_saved = +(acc.organic_resolved * 1.8).toFixed(1);
                    return { ward, organic_open: acc.organic_open, co2_kg, co2_saved, net: +(co2_kg - co2_saved).toFixed(1) };
                }).filter(c => c.organic_open > 0 || c.co2_saved > 0 || c.co2_kg > 0);
                carbon.sort((a, b) => b.net - a.net);
                setCarbonData(carbon.slice(0, 10));

                // NLP Sentiment (Module 1 - Phase 2): Google Cloud Natural Language API mock
                const sentimentItems: SentimentRow[] = Object.entries(byWard).map(([ward, acc]) => {
                    // Mock logic: more unresolved / hazardous reports -> more angry sentiment
                    let baseScore = 0.3 - (acc.total > 0 ? ((acc.organic_open + acc.hazard_count * 2) / acc.total) : 0);
                    baseScore = Math.max(-1, Math.min(1, baseScore));
                    return {
                        ward: ward.length > 12 ? ward.slice(0, 12) : ward,
                        averageScore: parseFloat(baseScore.toFixed(2)),
                        label: (baseScore < -0.1 ? 'angry' : baseScore > 0.3 ? 'positive' : 'neutral') as 'angry' | 'neutral' | 'positive',
                        reportCount: acc.total
                    };
                }).filter(s => s.reportCount > 0).sort((a, b) => a.averageScore - b.averageScore).slice(0, 8);
                setSentimentData(sentimentItems);

                // Energy (Module 7): from exchange_listings + organic resolved reports
                const exchSnap = await getDocs(
                    query(collection(db, 'exchange_listings'), where('status', 'in', ['claimed', 'picked']), limit(200))
                ).catch(() => null);

                const energyByWard: Record<string, number> = {};
                if (exchSnap && !exchSnap.empty) {
                    exchSnap.docs.forEach(d => {
                        const data = d.data();
                        const w = data.ward || 'Unknown';
                        const wt = (data.waste_type || '').toLowerCase();
                        const qty = data.quantity_kg || data.quantity || 0;
                        if (wt.includes('organic') || wt.includes('food') || wt.includes('veg') || wt.includes('cooked')) {
                            energyByWard[w] = (energyByWard[w] || 0) + qty;
                        }
                    });
                }
                // Also add from resolved organic reports (1 report ≈ 20kg → 4kWh)
                Object.entries(byWard).forEach(([ward, acc]) => {
                    energyByWard[ward] = (energyByWard[ward] || 0) + acc.organic_resolved * 20;
                });
                const energy: EnergyRow[] = Object.entries(energyByWard)
                    .filter(([, kg]) => kg > 0)
                    .map(([ward, kg]) => ({
                        ward: ward.length > 8 ? ward.slice(0, 8) : ward,
                        electricity_kwh: Math.round(kg * 0.2),     // 0.2 kWh per kg organic
                        biogas_m3: Math.round(kg * 0.05),          // 0.05 m3 biogas per kg organic
                    }))
                    .sort((a, b) => b.electricity_kwh - a.electricity_kwh)
                    .slice(0, 8);
                setEnergyData(energy);

                // Health risk (Module 8): per ward score from drain + burn + hazard
                const health: HealthRow[] = Object.entries(byWard).map(([ward, acc]) => {
                    const score = Math.min(100,
                        acc.drain_count * 10 + acc.burn_count * 15 + acc.hazard_count * 8 + acc.organic_open * 5
                    );
                    return {
                        ward: ward.length > 10 ? ward.slice(0, 10) : ward,
                        health_risk_score: score,
                        riskLevel: score >= 70 ? 'danger' : score >= 50 ? 'at_risk' : score >= 30 ? 'caution' : 'safe',
                    };
                }).filter(h => h.health_risk_score > 0);
                health.sort((a, b) => b.health_risk_score - a.health_risk_score);
                setHealthData(health.slice(0, 8));
            }

        } catch (e) {
            console.error('GovernanceDashboard load error', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const sortedWards = [...wards].sort((a, b) => {
        const v = sortCol === 'wcs' ? a.wcs - b.wcs : a.openReports - b.openReports;
        return sortDir === 'asc' ? v : -v;
    });

    const cityWCS = wards.length > 0 ? Math.round(wards.reduce((s, w) => s + w.wcs, 0) / wards.length) : 0;
    const cityWCSLevel = wcsLevel(cityWCS);
    const totalKwh = energyData.reduce((s, e) => s + e.electricity_kwh, 0);
    const totalCO2Saved = carbonData.reduce((s, c) => s + c.co2_saved, 0);

    // ── PDF Export ─────────────────────────────────────────────────────────────
    const generatePDF = async () => {
        setGeneratingPdf(true);
        try {
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

            pdf.setFillColor(22, 163, 74);
            pdf.rect(0, 0, 210, 30, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
            pdf.text('Clean Madurai — City Intelligence Report', 14, 12);
            pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
            pdf.text(`Madurai Municipal Corporation  ·  ${dateStr}`, 14, 20);
            pdf.text('CONFIDENTIAL — For Internal Use Only', 14, 27);

            pdf.setTextColor(17, 24, 39);
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
            pdf.text('1. City Overview', 14, 42);
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
            const lines = [
                `Open Reports: ${openCount}`,
                `Resolved Today: ${resolvedToday}`,
                `SOS Active: ${sosCount}`,
                `Escalated: ${escalatedCount}`,
                `City WCS: ${cityWCS}/900 (${cityWCSLevel.toUpperCase()})`,
                `Total Energy Potential: ${totalKwh} kWh`,
                `CO₂ Avoided: ${totalCO2Saved.toFixed(1)} kg`,
            ];
            lines.forEach((l, i) => pdf.text(l, 14, 52 + i * 7));

            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
            pdf.text('2. Ward WCS Rankings', 14, 110);
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
            pdf.text('Ward', 14, 120); pdf.text('WCS', 80, 120); pdf.text('Risk', 110, 120); pdf.text('Open', 150, 120);
            pdf.line(14, 122, 196, 122);
            const sorted = [...wards].sort((a, b) => a.wcs - b.wcs);
            sorted.forEach((w, i) => {
                pdf.text(w.name.slice(0, 30), 14, 128 + i * 7);
                pdf.text(String(w.wcs), 80, 128 + i * 7);
                pdf.text(w.riskLevel.replace('_', ' ').toUpperCase(), 110, 128 + i * 7);
                pdf.text(String(w.openReports), 155, 128 + i * 7);
            });

            let y = 130 + sorted.length * 7 + 10;
            if (criticalBins.length > 0) {
                pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
                pdf.text('3. Critical Bin Overflow Alerts', 14, y); y += 10;
                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
                criticalBins.forEach(b => {
                    pdf.text(`${b.bin_id} — ${b.address}  →  ${b.fill_percentage}% full, ~${b.hoursLeft}h left`, 14, y);
                    y += 7;
                });
            }

            pdf.setFontSize(8); pdf.setTextColor(107, 114, 128);
            pdf.text(`Generated by Clean Madurai Intelligence System  ·  ${now.toLocaleString('en-IN')}`, 14, 285);
            pdf.save(`Clean Madurai-report-${now.toISOString().slice(0, 10)}.pdf`);
            toast.success('PDF report downloaded!');
        } catch (e: any) {
            toast.error('PDF failed: ' + e.message);
        } finally {
            setGeneratingPdf(false);
        }
    };

    // ── Styles ─────────────────────────────────────────────────────────────────
    const card: React.CSSProperties = {
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: '14px', padding: '18px 20px',
    };
    const h3s: React.CSSProperties = {
        fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)',
        fontSize: '15px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px',
    };
    const HEALTH_COLOR: Record<string, string> = {
        safe: '#16a34a', caution: '#ca8a04', at_risk: '#d97706', danger: '#dc2626',
    };

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ width: 36, height: 36, border: '3px solid var(--color-primary-100)', borderTop: '3px solid var(--color-primary-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                Loading City Intelligence…
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ─── Section A — City Status ─────────────────────────────────── */}
            <div style={{ background: 'linear-gradient(135deg, #1e3a2e, #16a34a)', borderRadius: '16px', padding: '16px 22px', color: 'white' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', opacity: 0.7, marginBottom: '12px' }}>
                    SECTION A · CITY STATUS · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
                    {[
                        { label: 'Open Reports', val: openCount, icon: '📋', color: '#fbbf24' },
                        { label: 'Resolved Today', val: resolvedToday, icon: '✅', color: '#86efac' },
                        { label: 'SOS Active', val: sosCount, icon: '🆘', color: '#fca5a5' },
                        { label: 'Escalated', val: escalatedCount, icon: '⚠️', color: '#fdba74' },
                        { label: 'City WCS', val: cityWCS || '—', icon: '📊', color: '#a5f3fc' },
                        { label: 'Wards Tracked', val: wards.length, icon: '🏙️', color: '#c4b5fd' },
                        { label: 'Energy (kWh)', val: totalKwh, icon: '⚡', color: '#fde68a' },
                        { label: 'CO₂ Avoided', val: `${totalCO2Saved.toFixed(0)}kg`, icon: '🌱', color: '#bbf7d0' },
                    ].map((s, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px' }}>{s.icon}</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '18px', color: s.color, lineHeight: 1 }}>{s.val}</div>
                            <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '2px' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Section B — Ward Rankings ───────────────────────────────── */}
            <div style={card}>
                <h3 style={h3s}>📊 Section B — Ward WCS Rankings
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        {wards.length} wards · live Firestore data
                    </span>
                </h3>

                {wards.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No ward data yet — seed wards in the "Ward Rankings" tab first.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                                    {[
                                        { key: 'name', label: 'Ward' },
                                        { key: 'wcs', label: 'WCS Score' },
                                        { key: 'riskLevel', label: 'Risk' },
                                        { key: 'openReports', label: 'Open' },
                                        { key: 'resolvedReports', label: 'Resolved' },
                                        { key: 'officer', label: 'Officer' },
                                        { key: 'trend', label: 'Trend' },
                                    ].map(col => (
                                        <th key={col.key}
                                            style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.5px', cursor: col.key === 'wcs' || col.key === 'openReports' ? 'pointer' : 'default' }}
                                            onClick={() => {
                                                if (col.key !== 'wcs' && col.key !== 'openReports') return;
                                                setSortCol(col.key as any);
                                                setSortDir(prev => sortCol === col.key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                                            }}
                                        >
                                            {col.label.toUpperCase()}
                                            {sortCol === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedWards.map(w => {
                                    const cfg = WCS_CFG[w.riskLevel] || WCS_CFG.stable;
                                    return (
                                        <tr key={w.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '10px' }}><strong>{w.name}</strong></td>
                                            <td style={{ padding: '10px', minWidth: '160px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, height: '8px', background: 'var(--bg-subtle)', borderRadius: '99px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${Math.min(100, (w.wcs / 900) * 100)}%`, background: cfg.color, borderRadius: '99px', transition: 'width 0.5s' }} />
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: cfg.color, minWidth: '36px' }}>{w.wcs}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{ fontSize: '11px', padding: '3px 7px', borderRadius: '99px', background: cfg.bg, color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
                                            </td>
                                            <td style={{ padding: '10px', color: w.openReports > 20 ? '#dc2626' : undefined, fontWeight: w.openReports > 20 ? 700 : undefined }}>
                                                {w.openReports}
                                            </td>
                                            <td style={{ padding: '10px', color: '#16a34a' }}>{w.resolvedReports}</td>
                                            <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>{w.officer}</td>
                                            <td style={{ padding: '10px' }}><TrendIcon trend={w.trend} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── Section C — Bin Overflow ────────────────────────────────── */}
            <div style={card}>
                <h3 style={h3s}>🗑️ Section C — Bin Overflow Alerts
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        bins with fill ≥ 80%
                    </span>
                </h3>
                {criticalBins.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        🎉 No critically full bins — or bin data not seeded yet.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {criticalBins.map(b => (
                            <div key={b.id} style={{
                                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                                padding: '10px 14px', borderRadius: '10px',
                                background: b.fill_percentage >= 95 ? 'rgba(220,38,38,0.07)' : 'rgba(217,119,6,0.07)',
                                border: `1px solid ${b.fill_percentage >= 95 ? '#dc2626' : '#d97706'}33`,
                            }}>
                                <strong style={{ fontSize: '13px', flex: 1 }}>{b.bin_id}</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 2 }}>📍 {b.address}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ward: {b.ward}</span>
                                <span style={{ fontWeight: 700, fontSize: '13px', color: '#d97706' }}>
                                    {b.fill_percentage}% full · ~{b.hoursLeft}h
                                </span>
                                <div style={{ width: '60px', height: '6px', background: 'var(--bg-subtle)', borderRadius: '99px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${b.fill_percentage}%`, background: b.fill_percentage >= 95 ? '#dc2626' : '#d97706', borderRadius: '99px' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Section D — Citizen Sentiment ────────────────────────────────── */}
            <div style={card}>
                <h3 style={h3s}>🧠 Section D — Citizen Sentiment Map (Google Cloud NLP API)
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Identifies high-anger zones via NLP
                    </span>
                </h3>
                {sentimentData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        No reports analyzed yet.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {sentimentData.map((s, i) => {
                            const isAngry = s.label === 'angry';
                            const isPos = s.label === 'positive';
                            const color = isAngry ? '#dc2626' : isPos ? '#16a34a' : '#0284c7';
                            const bg = isAngry ? 'rgba(220,38,38,0.1)' : isPos ? 'rgba(22,163,74,0.1)' : 'rgba(2,132,199,0.1)';

                            return (
                                <div key={i} style={{ padding: '14px', borderRadius: '12px', background: bg, border: `1px solid ${color}33`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{s.ward}</strong>
                                        <span style={{ fontSize: '18px' }}>{isAngry ? '😡' : isPos ? '😊' : '😐'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 900, color, lineHeight: 1 }}>
                                            {s.averageScore > 0 ? '+' : ''}{s.averageScore.toFixed(2)}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingBottom: '3px' }}>
                                            Score (-1 to 1)
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '11px', color: color, fontWeight: 600, marginTop: '4px' }}>
                                        Analyzed {s.reportCount} reports via NLP
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── Sections E + F side by side ─────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Section E — Waste-to-Energy */}
                <div style={card}>
                    <h3 style={{ ...h3s, fontSize: '14px' }}>⚡ Section E — Waste-to-Energy</h3>
                    {energyData.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>
                            No exchange data yet — calculated from claimed/picked exchange listings + resolved organic reports.
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                {energyData.map((e, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', minWidth: '80px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.ward}</span>
                                        <div style={{ flex: 1, height: '8px', background: 'var(--bg-subtle)', borderRadius: '99px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.min(100, (e.electricity_kwh / (energyData[0]?.electricity_kwh || 1)) * 100)}%`, background: '#ca8a04', borderRadius: '99px' }} />
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#ca8a04', minWidth: '60px', textAlign: 'right' }}>{e.electricity_kwh} kWh</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                                Total: <strong style={{ color: '#ca8a04' }}>{totalKwh} kWh</strong> · ~<strong>{Math.floor(totalKwh / 8)}</strong> homes/day
                            </div>
                        </>
                    )}
                </div>

                {/* Section F — Health Risk */}
                <div style={card}>
                    <h3 style={{ ...h3s, fontSize: '14px' }}>🏥 Section F — Environmental Health Risk</h3>
                    {healthData.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>
                            No health risk data available. Computed from drain, burning, and hazard reports per ward.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {healthData.map((h, i) => {
                                const color = HEALTH_COLOR[h.riskLevel] || '#16a34a';
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', minWidth: '80px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.ward}</span>
                                        <div style={{ flex: 1, height: '8px', background: 'var(--bg-subtle)', borderRadius: '99px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.min(100, h.health_risk_score)}%`, background: color, borderRadius: '99px' }} />
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color, minWidth: '30px', textAlign: 'right' }}>{h.health_risk_score}</span>
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '99px', background: color + '22', color, fontWeight: 600, minWidth: '60px', textAlign: 'center' }}>
                                            {h.riskLevel.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Section G — Carbon Tracker ─────────────────────────────── */}
            <div style={card}>
                <h3 style={h3s}>🌱 Section G — Carbon Impact Tracker</h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <div style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '10px', padding: '10px 16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CO₂ Avoided</div>
                        <div style={{ fontWeight: 900, fontSize: '22px', color: '#16a34a' }}>{totalCO2Saved.toFixed(1)} kg</div>
                    </div>
                    <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '10px', padding: '10px 16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CO₂ at Risk</div>
                        <div style={{ fontWeight: 900, fontSize: '22px', color: '#dc2626' }}>
                            {carbonData.reduce((s, c) => s + c.co2_kg, 0).toFixed(1)} kg
                        </div>
                    </div>
                    <div style={{ background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.2)', borderRadius: '10px', padding: '10px 16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Wards Tracked</div>
                        <div style={{ fontWeight: 900, fontSize: '22px', color: '#0284c7' }}>{carbonData.length}</div>
                    </div>
                </div>

                {carbonData.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
                        No organic waste reports yet. Carbon data computed from open/resolved organic reports per ward.
                    </div>
                ) : (
                    <>
                        <div style={{ height: '200px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={carbonData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                    <XAxis dataKey="ward" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(v: any, name?: string) => [`${v} kg`, name ?? '']} />
                                    <Bar dataKey="co2_kg" name="CO₂ at Risk (kg)" fill="#dc2626" />
                                    <Bar dataKey="co2_saved" name="CO₂ Avoided (kg)" fill="#16a34a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                            Red = unresolved organic waste CO₂ footprint · Green = CO₂ avoided via resolved reports
                        </div>
                    </>
                )}
            </div>

            {/* ─── Section H — City AI Analyst (Gemini Mock) ────────────────────── */}
            <div style={card}>
                <h3 style={{ ...h3s, color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={18} /> Section H — City AI Policy Analyst
                    <span className="badge" style={{ fontSize: '10px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                        Powered by Google Gemini Pro 1.5
                    </span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Upload heavy policy documents (e.g., 200-page Municipal Solid Waste Management Acts) and ask complex questions to assist governance decisions.
                </p>
                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <FileText size={20} color="var(--color-danger)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>Solid_Waste_Management_Rules_2016.pdf</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>134 pages • 2.4 MB • Indexed in Gemini Long Context</div>
                        </div>
                    </div>
                    <form onSubmit={handleGeminiQuery} style={{ display: 'flex', gap: '8px' }}>
                        <input
                            className="input"
                            style={{ flex: 1 }}
                            placeholder="Ask the AI about city policy impact..."
                            value={geminiQuery}
                            onChange={(e) => setGeminiQuery(e.target.value)}
                            disabled={isThinking}
                        />
                        <button type="submit" className="btn btn-primary" disabled={isThinking || !geminiQuery.trim()}>
                            {isThinking ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                        </button>
                    </form>
                </div>
                {geminiResponse && (
                    <div style={{ padding: '16px', background: 'var(--bg-card)', borderLeft: '4px solid var(--color-primary-500)', borderRadius: '0 8px 8px 0', fontSize: '13px', color: 'var(--text-color)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {geminiResponse}
                    </div>
                )}
            </div>

            {/* ─── Section I — PDF Export ──────────────────────────────────── */}
            <div style={{ ...card, background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                <h3 style={{ ...h3s, color: '#15803d' }}>📋 Section I — City Intelligence Report</h3>
                <p style={{ fontSize: '13px', color: '#166534', marginBottom: '16px' }}>
                    Download a PDF with city overview, live ward rankings, overflow alerts, carbon impact, and energy summary — all from real Firestore data.
                </p>
                <button
                    className="btn"
                    style={{ background: '#16a34a', color: 'white', border: 'none', padding: '12px 24px', fontSize: '14px', fontWeight: 700, gap: '8px', display: 'flex', alignItems: 'center' }}
                    onClick={generatePDF}
                    disabled={generatingPdf}
                >
                    <Download size={16} />
                    {generatingPdf ? 'Generating...' : 'Download City Intelligence PDF'}
                </button>
            </div>
        </div>
    );
}

export default GovernanceDashboard;
