// seed-events.mjs — Seeds cleanupEvents collection for Volunteer dashboard
// Run: node seed-events.mjs

const API_KEY = 'AIzaSyCfvHOPEsnIg6eBxWhh6We5w73lNFORC2Y';
const PROJECT_ID = 'madurai-78eca';

// Sign in as admin to get auth token
async function signIn(email, password) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
    return json.idToken;
}

async function addDoc(collectionId, data, idToken) {
    const fields = {};
    const toValue = (v) => {
        if (typeof v === 'string') return { stringValue: v };
        if (typeof v === 'number') return { integerValue: String(v) };
        if (typeof v === 'boolean') return { booleanValue: v };
        if (Array.isArray(v)) return { arrayValue: { values: v.map(i => ({ stringValue: String(i) })) } };
        return { stringValue: String(v) };
    };
    for (const [k, v] of Object.entries(data)) fields[k] = toValue(v);
    fields.createdAt = { timestampValue: new Date().toISOString() };

    const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, body: JSON.stringify({ fields }) }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
    return json;
}

async function main() {
    console.log('🌱 Seeding cleanupEvents...');
    const token = await signIn('college@demo.in', 'Demo@1234');

    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);

    const events = [
        {
            title: 'Meenakshi Amman Temple Zone Cleanup',
            date: fmt(new Date(today.getTime() + 2 * 86400000)),
            location: 'Meenakshi Temple, Madurai',
            description: 'Join us to clean the temple surroundings and nearby streets',
            volunteers: 12,
            organizer: 'Demo College Admin',
            ward: 'Ward 42 – Meenakshi Nagar',
            status: 'upcoming',
        },
        {
            title: 'Mattuthavani Bus Stand Cleanup Drive',
            date: fmt(new Date(today.getTime() + 5 * 86400000)),
            location: 'Mattuthavani Bus Stand, Madurai',
            description: 'Targeting plastic waste around the bus stand area',
            volunteers: 8,
            organizer: 'Demo College Madurai',
            ward: 'Ward 5 – Mattuthavani',
            status: 'upcoming',
        },
        {
            title: 'Vandiyur Mariamman Teppakulam Awareness Walk',
            date: fmt(new Date(today.getTime() + 10 * 86400000)),
            location: 'Vandiyur Mariamman Teppakulam, Madurai',
            description: 'Awareness walk + litter cleanup around the lake',
            volunteers: 25,
            organizer: 'Demo College Admin',
            ward: 'Ward 15 – Teppakulam',
            status: 'upcoming',
        },
    ];

    for (const ev of events) {
        try {
            await addDoc('cleanupEvents', ev, token);
            console.log(`✅ Added: ${ev.title}`);
        } catch (e) {
            console.error(`❌ Failed: ${ev.title} — ${e.message}`);
        }
    }

    console.log('\n✅ cleanupEvents seeded!\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
