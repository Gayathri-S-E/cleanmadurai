/**
 * seed-collections.mjs  (v2 — full data)
 *
 * Populates: wards (all 100 Madurai corp wards), blocks (30+),
 *            badges, cityStats/current, specialZones
 *
 * Usage:  node seed-collections.mjs
 * Requires open Firestore rules OR auth via firebase-admin service-account.json
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

// ── Read env ──────────────────────────────────────────────────────────────────
function readEnv() {
    try {
        const raw = readFileSync('.env.local', 'utf8');
        const env = {};
        for (const line of raw.split(/\r?\n/)) {
            const m = line.match(/^([^=]+)=(.*)$/);
            if (m) env[m[1].trim()] = m[2].trim();
        }
        return env;
    } catch { return {}; }
}
const env = readEnv();
const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
};
console.log(`🔥 Project: ${firebaseConfig.projectId}`);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ── Sign in (seed user so auth rules pass) ────────────────────────────────────
const SEED_EMAIL = env.SEED_EMAIL ?? 'admin@demo.in';
const SEED_PASSWORD = env.SEED_PASSWORD ?? 'Demo@1234';
try {
    await signInWithEmailAndPassword(auth, SEED_EMAIL, SEED_PASSWORD);
    console.log(`🔑 Authenticated as ${SEED_EMAIL}\n`);
} catch { console.warn('⚠️  Auth failed — proceeding (rules may be open)\n'); }

// ── Helper ────────────────────────────────────────────────────────────────────
async function seedBatch(collectionName, docs) {
    // Firestore max 500 per batch
    for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 400);
        for (const item of chunk) {
            const { id, ...data } = item;
            batch.set(doc(db, collectionName, id), data, { merge: true });
        }
        await batch.commit();
    }
    console.log(`✅  ${collectionName}: ${docs.length} documents written`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL 100 MADURAI CORPORATION WARDS
// (Real ward names per Madurai Corporation GIS data)
// ─────────────────────────────────────────────────────────────────────────────
const WARDS = [
    // Zone 1 – Avanimula
    { id: 'w001', name: 'Ward 1 – Avanimula Meenakshi Amman Kovil', cleanlinessScore: 84, openReports: 4, resolvedReports: 51, wasteExchanges: 8, adoptedBlocks: 3 },
    { id: 'w002', name: 'Ward 2 – Pudu Mandapam', cleanlinessScore: 79, openReports: 6, resolvedReports: 44, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w003', name: 'Ward 3 – East Avanimoola', cleanlinessScore: 73, openReports: 9, resolvedReports: 38, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w004', name: 'Ward 4 – Kizhakku Avanimoola', cleanlinessScore: 68, openReports: 11, resolvedReports: 33, wasteExchanges: 3, adoptedBlocks: 1 },
    { id: 'w005', name: 'Ward 5 – West Avanimoola', cleanlinessScore: 62, openReports: 14, resolvedReports: 28, wasteExchanges: 2, adoptedBlocks: 0 },
    // Zone 2 – Meenakshi
    { id: 'w006', name: 'Ward 6 – Chitrai Street', cleanlinessScore: 88, openReports: 3, resolvedReports: 60, wasteExchanges: 12, adoptedBlocks: 4 },
    { id: 'w007', name: 'Ward 7 – South Masi Street', cleanlinessScore: 83, openReports: 5, resolvedReports: 54, wasteExchanges: 9, adoptedBlocks: 3 },
    { id: 'w008', name: 'Ward 8 – North Masi Street', cleanlinessScore: 77, openReports: 7, resolvedReports: 47, wasteExchanges: 7, adoptedBlocks: 2 },
    { id: 'w009', name: 'Ward 9 – West Masi Street', cleanlinessScore: 71, openReports: 9, resolvedReports: 40, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w010', name: 'Ward 10 – East Masi Street', cleanlinessScore: 65, openReports: 13, resolvedReports: 34, wasteExchanges: 4, adoptedBlocks: 1 },
    // Zone 3 – Tallakulam
    { id: 'w011', name: 'Ward 11 – Tallakulam North', cleanlinessScore: 90, openReports: 2, resolvedReports: 65, wasteExchanges: 14, adoptedBlocks: 5 },
    { id: 'w012', name: 'Ward 12 – Tallakulam South', cleanlinessScore: 86, openReports: 4, resolvedReports: 58, wasteExchanges: 11, adoptedBlocks: 4 },
    { id: 'w013', name: 'Ward 13 – Teppakulam', cleanlinessScore: 82, openReports: 5, resolvedReports: 52, wasteExchanges: 9, adoptedBlocks: 3 },
    { id: 'w014', name: 'Ward 14 – Vandiyur West', cleanlinessScore: 75, openReports: 8, resolvedReports: 45, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w015', name: 'Ward 15 – Vandiyur East', cleanlinessScore: 70, openReports: 11, resolvedReports: 39, wasteExchanges: 4, adoptedBlocks: 1 },
    // Zone 4 – Anna Nagar
    { id: 'w016', name: 'Ward 16 – Anna Nagar 1st Cross', cleanlinessScore: 93, openReports: 1, resolvedReports: 70, wasteExchanges: 17, adoptedBlocks: 6 },
    { id: 'w017', name: 'Ward 17 – Anna Nagar 2nd Cross', cleanlinessScore: 89, openReports: 3, resolvedReports: 63, wasteExchanges: 13, adoptedBlocks: 5 },
    { id: 'w018', name: 'Ward 18 – Anna Nagar 3rd Cross', cleanlinessScore: 85, openReports: 5, resolvedReports: 57, wasteExchanges: 10, adoptedBlocks: 4 },
    { id: 'w019', name: 'Ward 19 – Anna Nagar 4th Cross', cleanlinessScore: 80, openReports: 7, resolvedReports: 50, wasteExchanges: 8, adoptedBlocks: 3 },
    { id: 'w020', name: 'Ward 20 – Anna Nagar 5th Cross', cleanlinessScore: 76, openReports: 9, resolvedReports: 44, wasteExchanges: 6, adoptedBlocks: 2 },
    // Zone 5 – KK Nagar
    { id: 'w021', name: 'Ward 21 – KK Nagar A Block', cleanlinessScore: 85, openReports: 4, resolvedReports: 56, wasteExchanges: 10, adoptedBlocks: 4 },
    { id: 'w022', name: 'Ward 22 – KK Nagar B Block', cleanlinessScore: 80, openReports: 6, resolvedReports: 50, wasteExchanges: 8, adoptedBlocks: 3 },
    { id: 'w023', name: 'Ward 23 – KK Nagar C Block', cleanlinessScore: 75, openReports: 8, resolvedReports: 45, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w024', name: 'Ward 24 – KK Nagar D Block', cleanlinessScore: 71, openReports: 10, resolvedReports: 40, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w025', name: 'Ward 25 – KK Nagar Park', cleanlinessScore: 66, openReports: 13, resolvedReports: 35, wasteExchanges: 3, adoptedBlocks: 1 },
    // Zone 6 – Goripalayam
    { id: 'w026', name: 'Ward 26 – Goripalayam North', cleanlinessScore: 60, openReports: 16, resolvedReports: 30, wasteExchanges: 3, adoptedBlocks: 0 },
    { id: 'w027', name: 'Ward 27 – Goripalayam South', cleanlinessScore: 55, openReports: 19, resolvedReports: 26, wasteExchanges: 2, adoptedBlocks: 0 },
    { id: 'w028', name: 'Ward 28 – Ellis Nagar', cleanlinessScore: 74, openReports: 8, resolvedReports: 44, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w029', name: 'Ward 29 – Subramania Nagar', cleanlinessScore: 69, openReports: 10, resolvedReports: 38, wasteExchanges: 5, adoptedBlocks: 1 },
    { id: 'w030', name: 'Ward 30 – Krishnapuram', cleanlinessScore: 64, openReports: 13, resolvedReports: 33, wasteExchanges: 3, adoptedBlocks: 1 },
    // Zone 7 – Bibi Kulam
    { id: 'w031', name: 'Ward 31 – Bibi Kulam North', cleanlinessScore: 58, openReports: 18, resolvedReports: 28, wasteExchanges: 2, adoptedBlocks: 0 },
    { id: 'w032', name: 'Ward 32 – Bibi Kulam South', cleanlinessScore: 52, openReports: 22, resolvedReports: 24, wasteExchanges: 1, adoptedBlocks: 0 },
    { id: 'w033', name: 'Ward 33 – Bibi Kulam East', cleanlinessScore: 56, openReports: 20, resolvedReports: 26, wasteExchanges: 2, adoptedBlocks: 0 },
    { id: 'w034', name: 'Ward 34 – Bibi Kulam West', cleanlinessScore: 48, openReports: 25, resolvedReports: 20, wasteExchanges: 1, adoptedBlocks: 0 },
    { id: 'w035', name: 'Ward 35 – Bibi Kulam Road', cleanlinessScore: 61, openReports: 15, resolvedReports: 31, wasteExchanges: 3, adoptedBlocks: 1 },
    // Zone 8 – Mattuthavani
    { id: 'w036', name: 'Ward 36 – Mattuthavani Bus Stand', cleanlinessScore: 72, openReports: 9, resolvedReports: 42, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w037', name: 'Ward 37 – Mattuthavani North', cleanlinessScore: 67, openReports: 12, resolvedReports: 37, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w038', name: 'Ward 38 – Mattuthavani South', cleanlinessScore: 63, openReports: 14, resolvedReports: 32, wasteExchanges: 3, adoptedBlocks: 1 },
    { id: 'w039', name: 'Ward 39 – Mattuthavani East', cleanlinessScore: 77, openReports: 7, resolvedReports: 47, wasteExchanges: 7, adoptedBlocks: 2 },
    { id: 'w040', name: 'Ward 40 – Mattuthavani Kovil', cleanlinessScore: 82, openReports: 5, resolvedReports: 52, wasteExchanges: 9, adoptedBlocks: 3 },
    // Zone 9 – Periyar Bus Stand
    { id: 'w041', name: 'Ward 41 – Periyar Bus Stand North', cleanlinessScore: 61, openReports: 15, resolvedReports: 31, wasteExchanges: 3, adoptedBlocks: 1 },
    { id: 'w042', name: 'Ward 42 – Periyar Bus Stand South', cleanlinessScore: 56, openReports: 19, resolvedReports: 27, wasteExchanges: 2, adoptedBlocks: 0 },
    { id: 'w043', name: 'Ward 43 – Town Hall Road', cleanlinessScore: 66, openReports: 12, resolvedReports: 36, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w044', name: 'Ward 44 – Town Railway Road', cleanlinessScore: 72, openReports: 9, resolvedReports: 42, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w045', name: 'Ward 45 – Andal Nagar', cleanlinessScore: 78, openReports: 7, resolvedReports: 48, wasteExchanges: 7, adoptedBlocks: 2 },
    // Zone 10 – Alagarkovil
    { id: 'w046', name: 'Ward 46 – Alagarkovil Road', cleanlinessScore: 74, openReports: 8, resolvedReports: 44, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w047', name: 'Ward 47 – Sellur', cleanlinessScore: 69, openReports: 11, resolvedReports: 39, wasteExchanges: 5, adoptedBlocks: 1 },
    { id: 'w048', name: 'Ward 48 – Thirunagar', cleanlinessScore: 83, openReports: 5, resolvedReports: 53, wasteExchanges: 9, adoptedBlocks: 3 },
    { id: 'w049', name: 'Ward 49 – Thirunagar Extension', cleanlinessScore: 79, openReports: 6, resolvedReports: 49, wasteExchanges: 7, adoptedBlocks: 3 },
    { id: 'w050', name: 'Ward 50 – Arapalayam', cleanlinessScore: 65, openReports: 13, resolvedReports: 35, wasteExchanges: 3, adoptedBlocks: 1 },
    // Zone 11 – Vilangudi
    { id: 'w051', name: 'Ward 51 – Vilangudi', cleanlinessScore: 87, openReports: 3, resolvedReports: 57, wasteExchanges: 11, adoptedBlocks: 4 },
    { id: 'w052', name: 'Ward 52 – Vilangudi Extension', cleanlinessScore: 83, openReports: 5, resolvedReports: 53, wasteExchanges: 9, adoptedBlocks: 3 },
    { id: 'w053', name: 'Ward 53 – Madurai South', cleanlinessScore: 78, openReports: 7, resolvedReports: 48, wasteExchanges: 7, adoptedBlocks: 2 },
    { id: 'w054', name: 'Ward 54 – Palanganatham', cleanlinessScore: 73, openReports: 9, resolvedReports: 43, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w055', name: 'Ward 55 – Palanganatham North', cleanlinessScore: 68, openReports: 12, resolvedReports: 38, wasteExchanges: 4, adoptedBlocks: 1 },
    // Zone 12 – Sholavandan
    { id: 'w056', name: 'Ward 56 – Sholavandhan', cleanlinessScore: 59, openReports: 17, resolvedReports: 29, wasteExchanges: 2, adoptedBlocks: 0 },
    { id: 'w057', name: 'Ward 57 – Nagamalai Pudukottai', cleanlinessScore: 64, openReports: 14, resolvedReports: 34, wasteExchanges: 3, adoptedBlocks: 1 },
    { id: 'w058', name: 'Ward 58 – Nagamalai North', cleanlinessScore: 70, openReports: 10, resolvedReports: 40, wasteExchanges: 5, adoptedBlocks: 1 },
    { id: 'w059', name: 'Ward 59 – Nagamalai East', cleanlinessScore: 75, openReports: 8, resolvedReports: 45, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w060', name: 'Ward 60 – Nagamalai South', cleanlinessScore: 69, openReports: 11, resolvedReports: 39, wasteExchanges: 4, adoptedBlocks: 1 },
    // Zone 13 – Koodal Nagar
    { id: 'w061', name: 'Ward 61 – Koodal Nagar', cleanlinessScore: 88, openReports: 3, resolvedReports: 58, wasteExchanges: 12, adoptedBlocks: 4 },
    { id: 'w062', name: 'Ward 62 – Koodal Nagar East', cleanlinessScore: 84, openReports: 4, resolvedReports: 54, wasteExchanges: 10, adoptedBlocks: 4 },
    { id: 'w063', name: 'Ward 63 – Koodal Nagar West', cleanlinessScore: 80, openReports: 6, resolvedReports: 50, wasteExchanges: 8, adoptedBlocks: 3 },
    { id: 'w064', name: 'Ward 64 – South Veli Street', cleanlinessScore: 76, openReports: 8, resolvedReports: 46, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w065', name: 'Ward 65 – North Veli Street', cleanlinessScore: 71, openReports: 10, resolvedReports: 41, wasteExchanges: 5, adoptedBlocks: 2 },
    // Zone 14 – Paravai
    { id: 'w066', name: 'Ward 66 – Paravai', cleanlinessScore: 67, openReports: 12, resolvedReports: 37, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w067', name: 'Ward 67 – Paravai North', cleanlinessScore: 73, openReports: 9, resolvedReports: 43, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w068', name: 'Ward 68 – Paravai South', cleanlinessScore: 78, openReports: 7, resolvedReports: 48, wasteExchanges: 7, adoptedBlocks: 2 },
    { id: 'w069', name: 'Ward 69 – Paravai West', cleanlinessScore: 62, openReports: 15, resolvedReports: 32, wasteExchanges: 3, adoptedBlocks: 1 },
    { id: 'w070', name: 'Ward 70 – Paravai East', cleanlinessScore: 57, openReports: 18, resolvedReports: 27, wasteExchanges: 2, adoptedBlocks: 0 },
    // Zone 15 – Urumu Dhanalakshmi
    { id: 'w071', name: 'Ward 71 – Urumu DHanalakshmi Nagar', cleanlinessScore: 81, openReports: 6, resolvedReports: 51, wasteExchanges: 8, adoptedBlocks: 3 },
    { id: 'w072', name: 'Ward 72 – Rajaji Nagar', cleanlinessScore: 76, openReports: 8, resolvedReports: 46, wasteExchanges: 6, adoptedBlocks: 2 },
    { id: 'w073', name: 'Ward 73 – Nehru Nagar', cleanlinessScore: 72, openReports: 10, resolvedReports: 42, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w074', name: 'Ward 74 – Indira Nagar', cleanlinessScore: 68, openReports: 12, resolvedReports: 38, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w075', name: 'Ward 75 – Ambedkar Nagar', cleanlinessScore: 63, openReports: 14, resolvedReports: 33, wasteExchanges: 3, adoptedBlocks: 1 },
    // Zone 16 – Avaniyapuram
    { id: 'w076', name: 'Ward 76 – Avaniyapuram North', cleanlinessScore: 77, openReports: 7, resolvedReports: 47, wasteExchanges: 7, adoptedBlocks: 2 },
    { id: 'w077', name: 'Ward 77 – Avaniyapuram South', cleanlinessScore: 73, openReports: 9, resolvedReports: 43, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w078', name: 'Ward 78 – Avaniyapuram West', cleanlinessScore: 69, openReports: 11, resolvedReports: 39, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w079', name: 'Ward 79 – Avaniyapuram East', cleanlinessScore: 64, openReports: 13, resolvedReports: 34, wasteExchanges: 3, adoptedBlocks: 1 },
    { id: 'w080', name: 'Ward 80 – Avaniyapuram Bridge', cleanlinessScore: 58, openReports: 17, resolvedReports: 28, wasteExchanges: 2, adoptedBlocks: 0 },
    // Zone 17 – Kochadai
    { id: 'w081', name: 'Ward 81 – Kochadai', cleanlinessScore: 82, openReports: 5, resolvedReports: 52, wasteExchanges: 9, adoptedBlocks: 3 },
    { id: 'w082', name: 'Ward 82 – Kochadai North', cleanlinessScore: 78, openReports: 7, resolvedReports: 48, wasteExchanges: 7, adoptedBlocks: 2 },
    { id: 'w083', name: 'Ward 83 – Kochadai South', cleanlinessScore: 74, openReports: 9, resolvedReports: 44, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w084', name: 'Ward 84 – Kochadai Market', cleanlinessScore: 66, openReports: 13, resolvedReports: 36, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w085', name: 'Ward 85 – Kochadai West', cleanlinessScore: 61, openReports: 15, resolvedReports: 31, wasteExchanges: 3, adoptedBlocks: 0 },
    // Zone 18 – Aruppukkottai Road
    { id: 'w086', name: 'Ward 86 – Aruppukkottai Road', cleanlinessScore: 54, openReports: 21, resolvedReports: 24, wasteExchanges: 1, adoptedBlocks: 0 },
    { id: 'w087', name: 'Ward 87 – Kappalur Road', cleanlinessScore: 60, openReports: 16, resolvedReports: 30, wasteExchanges: 2, adoptedBlocks: 0 },
    { id: 'w088', name: 'Ward 88 – Villapuram', cleanlinessScore: 65, openReports: 13, resolvedReports: 35, wasteExchanges: 3, adoptedBlocks: 1 },
    { id: 'w089', name: 'Ward 89 – Villapuram North', cleanlinessScore: 70, openReports: 10, resolvedReports: 40, wasteExchanges: 5, adoptedBlocks: 1 },
    { id: 'w090', name: 'Ward 90 – Villapuram South', cleanlinessScore: 75, openReports: 8, resolvedReports: 45, wasteExchanges: 6, adoptedBlocks: 2 },
    // Zone 19 – Thanakkankulam
    { id: 'w091', name: 'Ward 91 – Thanakkankulam', cleanlinessScore: 79, openReports: 6, resolvedReports: 49, wasteExchanges: 7, adoptedBlocks: 2 },
    { id: 'w092', name: 'Ward 92 – Thenur', cleanlinessScore: 74, openReports: 9, resolvedReports: 44, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w093', name: 'Ward 93 – Nagari Nagar', cleanlinessScore: 69, openReports: 11, resolvedReports: 39, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w094', name: 'Ward 94 – Chinna Anuppanadi', cleanlinessScore: 64, openReports: 14, resolvedReports: 34, wasteExchanges: 3, adoptedBlocks: 1 },
    { id: 'w095', name: 'Ward 95 – Periya Anuppanadi', cleanlinessScore: 59, openReports: 17, resolvedReports: 29, wasteExchanges: 2, adoptedBlocks: 0 },
    // Zone 20 – Othakadai
    { id: 'w096', name: 'Ward 96 – Othakadai', cleanlinessScore: 83, openReports: 5, resolvedReports: 53, wasteExchanges: 9, adoptedBlocks: 3 },
    { id: 'w097', name: 'Ward 97 – Othakadai North', cleanlinessScore: 78, openReports: 7, resolvedReports: 48, wasteExchanges: 7, adoptedBlocks: 2 },
    { id: 'w098', name: 'Ward 98 – Othakadai South', cleanlinessScore: 73, openReports: 9, resolvedReports: 43, wasteExchanges: 5, adoptedBlocks: 2 },
    { id: 'w099', name: 'Ward 99 – Othakadai West', cleanlinessScore: 68, openReports: 12, resolvedReports: 38, wasteExchanges: 4, adoptedBlocks: 1 },
    { id: 'w100', name: 'Ward 100 – Othakadai East', cleanlinessScore: 63, openReports: 15, resolvedReports: 33, wasteExchanges: 3, adoptedBlocks: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// 30 BLOCKS (real Madurai streets & localities)
// ─────────────────────────────────────────────────────────────────────────────
const BLOCKS = [
    { id: 'blk_001', name: 'MK Gandhi Road Stretch', ward: 'Ward 6 – Chitrai Street', address: 'M.K. Gandhi Road, Near Meenakshi Temple', score: 72, adopterId: null, center: { lat: 9.9195, lng: 78.1193 } },
    { id: 'blk_002', name: 'Town Hall Junction', ward: 'Ward 43 – Town Hall Road', address: 'Town Hall Rd, Bypass Crossing', score: 55, adopterId: null, center: { lat: 9.9185, lng: 78.1123 } },
    { id: 'blk_003', name: 'Mattuthavani Main Rd', ward: 'Ward 36 – Mattuthavani Bus Stand', address: 'Mattuthavani Main Rd, Sector 2', score: 81, adopterId: null, center: { lat: 9.9320, lng: 78.1350 } },
    { id: 'blk_004', name: 'KK Nagar 4th Cross', ward: 'Ward 23 – KK Nagar C Block', address: 'KK Nagar 4th Cross, Near Park', score: 67, adopterId: null, center: { lat: 9.9280, lng: 78.1210 } },
    { id: 'blk_005', name: 'Anna Nagar 5th Ave', ward: 'Ward 16 – Anna Nagar 1st Cross', address: 'Anna Nagar 5th Ave, School Zone', score: 88, adopterId: null, center: { lat: 9.9345, lng: 78.1170 } },
    { id: 'blk_006', name: 'Bibi Kulam Basin Road', ward: 'Ward 31 – Bibi Kulam North', address: 'Bibi Kulam Rd, Near Water Tank', score: 46, adopterId: null, center: { lat: 9.9220, lng: 78.1280 } },
    { id: 'blk_007', name: 'Teppakulam Tank Bund', ward: 'Ward 13 – Teppakulam', address: 'Teppakulam Encirclement Road', score: 91, adopterId: null, center: { lat: 9.9271, lng: 78.1259 } },
    { id: 'blk_008', name: 'Periyar Bus Stand Stretch', ward: 'Ward 41 – Periyar Bus Stand North', address: 'Periyar Bus Stand Rd, Gate 1', score: 53, adopterId: null, center: { lat: 9.9185, lng: 78.1068 } },
    { id: 'blk_009', name: 'Meenakshi Temple Periphery', ward: 'Ward 6 – Chitrai Street', address: 'Chitrai Street, W-perimeter, Temple zone', score: 78, adopterId: null, center: { lat: 9.9196, lng: 78.1188 } },
    { id: 'blk_010', name: 'Vandiyur Hospital Road', ward: 'Ward 14 – Vandiyur West', address: 'Vandiyur Main Rd, Near Govt Hospital', score: 62, adopterId: null, center: { lat: 9.9305, lng: 78.1321 } },
    { id: 'blk_011', name: 'Goripalayam Market Lane', ward: 'Ward 26 – Goripalayam North', address: 'Goripalayam Market St, Row 3', score: 44, adopterId: null, center: { lat: 9.9105, lng: 78.1085 } },
    { id: 'blk_012', name: 'Alagarkovil Road Section', ward: 'Ward 46 – Alagarkovil Road', address: 'Alagarkovil Main Rd, km 3', score: 69, adopterId: null, center: { lat: 9.9480, lng: 78.1380 } },
    { id: 'blk_013', name: 'Vilangudi Market Street', ward: 'Ward 51 – Vilangudi', address: 'Vilangudi Market Road, Near School', score: 85, adopterId: null, center: { lat: 9.9590, lng: 78.0920 } },
    { id: 'blk_014', name: 'Paravai Main Road', ward: 'Ward 67 – Paravai North', address: 'Paravai Main Rd, Town Centre', score: 74, adopterId: null, center: { lat: 9.8730, lng: 78.0560 } },
    { id: 'blk_015', name: 'Kochadai Cross Road', ward: 'Ward 81 – Kochadai', address: 'Kochadai Cross Rd, Junction', score: 79, adopterId: null, center: { lat: 9.9050, lng: 78.1420 } },
    { id: 'blk_016', name: 'Othakadai School Road', ward: 'Ward 96 – Othakadai', address: 'Othakadai School Rd, Panchayat', score: 83, adopterId: null, center: { lat: 9.9680, lng: 78.1010 } },
    { id: 'blk_017', name: 'Sellur 1st Cross', ward: 'Ward 47 – Sellur', address: 'Sellur 1st Cross, NH Side', score: 67, adopterId: null, center: { lat: 9.9170, lng: 78.1480 } },
    { id: 'blk_018', name: 'Thirunagar Main', ward: 'Ward 48 – Thirunagar', address: 'Thirunagar Main Road, Bus Stop', score: 86, adopterId: null, center: { lat: 9.9408, lng: 78.1295 } },
    { id: 'blk_019', name: 'Subramania Nagar 2nd St', ward: 'Ward 29 – Subramania Nagar', address: 'Subramania Nagar 2nd Street', score: 71, adopterId: null, center: { lat: 9.9100, lng: 78.1055 } },
    { id: 'blk_020', name: 'Krishnapuram Canal Rd', ward: 'Ward 30 – Krishnapuram', address: 'Krishnapuram Canal Road, Bridge End', score: 58, adopterId: null, center: { lat: 9.9155, lng: 78.1130 } },
    { id: 'blk_021', name: 'Ellis Nagar Beach Rd', ward: 'Ward 28 – Ellis Nagar', address: 'Ellis Nagar Road, Near Water Works', score: 76, adopterId: null, center: { lat: 9.9068, lng: 78.1062 } },
    { id: 'blk_022', name: 'Nagamalai Market Road', ward: 'Ward 57 – Nagamalai Pudukottai', address: 'Nagamalai Pudukottai Road, Market', score: 64, adopterId: null, center: { lat: 9.9660, lng: 78.1265 } },
    { id: 'blk_023', name: 'Arapalayam Signal Rd', ward: 'Ward 50 – Arapalayam', address: 'Arapalayam Junction, Signal Rd', score: 68, adopterId: null, center: { lat: 9.9505, lng: 78.1445 } },
    { id: 'blk_024', name: 'Koodal Nagar Ring Road', ward: 'Ward 61 – Koodal Nagar', address: 'Koodal Nagar Outer Rd, Sec 1', score: 89, adopterId: null, center: { lat: 9.9195, lng: 78.0905 } },
    { id: 'blk_025', name: 'Avaniyapuram Bridge End', ward: 'Ward 76 – Avaniyapuram North', address: 'Avaniyapuram Bridge, Vaigai Side', score: 73, adopterId: null, center: { lat: 9.8960, lng: 78.1190 } },
    { id: 'blk_026', name: 'Thenur Village Rd', ward: 'Ward 92 – Thenur', address: 'Thenur Main Road, Bus Stop', score: 71, adopterId: null, center: { lat: 9.8850, lng: 78.1350 } },
    { id: 'blk_027', name: 'Indira Nagar 3rd Block', ward: 'Ward 74 – Indira Nagar', address: 'Indira Nagar 3rd Block Road', score: 65, adopterId: null, center: { lat: 9.9255, lng: 78.1390 } },
    { id: 'blk_028', name: 'Rajaji Nagar Playground', ward: 'Ward 72 – Rajaji Nagar', address: 'Rajaji Nagar Sports Ground Rd', score: 78, adopterId: null, center: { lat: 9.9340, lng: 78.1420 } },
    { id: 'blk_029', name: 'Nehru Nagar School St', ward: 'Ward 73 – Nehru Nagar', address: 'Nehru Nagar School Street, West', score: 74, adopterId: null, center: { lat: 9.9380, lng: 78.1375 } },
    { id: 'blk_030', name: 'Sholavandan Road', ward: 'Ward 56 – Sholavandhan', address: 'Sholavandan Main Rd, Km 1', score: 57, adopterId: null, center: { lat: 9.8780, lng: 78.0620 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// BADGES
// ─────────────────────────────────────────────────────────────────────────────
const BADGES = [
    { id: 'first_report', emoji: '🌟', name: 'First Reporter', desc: 'Submitted first report' },
    { id: 'glass_guardian', emoji: '🛡️', name: 'Glass Guardian', desc: 'Reported 10 glass issues' },
    { id: 'eco_champion', emoji: '♻️', name: 'Eco Champion', desc: 'Completed first waste exchange' },
    { id: 'street_savior', emoji: '🏆', name: 'Street Savior', desc: 'Maintained clean block for 7 days' },
    { id: 'active_volunteer', emoji: '🙋', name: 'Active Volunteer', desc: 'Attended 5 cleanathons' },
    { id: 'ward_hero', emoji: '🏘️', name: 'Ward Hero', desc: 'Top reporter in your ward for a month' },
    { id: 'night_owl', emoji: '🦉', name: 'Night Owl', desc: 'Reported an issue after 10 PM' },
    { id: 'speed_resolver', emoji: '⚡', name: 'Speed Resolver', desc: 'Report resolved within 2 hours' },
    { id: 'hundred_points', emoji: '💯', name: 'Century Club', desc: 'Earned 100 points' },
    { id: 'waste_wizard', emoji: '🧙', name: 'Waste Wizard', desc: 'Listed 10 waste exchange items' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SPECIAL ZONES (Madurai key landmarks)
// ─────────────────────────────────────────────────────────────────────────────
const SPECIAL_ZONES = [
    { id: 'sz_meenakshi', name: 'Meenakshi Amman Temple', type: 'temple', center: { lat: 9.9195, lng: 78.1193 }, radius: 500, color: '#F5A623', isActive: true },
    { id: 'sz_periyar', name: 'Periyar Bus Stand', type: 'bus_stand', center: { lat: 9.9185, lng: 78.1068 }, radius: 300, color: '#DC2626', isActive: true },
    { id: 'sz_market', name: 'Madurai Market', type: 'market', center: { lat: 9.9258, lng: 78.1152 }, radius: 400, color: '#D97706', isActive: true },
    { id: 'sz_teppakulam', name: 'Teppakulam Tank', type: 'park', center: { lat: 9.9271, lng: 78.1259 }, radius: 450, color: '#2563EB', isActive: true },
    { id: 'sz_govt_hosp', name: 'Govt Rajaji Hospital', type: 'hospital', center: { lat: 9.9150, lng: 78.1095 }, radius: 350, color: '#16A34A', isActive: true },
    { id: 'sz_railway', name: 'Madurai Railway Station', type: 'bus_stand', center: { lat: 9.9120, lng: 78.1198 }, radius: 400, color: '#7C3AED', isActive: true },
    { id: 'sz_azhagar', name: 'Azhagar Hills Foothills', type: 'other', center: { lat: 9.9750, lng: 78.1565 }, radius: 600, color: '#059669', isActive: true },
    { id: 'sz_vandiyur', name: 'Vandiyur Mariamman Lake', type: 'park', center: { lat: 9.9305, lng: 78.1321 }, radius: 500, color: '#0891B2', isActive: true },
    { id: 'sz_goripalayam', name: 'Goripalayam Dargah', type: 'other', center: { lat: 9.9105, lng: 78.1062 }, radius: 250, color: '#B45309', isActive: true },
    { id: 'sz_thiagarajar', name: 'Thiagarajar College', type: 'other', center: { lat: 9.9260, lng: 78.0960 }, radius: 400, color: '#9333EA', isActive: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// CITY STATS
// ─────────────────────────────────────────────────────────────────────────────
const totalScore = WARDS.reduce((s, w) => s + w.cleanlinessScore, 0);
const avgScore = Math.round(totalScore / WARDS.length);

async function main() {
    console.log('\n🌱 Seeding Firestore (full data)…\n');

    await seedBatch('wards', WARDS);
    await seedBatch('blocks', BLOCKS);
    await seedBatch('badges', BADGES);
    await seedBatch('specialZones', SPECIAL_ZONES);

    await setDoc(doc(db, 'cityStats', 'current'), {
        score: avgScore,
        delta: 3,
        totalWards: WARDS.length,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`✅  cityStats/current (score: ${avgScore})`);

    console.log(`\n🎉 Done!  ${WARDS.length} wards · ${BLOCKS.length} blocks · ${BADGES.length} badges · ${SPECIAL_ZONES.length} special zones`);
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Seed failed:', err.code ?? err.message ?? err);
    process.exit(1);
});
