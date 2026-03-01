import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
// import * as dotenv from 'dotenv';
// dotenv.config();

// Initialize typical client SDK if admin SDK is not available
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uid = "FsEHjpyR3PTF8lXvC7f67oH5QHD2";

async function makeWorker() {
    try {
        console.log("Updating document...");
        await updateDoc(doc(db, "users", uid), {
            roles: ["sanitation_worker", "citizen"],
        });
        console.log("Success! Roles updated to sanitary_worker.");

        // Ensure the script exits
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

makeWorker();
