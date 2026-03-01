import * as admin from 'firebase-admin';
import * as path from 'path';

// This assumes you have downloaded your Firebase Admin SDK service account key
// and placed it in the root of your project as `serviceAccountKey.json`.
// If you don't have it, you need to generate one from Firebase Console -> Project Settings -> Service Accounts
const serviceAccountPath = path.resolve('./serviceAccountKey.json');

try {
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();

    async function seedSanitationWorker() {
        console.log('Creating Sanitation Worker user...');
        try {
            // 1. Create user in Firebase Auth
            const userRecord = await admin.auth().createUser({
                email: 'worker1@cleanmadurai.gov.in',
                emailVerified: true,
                password: 'Password123!',
                displayName: 'S. Muthu (Worker)',
                disabled: false,
            });

            console.log('Successfully created new user in Auth:', userRecord.uid);

            // 2. Create the corresponding profile in Firestore
            const userProfile = {
                uid: userRecord.uid,
                displayName: 'S. Muthu',
                email: 'worker1@cleanmadurai.gov.in',
                roles: ['sanitation_worker', 'citizen'],
                ward: '32', // Default ward
                points: 0,
                badges: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                language: 'ta', // Default to Tamil
                adoptedBlocks: [],
                totalReports: 0,
                resolvedReports: 0,
                loginStreak: 0,
            };

            await db.collection('users').doc(userRecord.uid).set(userProfile);
            console.log('Successfully created user profile in Firestore');

            console.log('\n=============================================');
            console.log('WORKER CREDENTIALS');
            console.log('Email: worker1@cleanmadurai.gov.in');
            console.log('Password: Password123!');
            console.log('Roles: sanitation_worker, citizen');
            console.log('Ward: 32');
            console.log('=============================================\n');

            process.exit(0);
        } catch (error) {
            console.error('Error creating new user:', error);
            process.exit(1);
        }
    }

    seedSanitationWorker();

} catch (error) {
    console.error("Failed to load service account key.");
    console.error("Please ensure you have a 'serviceAccountKey.json' file in the root of your project.");
    console.error("You can generate one from Firebase Console -> Project Settings -> Service Accounts -> Generate new private key");
    process.exit(1);
}
