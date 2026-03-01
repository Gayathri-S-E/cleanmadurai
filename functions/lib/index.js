import 'dotenv/config';
import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import express from 'express';
import cors from 'cors';
import vision from '@google-cloud/vision';
admin.initializeApp();
const visionClient = new vision.ImageAnnotatorClient();
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;
function getSmtpConfig() {
    const fromEnv = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    const host = fromEnv ? process.env.SMTP_HOST : functions.config().smtp?.host;
    const port = fromEnv ? (process.env.SMTP_PORT || '587') : functions.config().smtp?.port || '587';
    const user = fromEnv ? process.env.SMTP_USER : functions.config().smtp?.user;
    const pass = fromEnv ? process.env.SMTP_PASS : functions.config().smtp?.pass;
    if (!host || !user || !pass) {
        throw new functions.https.HttpsError('failed-precondition', 'SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env (or Firebase config smtp.host, smtp.user, smtp.pass).');
    }
    return {
        host,
        port: parseInt(port, 10),
        user,
        pass,
    };
}
function getSmtpTransporter() {
    const config = getSmtpConfig();
    // Port 465 = SSL; port 587 = STARTTLS (secure: false)
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
        tls: { rejectUnauthorized: false },
    });
}
/** Shared logic: request OTP and send email. Returns { success: true } or throws. */
async function doRequestPasswordResetOtp(email) {
    let user = null;
    try {
        user = await admin.auth().getUserByEmail(email);
    }
    catch {
        return { success: true };
    }
    const otp = String(Math.floor(Math.pow(10, OTP_LENGTH - 1) + Math.random() * (9 * Math.pow(10, OTP_LENGTH - 1))));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const docId = email.replace(/[.@]/g, '_');
    await admin.firestore().collection('passwordResetOtps').doc(docId).set({
        email,
        uid: user.uid,
        otp,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    });
    try {
        const transporter = getSmtpTransporter();
        const { user: smtpUser } = getSmtpConfig();
        await transporter.sendMail({
            from: smtpUser || 'Clean Madurai <noreply@cleanmadurai.in>',
            to: email,
            subject: 'Clean Madurai – Password reset OTP',
            text: `Your one-time password for resetting your Clean Madurai account is: ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, please ignore this email.`,
            html: `<p>Your one-time password for resetting your Clean Madurai account is: <strong>${otp}</strong>.</p><p>It expires in ${OTP_EXPIRY_MINUTES} minutes.</p><p>If you did not request this, please ignore this email.</p>`,
        });
    }
    catch (e) {
        const errMsg = e?.message || String(e);
        console.error('SMTP send failed:', errMsg, e?.code);
        await admin.firestore().collection('passwordResetOtps').doc(docId).delete();
        if (errMsg.includes('Invalid login') || errMsg.includes('authentication') || e?.code === 'EAUTH') {
            throw new Error('SMTP login failed. Use an App Password for Gmail (see functions/README.md).');
        }
        if (errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED') || errMsg.includes('ETIMEDOUT')) {
            throw new Error('Cannot reach SMTP server. Check SMTP_HOST and SMTP_PORT.');
        }
        throw new Error('Failed to send email: ' + (errMsg.slice(0, 80) || 'Please try again.'));
    }
    return { success: true };
}
/** Shared logic: verify OTP and set new password. Returns { success: true } or throws. */
async function doVerifyOtpAndResetPassword(email, otp, newPassword) {
    const docId = email.replace(/[.@]/g, '_');
    const doc = await admin.firestore().collection('passwordResetOtps').doc(docId).get();
    if (!doc.exists) {
        throw new Error('Invalid or expired OTP. Please request a new one.');
    }
    const d = doc.data();
    const storedOtp = d.otp;
    const expiresAt = d.expiresAt;
    const uid = d.uid;
    if (storedOtp !== otp)
        throw new Error('Invalid OTP.');
    if (expiresAt.toDate() < new Date()) {
        await admin.firestore().collection('passwordResetOtps').doc(docId).delete();
        throw new Error('OTP has expired. Please request a new one.');
    }
    await admin.auth().updateUser(uid, { password: newPassword });
    await admin.firestore().collection('passwordResetOtps').doc(docId).delete();
    return { success: true };
}
/**
 * Forgot password: request OTP. Sends 6-digit OTP to the user's email via SMTP.
 * Does not reveal whether the email exists (always returns success).
 */
export const requestPasswordResetOtp = functions.https.onCall(async (data) => {
    const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }
    try {
        return await doRequestPasswordResetOtp(email);
    }
    catch (e) {
        if (e.code)
            throw e;
        throw new functions.https.HttpsError('internal', e.message || 'Failed to send OTP');
    }
});
/**
 * Verify OTP and set new password. Call after user receives OTP via email.
 */
export const verifyOtpAndResetPassword = functions.https.onCall(async (data) => {
    const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    const otp = typeof data?.otp === 'string' ? data.otp.trim() : '';
    const newPassword = typeof data?.newPassword === 'string' ? data.newPassword : '';
    if (!email || !otp || !newPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Email, OTP and new password are required');
    }
    if (newPassword.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
    }
    try {
        return await doVerifyOtpAndResetPassword(email, otp, newPassword);
    }
    catch (e) {
        if (e.code)
            throw e;
        throw new functions.https.HttpsError('invalid-argument', e.message || 'Invalid or expired OTP');
    }
});
/**
 * HTTP API for forgot-password with CORS (works from localhost and other origins).
 * POST /requestPasswordResetOtp  body: { email }
 * POST /verifyOtpAndResetPassword body: { email, otp, newPassword }
 */
const forgotPasswordApp = express();
// CORS: allow browser preflight and set headers on all responses
forgotPasswordApp.use((req, res, next) => {
    const origin = req.get('Origin') || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
});
forgotPasswordApp.use(cors({ origin: true }));
forgotPasswordApp.use(express.json());
forgotPasswordApp.post('/requestPasswordResetOtp', async (req, res) => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }
        const result = await doRequestPasswordResetOtp(email);
        res.json(result);
    }
    catch (e) {
        const msg = e?.message || 'Failed to send OTP';
        console.error('requestPasswordResetOtp error:', msg, e?.code);
        if (msg.includes('SMTP is not configured')) {
            res.status(503).json({ error: 'SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env or Firebase config.' });
            return;
        }
        res.status(500).json({ error: msg });
    }
});
forgotPasswordApp.post('/verifyOtpAndResetPassword', async (req, res) => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
        if (!email || !otp || !newPassword) {
            res.status(400).json({ error: 'Email, OTP and new password are required' });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }
        const result = await doVerifyOtpAndResetPassword(email, otp, newPassword);
        res.json(result);
    }
    catch (e) {
        console.error('verifyOtpAndResetPassword error:', e);
        res.status(400).json({ error: e.message || 'Invalid or expired OTP' });
    }
});
export const forgotPasswordApi = functions.https.onRequest(forgotPasswordApp);
/**
 * PR-6: Sync roles from Firestore users/{uid} to Firebase Auth custom claims.
 * Client calls this after login/profile load so request.auth.token.roles is set for Firestore rules (PR-8).
 */
export const refreshCustomClaims = functions.https.onCall(async (_, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = context.auth.uid;
    const doc = await admin.firestore().collection('users').doc(uid).get();
    if (!doc.exists) {
        await admin.auth().setCustomUserClaims(uid, { roles: [] });
        return { updated: true, roles: [] };
    }
    const roles = doc.data()?.roles ?? [];
    await admin.auth().setCustomUserClaims(uid, { roles });
    return { updated: true, roles };
});
/**
 * When an admin approves a role (roleRequests update), set custom claims for that user.
 * Trigger on roleRequests doc update: if status becomes 'approved', refresh that user's claims.
 */
export const onRoleRequestApproved = functions.firestore
    .document('roleRequests/{uid}')
    .onUpdate(async (change, context) => {
    const after = change.after.data();
    if (after?.status !== 'approved')
        return;
    const uid = context.params.uid;
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const roles = userDoc.data()?.roles ?? [];
    await admin.auth().setCustomUserClaims(uid, { roles });
});
/**
 * 5.3 Audit log: write when report status is updated (called from client or trigger).
 * Officers/admins should log status changes. Using Firestore trigger on reports for audit.
 */
// ─── Gemini Helper ────────────────────────────────────────────────────────────
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
function getGeminiKey() {
    const key = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key;
    if (!key)
        throw new Error('GEMINI_API_KEY not configured');
    return key;
}
async function callGemini(parts) {
    const key = getGeminiKey();
    const response = await fetch(`${GEMINI_API_BASE}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
    });
    const json = await response.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
// ─── 8.1 AI Waste Type Suggest ────────────────────────────────────────────────
/**
 * Process Report Image via Google Cloud Vision API
 * Performs SafeSearch, Label Detection, and Object Localization to determine waste ratios.
 */
export const processReportImage = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const imageBase64 = data.imageBase64;
    if (!imageBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'Image Base64 data is required');
    }
    try {
        const request = {
            image: { content: imageBase64 },
            features: [
                { type: 'SAFE_SEARCH_DETECTION' },
                { type: 'LABEL_DETECTION', maxResults: 15 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                { type: 'TEXT_DETECTION' },
                { type: 'LANDMARK_DETECTION', maxResults: 1 }
            ]
        };
        const [result] = await visionClient.annotateImage(request);
        // 1. Safe Search Check
        const safeSearch = result.safeSearchAnnotation;
        const isSafe = !(safeSearch?.adult === 'LIKELY' || safeSearch?.adult === 'VERY_LIKELY' ||
            safeSearch?.violence === 'LIKELY' || safeSearch?.violence === 'VERY_LIKELY' ||
            safeSearch?.racy === 'VERY_LIKELY');
        if (!isSafe) {
            return { isSafe: false, detectedType: 'others', landmarks: [], detectedText: '', ratios: null };
        }
        // 2. Extract Data
        const labels = result.labelAnnotations || [];
        const objects = result.localizedObjectAnnotations || [];
        const landmarks = (result.landmarkAnnotations || []).map(l => l.description || '').filter(Boolean);
        const detectedText = result.fullTextAnnotation?.text?.trim() || '';
        // 3. Compute material ratios based on labels and objects
        let glassScore = 0;
        let plasticScore = 0;
        let organicScore = 0;
        let otherScore = 0;
        const allTerms = [...labels.map(l => ({ name: l.description?.toLowerCase() || '', score: l.score || 0 })),
            ...objects.map(o => ({ name: o.name?.toLowerCase() || '', score: o.score || 0 }))];
        allTerms.forEach(term => {
            if (term.name.includes('glass') || term.name.includes('bottle')) {
                glassScore += term.score;
            }
            else if (term.name.includes('plastic') || term.name.includes('poly') || term.name.includes('bag') || term.name.includes('cup')) {
                plasticScore += term.score;
            }
            else if (term.name.includes('food') || term.name.includes('leaf') || term.name.includes('vegetable') || term.name.includes('fruit') || term.name.includes('plant') || term.name.includes('organic')) {
                organicScore += term.score;
            }
            else if (term.name.includes('waste') || term.name.includes('garbage') || term.name.includes('trash') || term.name.includes('rubbish')) {
                // Background waste, don't strongly bias
            }
            else {
                otherScore += (term.score * 0.5); // Weight other random things less
            }
        });
        // Add a base offset to prevent 0 division if nothing specific is found
        otherScore += 0.1;
        const totalScore = glassScore + plasticScore + organicScore + otherScore;
        const ratios = {
            glass: Math.round((glassScore / totalScore) * 100),
            plastic: Math.round((plasticScore / totalScore) * 100),
            organic: Math.round((organicScore / totalScore) * 100),
            other: Math.round((otherScore / totalScore) * 100),
        };
        // Determine dominant type for issueType mapping
        let detectedType = 'others';
        const strLabels = allTerms.map(t => t.name).join(' ');
        if (strLabels.includes('fire') || strLabels.includes('smoke') || strLabels.includes('burn')) {
            detectedType = 'burning';
        }
        else if (strLabels.includes('sewage') || strLabels.includes('drain') || strLabels.includes('water')) {
            detectedType = 'sewage';
        }
        else if (strLabels.includes('dog') || strLabels.includes('cat') || strLabels.includes('animal') || strLabels.includes('carcass')) {
            detectedType = 'dead_animal';
        }
        else if (ratios.plastic > 30) {
            detectedType = 'plastic';
        }
        return {
            isSafe: true,
            detectedType,
            landmarks,
            detectedText,
            ratios
        };
    }
    catch (error) {
        console.error('Vision API error:', error);
        throw new functions.https.HttpsError('internal', 'Image analysis failed.');
    }
});
// ─── 8.2 AI Waste Type Suggest ────────────────────────────────────────────────
/**
 * Real Gemini Vision waste classification.
 * Accepts { imageDataUrl: string } (base64 JPEG/PNG data URL).
 * Returns { suggestedType: IssueType }.
 */
export const suggestWasteType = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const VALID_TYPES = [
        'garbage_pile', 'plastic_waste', 'organic_waste', 'glass_on_road',
        'drainage', 'burning', 'toilet_issue', 'dead_animal', 'others',
    ];
    try {
        const { imageDataUrl } = data;
        if (!imageDataUrl)
            return { suggestedType: 'others' };
        const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const mimeType = imageDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        const raw = await callGemini([
            {
                text: `You are a waste classification assistant for Madurai city, India.
Look at this image and identify the primary waste type.
Reply with ONLY one of these exact values (no explanation, no punctuation):
garbage_pile, plastic_waste, organic_waste, glass_on_road,
drainage, burning, toilet_issue, dead_animal, others`,
            },
            { inlineData: { mimeType, data: base64 } },
        ]);
        const suggestedType = VALID_TYPES.includes(raw.trim().toLowerCase())
            ? raw.trim().toLowerCase()
            : 'others';
        return { suggestedType };
    }
    catch (err) {
        console.error('suggestWasteType error:', err);
        return { suggestedType: 'others' };
    }
});
// ─── 8.2 Voice NLP – processVoiceReport ──────────────────────────────────────
/**
 * Extract structured fields from a Tamil/English voice transcript using Gemini.
 * Accepts { transcript: string, lang: 'ta' | 'en' }.
 * Returns { landmark, waste_type, urgency, confidence }.
 */
export const processVoiceReport = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { transcript = '', lang = 'en' } = data;
    if (!transcript.trim()) {
        return { landmark: '', waste_type: 'others', urgency: 'normal', confidence: 0 };
    }
    const prompt = `You are a waste reporting assistant for Madurai city, India.
Extract information from this citizen voice report.
Transcript: "${transcript}"
Language: ${lang === 'ta' ? 'Tamil' : 'English'}

Reply ONLY with valid JSON (no markdown, no extra text):
{
  "landmark": "most specific location mentioned (street/area/landmark name in Madurai, or empty string)",
  "waste_type": "garbage_pile|plastic_waste|organic_waste|glass_on_road|drainage|burning|toilet_issue|dead_animal|others",
  "urgency": "normal|high|sos",
  "confidence": 0.0
}

Rules:
- urgency=sos if fire/burning/தீ/injury/accident mentioned
- urgency=high if glass+road mentioned or கண்ணாடி+சாலை
- Common Madurai landmarks: Meenakshi Amman Temple, Teppakulam, Anna Nagar, Goripalayam, Mattuthavani, Tallakulam, Vilangudi, Arapalayam, Palanganatham, Vaigai River
- Tamil keywords: குப்பை→garbage, பிளாஸ்டிக்→plastic, கண்ணாடி→glass(high), கழிவு→drainage, தீ→burning(sos)
- If location unclear return landmark as empty string
- confidence = 0.0 to 1.0 how sure you are about the extraction`;
    try {
        const text = await callGemini([{ text: prompt }]);
        const cleaned = text.replace(/```json|```/g, '').trim();
        try {
            return JSON.parse(cleaned);
        }
        catch {
            return { landmark: '', waste_type: 'others', urgency: 'normal', confidence: 0 };
        }
    }
    catch (err) {
        console.error('processVoiceReport error:', err);
        return { landmark: '', waste_type: 'others', urgency: 'normal', confidence: 0 };
    }
});
// ─── 8.3 onReportUpdated – audit log + before-after AI comparison ────────────
export const onReportUpdated = functions.firestore
    .document('reports/{reportId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // ── Existing: Audit log for status changes ──
    if (before?.status !== after?.status) {
        await admin.firestore().collection('auditLogs').add({
            type: 'report_status_change',
            reportId: context.params.reportId,
            fromStatus: before?.status,
            toStatus: after?.status,
            updatedBy: after?.statusHistory?.[after.statusHistory.length - 1]?.changedBy ?? 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    // ── NEW: Before-after AI comparison when afterPhotoURL is first set ──
    const afterPhotoJustSet = !before?.afterPhotoURL && !!after?.afterPhotoURL;
    const hasBeforePhoto = !!after?.photoURL;
    if (!afterPhotoJustSet || !hasBeforePhoto)
        return;
    try {
        // Fetch both images from Firebase Storage as base64
        const bucket = admin.storage().bucket();
        const fetchBase64 = async (url) => {
            // Extract the file path from the download URL
            const decodedUrl = decodeURIComponent(url);
            const pathMatch = decodedUrl.match(/\/o\/(.+?)(\?|$)/);
            if (!pathMatch)
                throw new Error(`Cannot parse Storage URL: ${url}`);
            const filePath = pathMatch[1];
            const [buffer] = await bucket.file(filePath).download();
            return buffer.toString('base64');
        };
        const [beforeB64, afterB64] = await Promise.all([
            fetchBase64(after.photoURL),
            fetchBase64(after.afterPhotoURL),
        ]);
        const prompt = `You are an automated cleanliness verification assistant for Madurai Municipal Corporation.
Analyse the BEFORE and AFTER photos of a reported waste site strictly and objectively.

Image 1 = BEFORE (waste reported by citizen).
Image 2 = AFTER (uploaded after cleaning).

Reply ONLY with valid JSON (no markdown):
{
  "is_cleaned": true,
  "confidence": 0.0,
  "improvement": "NONE|PARTIAL|SIGNIFICANT|COMPLETE",
  "note": "one sentence observation"
}

Rules:
- COMPLETE = waste fully removed, area visibly clean
- SIGNIFICANT = >70% waste removed
- PARTIAL = some improvement but waste still visible
- NONE = no visible change
- If photos appear to be completely different locations, set is_cleaned=false, note="Photos appear to be different locations"
- If image quality too poor to judge, set confidence < 0.4`;
        const text = await callGemini([
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: beforeB64 } },
            { inlineData: { mimeType: 'image/jpeg', data: afterB64 } },
        ]);
        let result = {};
        try {
            result = JSON.parse(text.replace(/```json|```/g, '').trim());
        }
        catch {
            result = { is_cleaned: false, confidence: 0, improvement: 'NONE', note: 'AI parse error' };
        }
        const autoVerify = !!result.is_cleaned &&
            (result.confidence ?? 0) >= 0.75 &&
            ['SIGNIFICANT', 'COMPLETE'].includes(result.improvement ?? '');
        await change.after.ref.update({
            aiVerified: autoVerify,
            aiVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            aiVerifyNote: result.note ?? '',
            aiConfidence: result.confidence ?? 0,
            aiImprovement: result.improvement ?? 'NONE',
            status: autoVerify ? 'verified' : after.status,
        });
        // Award +20 points to reporter on auto-verify
        if (autoVerify && after.reporterId) {
            await admin.firestore().doc(`users/${after.reporterId}`).update({
                points: admin.firestore.FieldValue.increment(20),
            });
            // Notify reporter
            await admin.firestore()
                .collection(`users/${after.reporterId}/notifications`)
                .add({
                title: '✅ Report Verified by AI!',
                body: 'Your waste report has been cleaned and verified. +20 bonus points awarded!',
                type: 'report_status',
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    catch (err) {
        console.error('Before-after AI comparison error:', err);
        // Fallback: mark for manual review
        await change.after.ref.update({
            aiVerified: false,
            aiImprovement: 'PENDING_MANUAL_REVIEW',
            aiVerifyNote: 'AI comparison failed – please review manually.',
        });
    }
});
// ─── 8.4 Daily Waste Surge Prediction ────────────────────────────────────────
const AREA_BASE_SCORES = {
    TEMPLE_ZONE: 60,
    MARKET: 55,
    BUS_STAND: 55,
    TASMAC_ADJACENT: 50,
    RIVERBANK: 45,
    COMMERCIAL: 40,
    HOSPITAL_ZONE: 35,
    RESIDENTIAL_DENSE: 30,
    RESIDENTIAL_LOW: 15,
};
function getRiskLevel(score) {
    if (score >= 70)
        return 'HIGH';
    if (score >= 40)
        return 'MEDIUM';
    return 'LOW';
}
function getSuggestedWorkers(risk) {
    if (risk === 'HIGH')
        return 3;
    if (risk === 'MEDIUM')
        return 1;
    return 0;
}
/**
 * Nightly Cloud Scheduler: calculates tomorrow's waste risk for every street.
 * Writes tomorrowRisk, riskScore, riskReasons, suggestedWorkers to each street doc.
 * Runs every night at 22:00 IST (16:30 UTC).
 */
export const dailyWastePrediction = functions.pubsub
    .schedule('30 16 * * *') // 22:00 IST = 16:30 UTC
    .timeZone('Asia/Kolkata')
    .onRun(async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const dayOfWeek = tomorrow.getDay(); // 0=Sun, 6=Sat
    const month = tomorrow.getMonth(); // 0-indexed
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isMonsoon = month >= 5 && month <= 8; // Jun–Sep
    // Check festival zones for tomorrow
    const zoneSnap = await admin.firestore().collection('specialZones').get();
    const festivalZoneIds = new Set();
    zoneSnap.docs.forEach(d => {
        const z = d.data();
        if (z.isActive && z.festivalDays?.includes(tomorrowStr)) {
            festivalZoneIds.add(d.id);
        }
    });
    const streetsSnap = await admin.firestore().collection('streets').get();
    if (streetsSnap.empty) {
        console.log('No streets collection found – skipping prediction.');
        return;
    }
    const batch = admin.firestore().batch();
    let count = 0;
    streetsSnap.docs.forEach(streetDoc => {
        const street = streetDoc.data();
        const areaType = street.areaType ?? 'RESIDENTIAL_LOW';
        let score = AREA_BASE_SCORES[areaType] ?? 20;
        const reasons = [areaType];
        if (isWeekend) {
            score += 20;
            reasons.push('WEEKEND');
        }
        if (isMonsoon) {
            score += 10;
            reasons.push('MONSOON_SEASON');
        }
        // Festival boost: check if street's ward has an active festival zone
        if (street.wardId && festivalZoneIds.size > 0) {
            score += 45;
            reasons.push('FESTIVAL_DAY');
        }
        // Historical boost: reports in last 7 days on same day-of-week
        const histKey = `avgReportsDay${dayOfWeek}`;
        const hist = street[histKey] ?? 0;
        score += Math.min(hist * 3, 20);
        if (hist > 2)
            reasons.push('HISTORICALLY_HIGH');
        const riskLevel = getRiskLevel(score);
        batch.update(streetDoc.ref, {
            tomorrowRisk: riskLevel,
            riskScore: score,
            riskReasons: reasons,
            suggestedWorkers: getSuggestedWorkers(riskLevel),
            riskUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            riskDate: tomorrowStr,
        });
        count++;
    });
    await batch.commit();
    console.log(`dailyWastePrediction: updated ${count} streets for ${tomorrowStr}`);
});
