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
const db = getFirestore(app);
const auth = getAuth(app);
await signInWithEmailAndPassword(auth, 'officer@demo.com', 'password123');

const testBin = {
    bin_id: 'BIN-MDU-1001', address: 'Meenakshi Temple North Gate, Madurai',
    ward_id: 'ward_42', type: 'mixed', size_litres: 240, color_code: 'gray', condition: 'good',
    overflow_count_today: 3, is_active: true,
    location: { lat: 9.9196, lng: 78.1194 },
    last_inspected_at: new Date(),
};

import { writeFileSync } from 'fs';
try {
    const ref = await addDoc(collection(db, 'bins'), testBin);
    console.log('SUCCESS:', ref.id);
} catch (e) {
    writeFileSync('error_out.txt', e.stack + '\n' + JSON.stringify(testBin, null, 2));
    console.log('FAILED, wrote to error_out.txt');
}
process.exit(0);
