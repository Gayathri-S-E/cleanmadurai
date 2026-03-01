// seed-bins.mjs
// Run with: node --env-file=.env seed-bins.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(app);
const auth = getAuth(app);

// Authenticate to bypass allow create/update rules restricted to officers
console.log('Authenticating...');
try {
    await signInWithEmailAndPassword(auth, 'admin@demo.in', 'Demo@1234');
    console.log('✅ Authenticated as admin@demo.in');
} catch (e) {
    console.error('❌ Authentication failed:', e.message);
    process.exit(1);
}

const BINS = [
    {
        bin_id: 'BIN-MDU-1001', address: 'Meenakshi Temple North Gate, Madurai',
        ward_id: 'ward_42', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'good',
        overflow_count_today: 3, is_active: true,
        location: { lat: 9.9196, lng: 78.1194 },
        last_inspected_at: new Date(Date.now() - 7 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1002', address: 'Madurai Junction, Railway Station Road',
        ward_id: 'ward_38', type: 'plastic', size_litres: 120, color_code: 'blue', condition: 'fair',
        overflow_count_today: 5, is_active: true,
        location: { lat: 9.9302, lng: 78.1221 },
        last_inspected_at: new Date(Date.now() - 10 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1003', address: 'Anna Nagar Market, Madurai',
        ward_id: 'ward_15', type: 'market', size_litres: 600, color_code: 'gray', condition: 'good',
        overflow_count_today: 8, is_active: true,
        location: { lat: 9.9350, lng: 78.1050 },
        last_inspected_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1004', address: 'Goripalayam Bus Stand, Madurai',
        ward_id: 'ward_5', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'good',
        overflow_count_today: 1, is_active: true,
        location: { lat: 9.9091, lng: 78.1195 },
        last_inspected_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1005', address: 'Koodal Azhagar Temple Street',
        ward_id: 'ward_22', type: 'organic', size_litres: 120, color_code: 'green', condition: 'good',
        overflow_count_today: 0, is_active: true,
        location: { lat: 9.9261, lng: 78.1108 },
        last_inspected_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1006', address: 'Arumuga Mangalam Road, Tallakulam',
        ward_id: 'ward_18', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'fair',
        overflow_count_today: 6, is_active: true,
        location: { lat: 9.9370, lng: 78.1290 },
        last_inspected_at: new Date(Date.now() - 14 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1007', address: 'KK Nagar Main Road, Madurai',
        ward_id: 'ward_31', type: 'plastic', size_litres: 120, color_code: 'blue', condition: 'good',
        overflow_count_today: 2, is_active: true,
        location: { lat: 9.9421, lng: 78.0987 },
        last_inspected_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1008', address: 'Mattuthavani Bus Stand, Madurai',
        ward_id: 'ward_44', type: 'market', size_litres: 600, color_code: 'gray', condition: 'good',
        overflow_count_today: 7, is_active: true,
        location: { lat: 9.9510, lng: 78.1350 },
        last_inspected_at: new Date(Date.now() - 13 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1009', address: 'Thiruparankundram Temple Road',
        ward_id: 'ward_7', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'good',
        overflow_count_today: 0, is_active: true,
        location: { lat: 9.8951, lng: 78.0904 },
        last_inspected_at: new Date(Date.now() - 0.5 * 3600000).toISOString(),
    },
    {
        bin_id: 'BIN-MDU-1010', address: 'Simmakal, Vaigai Bridge Area',
        ward_id: 'ward_36', type: 'organic', size_litres: 120, color_code: 'green', condition: 'good',
        overflow_count_today: 4, is_active: true,
        location: { lat: 9.9155, lng: 78.1285 },
        last_inspected_at: new Date(Date.now() - 9 * 3600000).toISOString(),
    },
];

console.log('🚀 Seeding 10 bins across Madurai into Firestore...\n');
let ok = 0;
for (const bin of BINS) {
    try {
        const ref = await addDoc(collection(db, 'bins'), bin);
        console.log(`✅ ${bin.bin_id}  —  ${bin.address}  (${ref.id})`);
        ok++;
    } catch (e) {
        console.error(`❌ ${bin.bin_id}:`, e.message);
    }
}
console.log(`\n🎉 Done! ${ok}/${BINS.length} bins added.`);
process.exit(0);
