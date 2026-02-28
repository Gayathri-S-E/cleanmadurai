// seed-all-roles.mjs — Creates all 10 role demo accounts for Clean Madurai
// Run: node seed-all-roles.mjs

const API_KEY = 'AIzaSyCfvHOPEsnIg6eBxWhh6We5w73lNFORC2Y';
const PROJECT_ID = 'madurai-78eca';

const DEMO_USERS = [
    // ─── Already seeded (will skip if exists) ──────────────────────────────
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
        approved: true,
    },
    {
        email: 'officer@demo.in',
        password: 'Demo@1234',
        displayName: 'Priya Devi',
        roles: ['corp_officer'],
        ward: 'Ward 42 – Meenakshi Nagar',
        points: 2400,
        badges: ['top_resolver'],
        totalReports: 0,
        resolvedReports: 87,
        approved: true,
    },
    {
        email: 'admin@demo.in',
        password: 'Demo@1234',
        displayName: 'Suresh Babu',
        roles: ['corp_admin', 'system_admin'],
        ward: 'All Wards',
        points: 9999,
        badges: ['city_guardian'],
        totalReports: 0,
        resolvedReports: 0,
        approved: true,
    },
    // ─── NEW ROLE ACCOUNTS ──────────────────────────────────────────────────
    {
        email: 'volunteer@demo.in',
        password: 'Demo@1234',
        displayName: 'Kavitha S',
        roles: ['volunteer'],
        ward: 'Ward 15 – Teppakulam',
        points: 620,
        badges: ['first_report'],
        totalReports: 8,
        resolvedReports: 5,
        approved: true,
        organization: 'Demo College Madurai',
    },
    {
        email: 'autodriver@demo.in',
        password: 'Demo@1234',
        displayName: 'Murugan K',
        roles: ['auto_driver'],
        ward: 'Ward 22 – Anna Nagar',
        points: 430,
        badges: ['street_savior'],
        totalReports: 18,
        resolvedReports: 10,
        approved: true,
        loginStreak: 5,
    },
    {
        email: 'shopowner@demo.in',
        password: 'Demo@1234',
        displayName: 'Selvi P',
        roles: ['shop_owner'],
        ward: 'Ward 8 – Market Road',
        points: 200,
        badges: [],
        totalReports: 2,
        resolvedReports: 1,
        approved: true,
    },
    {
        email: 'hotel@demo.in',
        password: 'Demo@1234',
        displayName: 'Raj Hotels',
        roles: ['hotel_owner'],
        ward: 'Ward 10 – Town Hall',
        points: 380,
        badges: [],
        totalReports: 1,
        resolvedReports: 0,
        approved: true,
    },
    {
        email: 'vendor@demo.in',
        password: 'Demo@1234',
        displayName: 'Lakshmi Stores',
        roles: ['market_vendor'],
        ward: 'Ward 5 – Mattuthavani',
        points: 290,
        badges: [],
        totalReports: 3,
        resolvedReports: 2,
        approved: true,
    },
    {
        email: 'farmer@demo.in',
        password: 'Demo@1234',
        displayName: 'Arumugam R',
        roles: ['farmer'],
        ward: 'Ward 38 – Kochadai',
        points: 160,
        badges: [],
        totalReports: 0,
        resolvedReports: 0,
        approved: true,
    },
    {
        email: 'shelter@demo.in',
        password: 'Demo@1234',
        displayName: 'Madurai Animal Care',
        roles: ['animal_shelter'],
        ward: 'Ward 12 – Palanganatham',
        points: 110,
        badges: [],
        totalReports: 0,
        resolvedReports: 0,
        approved: true,
    },
    {
        email: 'college@demo.in',
        password: 'Demo@1234',
        displayName: 'Demo College Admin',
        roles: ['college_admin'],
        ward: 'Ward 15 – Teppakulam',
        points: 750,
        badges: [],
        totalReports: 4,
        resolvedReports: 2,
        approved: true,
        organization: 'Demo College Madurai',
    },
    {
        email: 'superadmin@demo.in',
        password: 'Demo@1234',
        displayName: 'Super Admin',
        roles: ['super_admin'],
        ward: 'All Wards',
        points: 9999,
        badges: ['city_guardian'],
        totalReports: 0,
        resolvedReports: 0,
        approved: true,
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName, returnSecureToken: true })
        }
    );
}

async function signIn(email, password) {
    return fetchJSON(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        }
    );
}

async function writeFirestoreDoc(collection, docId, data, idToken) {
    const fields = {};
    const toValue = (v) => {
        if (typeof v === 'string') return { stringValue: v };
        if (typeof v === 'number') return { integerValue: String(v) };
        if (typeof v === 'boolean') return { booleanValue: v };
        if (Array.isArray(v)) return { arrayValue: { values: v.map(i => ({ stringValue: i })) } };
        return { stringValue: String(v) };
    };
    for (const [k, v] of Object.entries(data)) fields[k] = toValue(v);
    const now = new Date().toISOString();
    fields['createdAt'] = { timestampValue: now };
    fields['updatedAt'] = { timestampValue: now };

    return fetchJSON(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
        {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ fields })
        }
    );
}

async function main() {
    console.log('\n🌱 Seeding ALL Clean Madurai Demo Roles...\n');

    const results = [];

    for (const user of DEMO_USERS) {
        let uid, idToken;
        try {
            const r = await signUp(user.email, user.password, user.displayName);
            uid = r.localId; idToken = r.idToken;
            console.log(`✅ Created : ${user.email}`);
        } catch (err) {
            if (err.message.includes('EMAIL_EXISTS')) {
                const r = await signIn(user.email, user.password);
                uid = r.localId; idToken = r.idToken;
                console.log(`♻️  Exists  : ${user.email}`);
            } else {
                console.error(`❌ Failed  : ${user.email} — ${err.message}`);
                continue;
            }
        }

        const profile = {
            uid, email: user.email, displayName: user.displayName,
            ward: user.ward, points: user.points, totalReports: user.totalReports,
            resolvedReports: user.resolvedReports, language: 'en',
            roles: user.roles, badges: user.badges, adoptedBlocks: [],
            approved: user.approved,
        };
        if (user.organization) profile.organization = user.organization;
        if (user.loginStreak) profile.loginStreak = user.loginStreak;

        try {
            await writeFirestoreDoc('users', uid, profile, idToken);
            console.log(`   📝 Firestore updated for ${user.displayName}`);
        } catch (e) {
            console.error(`   ⚠️  Firestore failed: ${e.message}`);
        }

        results.push({ ...user, uid });
    }

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║          CLEAN MADURAI — ALL ROLE CREDENTIALS        ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    for (const u of results) {
        const roleStr = u.roles.join(', ');
        console.log(`║  ${u.displayName.padEnd(30)}  (${roleStr.slice(0, 18).padEnd(18)})  ║`);
        console.log(`║  📧 ${u.email.padEnd(46)}  ║`);
        console.log(`║  🔑 ${u.password.padEnd(46)}  ║`);
        console.log('╠══════════════════════════════════════════════════════╣');
    }
    console.log('╚══════════════════════════════════════════════════════╝\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
