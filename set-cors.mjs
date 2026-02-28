// set-cors.mjs — Run with: node set-cors.mjs
// Sets CORS on the Firebase Storage bucket so browser uploads work
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';

// Read the service account key if available, otherwise use default credentials
let app;
try {
    const sa = JSON.parse(readFileSync('./service-account.json', 'utf8'));
    app = initializeApp({ credential: cert(sa), storageBucket: 'madurai-78eca.firebasestorage.app' });
} catch {
    app = initializeApp({ storageBucket: 'madurai-78eca.firebasestorage.app' });
}

const bucket = getStorage(app).bucket();
await bucket.setCorsConfiguration([
    {
        origin: ['*'],
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        maxAgeSeconds: 3600,
    }
]);
console.log('✅ CORS set successfully on bucket:', bucket.name);
