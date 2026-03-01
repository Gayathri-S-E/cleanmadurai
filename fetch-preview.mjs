import { readFileSync } from 'fs';
import { resolve } from 'path';

const envContent = readFileSync(resolve('.env'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
}

const { initializeApp } = await import('firebase/app');
const { getFirestore, collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');

const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

async function runQueries() {
    console.log("Fetching Waste Listings...");
    try {
        const listingsQuery = query(
            collection(db, 'waste_listings'),
            limit(5)
        );
        const snap = await getDocs(listingsQuery);
        console.log(`Found ${snap.docs.length} listings.`, snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
        console.error("Error fetching listings:", e);
    }

    console.log("Fetching Reports...");
    try {
        const reportsQuery = query(
            collection(db, 'reports'),
            limit(5)
        );
        const snap = await getDocs(reportsQuery);
        console.log(`Found ${snap.docs.length} reports.`, snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
        console.error("Error fetching reports:", e);
    }

    await new Promise(r => setTimeout(r, 1000));
    process.exit(0);
}

runQueries();
