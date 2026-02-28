// seed-demo-users.mjs - Uses Firebase REST API (avoids Windows SDK async issue)
// Run: node seed-demo-users.mjs

const API_KEY = 'AIzaSyCfvHOPEsnIg6eBxWhh6We5w73lNFORC2Y';
const PROJECT_ID = 'madurai-78eca';

const DEMO_USERS = [
    {
        email: 'citizen@demo.in',
        password: 'Demo@1234',
        displayName: 'Ravi Kumar',
        roles: ['citizen'],
        ward: 'Ward 42 – Meenakshi Nagar',
        points: 850,
        badges: ['first_report', 'eco_warrior'],
        totalReports: 12,
        resolvedReports: 9,
        adoptedBlocks: [],
    },
    {
        email: 'officer@demo.in',
        password: 'Demo@1234',
        displayName: 'Priya Devi',
        roles: ['corp_officer'],
        ward: 'Ward 42 – Meenakshi Nagar',
        points: 2400,
        badges: ['top_resolver', 'speed_star'],
        totalReports: 0,
        resolvedReports: 87,
        adoptedBlocks: [],
    },
    {
        email: 'admin@demo.in',
        password: 'Demo@1234',
        displayName: 'Suresh Babu',
        roles: ['corp_admin', 'system_admin'],
        ward: 'All Wards',
        points: 9999,
        badges: ['city_guardian', 'top_resolver', 'eco_warrior'],
        totalReports: 0,
        resolvedReports: 0,
        adoptedBlocks: [],
    },
];

async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
    return json;
}

async function signUp(email, password, displayName) {
    return fetchJSON(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
        }
    );
}

async function signIn(email, password) {
    return fetchJSON(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
    );
}

async function writeFirestoreDoc(collection, docId, data, idToken) {
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'string') fields[k] = { stringValue: v };
        else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
        else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
        else if (Array.isArray(v)) {
            fields[k] = { arrayValue: { values: v.map(i => ({ stringValue: i })) } };
        }
    }
    // Add timestamps
    const now = new Date().toISOString();
    fields['createdAt'] = { timestampValue: now };
    fields['updatedAt'] = { timestampValue: now };

    return fetchJSON(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ fields }),
        }
    );
}

async function main() {
    console.log('\n🌱 Seeding Clean Madurai Demo Users via REST API...\n');

    for (const user of DEMO_USERS) {
        let uid, idToken;
        try {
            const result = await signUp(user.email, user.password, user.displayName);
            uid = result.localId;
            idToken = result.idToken;
            console.log(`✅ Created: ${user.email} (uid: ${uid.slice(0, 8)}...)`);
        } catch (err) {
            if (err.message.includes('EMAIL_EXISTS')) {
                const result = await signIn(user.email, user.password);
                uid = result.localId;
                idToken = result.idToken;
                console.log(`♻️  Already exists, updating: ${user.email}`);
            } else {
                console.error(`❌ Failed for ${user.email}: ${err.message}`);
                continue;
            }
        }

        try {
            await writeFirestoreDoc('users', uid, {
                uid,
                email: user.email,
                displayName: user.displayName,
                ward: user.ward,
                points: user.points,
                totalReports: user.totalReports,
                resolvedReports: user.resolvedReports,
                language: 'en',
                roles: user.roles,
                badges: user.badges,
                adoptedBlocks: user.adoptedBlocks,
            }, idToken);
            console.log(`📝 Firestore profile saved for ${user.displayName}`);
        } catch (e) {
            console.error(`  ⚠️  Firestore write failed: ${e.message}`);
        }
    }

    console.log('\n✅ Done! Demo accounts ready.\n');
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│            DEMO CREDENTIALS                 │');
    console.log('├─────────────────────────────────────────────┤');
    for (const u of DEMO_USERS) {
        console.log(`│  ${u.displayName.padEnd(30)} │`);
        console.log(`│  📧 ${u.email.padEnd(36)} │`);
        console.log(`│  🔑 ${u.password.padEnd(36)} │`);
        console.log(`│  🎭 ${u.roles.join(', ').padEnd(36)} │`);
        console.log('├─────────────────────────────────────────────┤');
    }
    console.log('└─────────────────────────────────────────────┘\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
