import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { readFileSync } from 'fs';

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
const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);
const auth = getAuth(app);

const USERS = [
    { email: 'superadmin@maduraicorp.gov.in', pass: 'password123', name: 'Super Admin', roles: ['super_admin', 'corp_admin', 'citizen'], ward: 'Ward 1 \u2013 Avanimula Meenakshi Amman Kovil' },
    { email: 'admin@maduraicorp.gov.in', pass: 'password123', name: 'Corp Admin', roles: ['corp_admin', 'citizen'], ward: 'Ward 1 \u2013 Avanimula Meenakshi Amman Kovil' },
    { email: 'zonal@maduraicorp.gov.in', pass: 'password123', name: 'Zonal Officer', roles: ['zonal_officer', 'citizen'], ward: 'Ward 1 \u2013 Avanimula Meenakshi Amman Kovil' },
    { email: 'ward@maduraicorp.gov.in', pass: 'password123', name: 'Ward Officer', roles: ['ward_officer', 'citizen'], ward: 'Ward 1 \u2013 Avanimula Meenakshi Amman Kovil' },
    { email: 'worker@maduraicorp.gov.in', pass: 'password123', name: 'Sanitation Worker', roles: ['sanitation_worker', 'citizen'], ward: 'Ward 1 \u2013 Avanimula Meenakshi Amman Kovil' },
    { email: 'citizen@maduraicorp.gov.in', pass: 'password123', name: 'Citizen User', roles: ['citizen'], ward: 'Ward 1 \u2013 Avanimula Meenakshi Amman Kovil' },
];

async function main() {
    for (const u of USERS) {
        let user;
        try {
            const cred = await createUserWithEmailAndPassword(auth, u.email, u.pass);
            user = cred.user;
            await updateProfile(user, { displayName: u.name });
            console.log(`Created new auth account: ${u.email}`);
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                const cred = await signInWithEmailAndPassword(auth, u.email, u.pass);
                user = cred.user;
                console.log(`Logged into existing auth account: ${u.email}`);
            } else {
                console.error(`Error auth with ${u.email}:`, e);
                continue;
            }
        }

        try {
            // First attempt to write document (might fail if rules block updating own roles)
            await setDoc(doc(db, 'users', user.uid), {
                displayName: u.name,
                email: u.email,
                roles: u.roles,
                ward: u.ward,
                points: 100,
                totalReports: 0,
                createdAt: new Date().toISOString()
            }, { merge: true });
            console.log(`✅ Updated Firestore roles for ${u.email}`);
        } catch (e) {
            console.error(`❌ Firestore rules blocked writing for ${u.email}:`, e.message);
        }
    }
    console.log("\nDone seeding users!");
    process.exit(0);
}
main();
