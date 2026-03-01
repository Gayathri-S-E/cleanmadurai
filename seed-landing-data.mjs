import { readFileSync } from 'fs';
import { resolve } from 'path';

const envContent = readFileSync(resolve('.env'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
}

const { initializeApp } = await import('firebase/app');
const { getFirestore, collection, addDoc } = await import('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');

const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
});

const auth = getAuth(app);
await signInWithEmailAndPassword(auth, 'sanitation@demo.in', 'Demo@1234');
console.log('Authenticated successfully');

const db = getFirestore(app);

async function seedData() {
    console.log("Seeding landing page data...");

    // Seed 3 waste listings
    const mockListings = [
        {
            status: 'open',
            createdAt: new Date(),
            wasteType: 'organic_veg',
            category: 'Vegetable Scraps',
            ward: 'Anna Nagar',
            listerName: 'Fresh Mart',
            quantity: '15 kg',
            pickupWindow: 'Today 5PM - 7PM'
        },
        {
            status: 'open',
            createdAt: new Date(Date.now() - 3600000), // 1 hour ago
            wasteType: 'dry_cardboard',
            category: 'Cardboard Boxes',
            ward: 'KK Nagar',
            listerName: 'Electronics Store',
            quantity: '30 boxes',
            pickupWindow: 'Tomorrow Morning'
        },
        {
            status: 'open',
            createdAt: new Date(Date.now() - 7200000), // 2 hours ago
            wasteType: 'organic_cooked',
            category: 'Leftover Food',
            ward: 'Tallakulam',
            listerName: 'Grand Hotel',
            quantity: '20 Meals',
            pickupWindow: 'Immediate Pickup'
        }
    ];

    for (const listing of mockListings) {
        await addDoc(collection(db, 'waste_listings'), listing);
    }
    console.log("Added 3 waste listings.");

    // Seed 3 incident reports
    const mockReports = [
        {
            createdAt: new Date(),
            category: 'waste_overflow',
            ward: 'Chitrai Street',
            locationDisplay: 'Near South Gate',
            status: 'Pending',
            description: 'The green bin is overflowing unto the street.'
        },
        {
            createdAt: new Date(Date.now() - 1800000), // 30 mins ago
            category: 'illegal_dumping',
            ward: 'Goripalayam',
            locationDisplay: 'Behind Dargah',
            status: 'Assigned',
            description: 'Large pile of construction debris dumped here.'
        },
        {
            createdAt: new Date(Date.now() - 5400000), // 1.5 hours ago
            category: 'dead_animal',
            ward: 'Vilangudi',
            locationDisplay: 'Main Road',
            status: 'Pending',
            description: 'Needs immediate clearing near the bus stop.'
        }
    ];

    for (const report of mockReports) {
        await addDoc(collection(db, 'reports'), report);
    }
    console.log("Added 3 incident reports.");

    process.exit(0);
}

seedData().catch(e => {
    console.error("Failed to seed:", e);
    process.exit(1);
});
