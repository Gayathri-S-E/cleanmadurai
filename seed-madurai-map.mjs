/**
 * seed-madurai-map.mjs
 * Seeds real Madurai ward boundaries, streets, and special zones into Firestore.
 * Also seeds sample cleanliness data so the map shows dirty/clean/good zones.
 *
 * Run: node seed-madurai-map.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch {
    console.error('❌  serviceAccountKey.json not found in project root.');
    console.error('   Download it from Firebase Console → Project Settings → Service accounts → Generate new private key');
    process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Real Madurai Ward Data ───────────────────────────────────────────────────
// 100 wards in Madurai Municipal Corporation – key representative ones with GPS
const WARDS = [
    { id: 'w01', name: 'Meenakshi Amman Temple Zone', nameTA: 'மீனாட்சி அம்மன் கோவில் வலயம்', lat: 9.9195, lng: 78.1193, cleanScore: 62, openReports: 8, resolvedReports: 14 },
    { id: 'w02', name: 'Teppakulam', nameTA: 'தெப்பக்குளம்', lat: 9.9230, lng: 78.1270, cleanScore: 74, openReports: 4, resolvedReports: 18 },
    { id: 'w03', name: 'Anna Nagar', nameTA: 'அண்ணா நகர்', lat: 9.9397, lng: 78.1201, cleanScore: 81, openReports: 2, resolvedReports: 22 },
    { id: 'w04', name: 'Goripalayam', nameTA: 'கோரிபாளையம்', lat: 9.9060, lng: 78.1050, cleanScore: 45, openReports: 12, resolvedReports: 8 },
    { id: 'w05', name: 'Mattuthavani', nameTA: 'மாட்டுத்தாவணி', lat: 9.9501, lng: 78.1014, cleanScore: 38, openReports: 16, resolvedReports: 7 },
    { id: 'w06', name: 'Tallakulam', nameTA: 'தல்லாக்குளம்', lat: 9.9350, lng: 78.1310, cleanScore: 78, openReports: 3, resolvedReports: 19 },
    { id: 'w07', name: 'Vilangudi', nameTA: 'விளாங்குடி', lat: 9.9620, lng: 78.1480, cleanScore: 85, openReports: 1, resolvedReports: 25 },
    { id: 'w08', name: 'Arapalayam', nameTA: 'அரப்பாளையம்', lat: 9.9150, lng: 78.1420, cleanScore: 55, openReports: 9, resolvedReports: 11 },
    { id: 'w09', name: 'Palanganatham', nameTA: 'பழகணாதம்', lat: 9.8980, lng: 78.1200, cleanScore: 48, openReports: 11, resolvedReports: 10 },
    { id: 'w10', name: 'Narimedu', nameTA: 'நரிமேடு', lat: 9.9260, lng: 78.1350, cleanScore: 71, openReports: 5, resolvedReports: 16 },
    { id: 'w11', name: 'KK Nagar', nameTA: 'கே.கே நகர்', lat: 9.9440, lng: 78.1260, cleanScore: 77, openReports: 3, resolvedReports: 20 },
    { id: 'w12', name: 'Subramaniyapuram', nameTA: 'சுப்ரமணியபுரம்', lat: 9.9300, lng: 78.1150, cleanScore: 66, openReports: 6, resolvedReports: 15 },
    { id: 'w13', name: 'Simmakkal', nameTA: 'சிம்மக்கல்', lat: 9.9180, lng: 78.1230, cleanScore: 52, openReports: 10, resolvedReports: 9 },
    { id: 'w14', name: 'Bypass Road', nameTA: 'பைபாஸ் சாலை', lat: 9.9500, lng: 78.1600, cleanScore: 42, openReports: 14, resolvedReports: 6 },
    { id: 'w15', name: 'Vaigai River Bank', nameTA: 'வைகை ஆற்றங்கரை', lat: 9.9350, lng: 78.1000, cleanScore: 33, openReports: 18, resolvedReports: 5 },
    { id: 'w16', name: 'Tallakulam North', nameTA: 'தல்லாகுளம் வடக்கு', lat: 9.9380, lng: 78.1340, cleanScore: 79, openReports: 2, resolvedReports: 21 },
    { id: 'w17', name: 'Ellis Nagar', nameTA: 'எல்லிஸ் நகர்', lat: 9.9100, lng: 78.1300, cleanScore: 58, openReports: 8, resolvedReports: 13 },
    { id: 'w18', name: 'Rajaji Nagar', nameTA: 'ராஜாஜி நகர்', lat: 9.9280, lng: 78.0950, cleanScore: 69, openReports: 5, resolvedReports: 17 },
    { id: 'w19', name: 'Iyer Bungalow', nameTA: 'ஐயர் பங்களா', lat: 9.9420, lng: 78.1200, cleanScore: 82, openReports: 2, resolvedReports: 23 },
    { id: 'w20', name: 'Sellur', nameTA: 'செல்லூர்', lat: 9.8870, lng: 78.1180, cleanScore: 44, openReports: 13, resolvedReports: 7 },
];

// ─── Special Zones (Temples, Markets, Bus Stands) ─────────────────────────────
const SPECIAL_ZONES = [
    {
        id: 'sz_meenakshi',
        name: 'Meenakshi Amman Temple',
        nameTA: 'மீனாட்சி அம்மன் கோவில்',
        center: { lat: 9.9195, lng: 78.1193 },
        radius: 500,
        type: 'temple',
        color: '#F59E0B',
        isActive: true,
        festivalDays: ['2026-04-14', '2026-04-15', '2026-04-16'],
        riskLevel: 'HIGH',
    },
    {
        id: 'sz_teppakulam',
        name: 'Teppakulam',
        nameTA: 'தெப்பக்குளம்',
        center: { lat: 9.9230, lng: 78.1270 },
        radius: 350,
        type: 'market',
        color: '#8B5CF6',
        isActive: true,
        festivalDays: [],
        riskLevel: 'MEDIUM',
    },
    {
        id: 'sz_mattuthavani',
        name: 'Mattuthavani Bus Stand',
        nameTA: 'மாட்டுத்தாவணி பஸ் நிலையம்',
        center: { lat: 9.9501, lng: 78.1014 },
        radius: 400,
        type: 'bus_stand',
        color: '#EF4444',
        isActive: true,
        festivalDays: [],
        riskLevel: 'HIGH',
    },
    {
        id: 'sz_arapalayam',
        name: 'Arapalayam Bus Stand',
        nameTA: 'அரப்பாளையம் பஸ் நிலையம்',
        center: { lat: 9.9150, lng: 78.1420 },
        radius: 350,
        type: 'bus_stand',
        color: '#EF4444',
        isActive: true,
        festivalDays: [],
        riskLevel: 'MEDIUM',
    },
    {
        id: 'sz_vaigai',
        name: 'Vaigai River Bank',
        nameTA: 'வைகை ஆற்றங்கரை',
        center: { lat: 9.9350, lng: 78.1000 },
        radius: 600,
        type: 'park',
        color: '#0EA5E9',
        isActive: true,
        festivalDays: [],
        riskLevel: 'HIGH',
    },
    {
        id: 'sz_rajaji_hospital',
        name: 'Rajaji Government Hospital',
        nameTA: 'ராஜாஜி அரசு மருத்துவமனை',
        center: { lat: 9.9255, lng: 78.1240 },
        radius: 300,
        type: 'hospital',
        color: '#10B981',
        isActive: true,
        festivalDays: [],
        riskLevel: 'MEDIUM',
    },
    {
        id: 'sz_bypass_market',
        name: 'Bypass Road Market',
        nameTA: 'பைபாஸ் சாலை சந்தை',
        center: { lat: 9.9500, lng: 78.1600 },
        radius: 400,
        type: 'market',
        color: '#F59E0B',
        isActive: true,
        festivalDays: [],
        riskLevel: 'HIGH',
    },
];

// ─── Streets with real-world Madurai GPS + areaType ──────────────────────────
const STREETS = [
    { id: 'st01', name: 'East Avani Moola Street', wardId: 'w01', areaType: 'TEMPLE_ZONE', cleanScore: 55, lat: 9.9198, lng: 78.1210, openReportCount: 7 },
    { id: 'st02', name: 'West Avani Moola Street', wardId: 'w01', areaType: 'TEMPLE_ZONE', cleanScore: 60, lat: 9.9192, lng: 78.1172, openReportCount: 6 },
    { id: 'st03', name: 'North Avani Moola Street', wardId: 'w01', areaType: 'TEMPLE_ZONE', cleanScore: 58, lat: 9.9215, lng: 78.1188, openReportCount: 7 },
    { id: 'st04', name: 'South Avani Moola Street', wardId: 'w01', areaType: 'TEMPLE_ZONE', cleanScore: 52, lat: 9.9175, lng: 78.1195, openReportCount: 8 },
    { id: 'st05', name: 'Teppakulam Main Road', wardId: 'w02', areaType: 'MARKET', cleanScore: 72, lat: 9.9228, lng: 78.1265, openReportCount: 4 },
    { id: 'st06', name: 'Anna Nagar 2nd Street', wardId: 'w03', areaType: 'RESIDENTIAL_DENSE', cleanScore: 84, lat: 9.9400, lng: 78.1195, openReportCount: 1 },
    { id: 'st07', name: 'Goripalayam Main Road', wardId: 'w04', areaType: 'COMMERCIAL', cleanScore: 40, lat: 9.9055, lng: 78.1045, openReportCount: 13 },
    { id: 'st08', name: 'Mattuthavani Bus Stand Road', wardId: 'w05', areaType: 'BUS_STAND', cleanScore: 32, lat: 9.9498, lng: 78.1010, openReportCount: 18 },
    { id: 'st09', name: 'Vaigai Riverfront', wardId: 'w15', areaType: 'RIVERBANK', cleanScore: 28, lat: 9.9345, lng: 78.0995, openReportCount: 20 },
    { id: 'st10', name: 'KK Nagar 4th Street', wardId: 'w11', areaType: 'RESIDENTIAL_DENSE', cleanScore: 80, lat: 9.9438, lng: 78.1258, openReportCount: 2 },
    { id: 'st11', name: 'Bypass Road Shopping Area', wardId: 'w14', areaType: 'COMMERCIAL', cleanScore: 38, lat: 9.9495, lng: 78.1595, openReportCount: 15 },
    { id: 'st12', name: 'Iyer Bungalow Colony', wardId: 'w19', areaType: 'RESIDENTIAL_LOW', cleanScore: 88, lat: 9.9418, lng: 78.1198, openReportCount: 1 },
    { id: 'st13', name: 'Simmakkal Junction', wardId: 'w13', areaType: 'COMMERCIAL', cleanScore: 48, lat: 9.9175, lng: 78.1228, openReportCount: 11 },
    { id: 'st14', name: 'Arapalayam Cross Road', wardId: 'w08', areaType: 'BUS_STAND', cleanScore: 50, lat: 9.9148, lng: 78.1418, openReportCount: 10 },
    { id: 'st15', name: 'Vilangudi Colony Road', wardId: 'w07', areaType: 'RESIDENTIAL_LOW', cleanScore: 87, lat: 9.9618, lng: 78.1478, openReportCount: 1 },
];

// ─── Sample reports (spread across real coordinates) ─────────────────────────
const sampleReports = [
    { issueType: 'garbage_pile', lat: 9.9196, lng: 78.1208, ward: 'Meenakshi Amman Temple Zone', status: 'open', priority: 'high' },
    { issueType: 'plastic_waste', lat: 9.9190, lng: 78.1175, ward: 'Meenakshi Amman Temple Zone', status: 'open', priority: 'normal' },
    { issueType: 'glass_on_road', lat: 9.9200, lng: 78.1215, ward: 'Meenakshi Amman Temple Zone', status: 'open', priority: 'sos', isGlassSOS: true },
    { issueType: 'burning', lat: 9.9058, lng: 78.1048, ward: 'Goripalayam', status: 'open', priority: 'high' },
    { issueType: 'drainage', lat: 9.9055, lng: 78.1040, ward: 'Goripalayam', status: 'in_progress', priority: 'normal' },
    { issueType: 'garbage_pile', lat: 9.9502, lng: 78.1015, ward: 'Mattuthavani', status: 'open', priority: 'normal' },
    { issueType: 'plastic_waste', lat: 9.9498, lng: 78.1010, ward: 'Mattuthavani', status: 'open', priority: 'normal' },
    { issueType: 'plastic_waste', lat: 9.9495, lng: 78.1020, ward: 'Mattuthavani', status: 'open', priority: 'normal' },
    { issueType: 'garbage_pile', lat: 9.9348, lng: 78.0997, ward: 'Vaigai River Bank', status: 'open', priority: 'high' },
    { issueType: 'dead_animal', lat: 9.9352, lng: 78.1002, ward: 'Vaigai River Bank', status: 'open', priority: 'normal' },
    { issueType: 'garbage_pile', lat: 9.8875, lng: 78.1182, ward: 'Sellur', status: 'in_progress', priority: 'normal' },
    { issueType: 'drainage', lat: 9.8980, lng: 78.1200, ward: 'Palanganatham', status: 'open', priority: 'high' },
    // Resolved ones (green markers)
    { issueType: 'garbage_pile', lat: 9.9402, lng: 78.1200, ward: 'Anna Nagar', status: 'resolved', priority: 'normal' },
    { issueType: 'plastic_waste', lat: 9.9396, lng: 78.1198, ward: 'Anna Nagar', status: 'resolved', priority: 'normal' },
    { issueType: 'garbage_pile', lat: 9.9352, lng: 78.1313, ward: 'Tallakulam', status: 'resolved', priority: 'normal' },
    { issueType: 'drainage', lat: 9.9442, lng: 78.1262, ward: 'KK Nagar', status: 'resolved', priority: 'normal' },
    { issueType: 'garbage_pile', lat: 9.9622, lng: 78.1480, ward: 'Vilangudi', status: 'resolved', priority: 'normal' },
    { issueType: 'toilet_issue', lat: 9.9265, lng: 78.1355, ward: 'Narimedu', status: 'assigned', priority: 'normal' },
    { issueType: 'plastic_waste', lat: 9.9232, lng: 78.1270, ward: 'Teppakulam', status: 'assigned', priority: 'normal' },
    { issueType: 'organic_waste', lat: 9.9155, lng: 78.1422, ward: 'Arapalayam', status: 'in_progress', priority: 'normal' },
];

// ─── Seeder Functions ─────────────────────────────────────────────────────────

async function seedWards() {
    console.log('🏙️  Seeding wards...');
    const batch = db.batch();
    for (const ward of WARDS) {
        const ref = db.collection('wards').doc(ward.id);
        batch.set(ref, {
            name: ward.name,
            nameTA: ward.nameTA,
            center: { lat: ward.lat, lng: ward.lng },
            cleanlinessScore: ward.cleanScore,
            openReports: ward.openReports,
            resolvedReports: ward.resolvedReports,
            // Color classification
            riskLevel: ward.cleanScore >= 70 ? 'LOW' : ward.cleanScore >= 50 ? 'MEDIUM' : 'HIGH',
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    await batch.commit();
    console.log(`   ✅ ${WARDS.length} wards seeded`);
}

async function seedSpecialZones() {
    console.log('🏛️  Seeding special zones...');
    const batch = db.batch();
    for (const zone of SPECIAL_ZONES) {
        const { id, ...data } = zone;
        const ref = db.collection('specialZones').doc(id);
        batch.set(ref, { ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
    console.log(`   ✅ ${SPECIAL_ZONES.length} special zones seeded`);
}

async function seedStreets() {
    console.log('🛣️  Seeding streets...');
    const batch = db.batch();
    for (const street of STREETS) {
        const { id, ...data } = street;
        const ref = db.collection('streets').doc(id);
        batch.set(ref, {
            ...data,
            center: { lat: data.lat, lng: data.lng },
            tomorrowRisk: data.cleanScore < 40 ? 'HIGH' : data.cleanScore < 65 ? 'MEDIUM' : 'LOW',
            riskScore: 100 - data.cleanScore,
            riskReasons: [data.areaType],
            suggestedWorkers: data.cleanScore < 40 ? 3 : data.cleanScore < 65 ? 1 : 0,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    await batch.commit();
    console.log(`   ✅ ${STREETS.length} streets seeded`);
}

async function seedSampleReports() {
    console.log('📍  Seeding sample reports on map...');
    const existingSnap = await db.collection('reports').limit(5).get();
    if (!existingSnap.empty) {
        console.log('   ⏭  Reports already exist — skipping to avoid duplicates');
        return;
    }
    const batch = db.batch();
    for (const r of sampleReports) {
        const ref = db.collection('reports').doc();
        batch.set(ref, {
            reporterId: 'seeder_system',
            reporterName: 'System Seed',
            issueType: r.issueType,
            description: `Sample ${r.issueType.replace(/_/g, ' ')} report near ${r.ward}`,
            location: { lat: r.lat, lng: r.lng },
            address: `${r.ward}, Madurai`,
            ward: r.ward,
            status: r.status,
            priority: r.priority ?? 'normal',
            isGlassSOS: r.isGlassSOS ?? false,
            isAnonymous: false,
            photoURL: '',
            statusHistory: [{ status: r.status, changedBy: 'system', changedByName: 'System', timestamp: new Date().toISOString() }],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    console.log(`   ✅ ${sampleReports.length} sample reports seeded`);
}

async function main() {
    console.log('\n🌿 Clean Madurai – Madurai Map Data Seeder\n');
    try {
        await seedWards();
        await seedSpecialZones();
        await seedStreets();
        await seedSampleReports();
        console.log('\n✅  All map data seeded successfully!');
        console.log('   Open the app → Map page to see dirty/clean/good zones.\n');
    } catch (err) {
        console.error('❌  Seeding failed:', err);
        process.exit(1);
    }
    process.exit(0);
}

main();
