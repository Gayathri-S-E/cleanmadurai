import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// ------------------------------------------------------------------------
// MODULE 3: Predictive Bin Overflow Model
// ------------------------------------------------------------------------
// Runs every 2 hours to predict bin fill levels based on historical data.
export const onBinOverflowCheck = onSchedule('0 */2 * * *', async (event) => {
    const db = admin.firestore();
    const binsSnapshot = await db.collection('bins').get();

    // In a real production system, this would query a BigQuery ML model.
    // Here we simulate the logic based on the spec:
    // Factors: Time of day, Size of bin, Type of area (residential/commercial)

    const now = new Date();
    const hour = now.getHours();

    const batch = db.batch();

    binsSnapshot.forEach(binDoc => {
        const binData = binDoc.data();
        let currentFillLevel = binData.fillLevel || 0;

        // Default base rate of fill per 2 hours
        let fillRate = 5;

        // Increased fill rate during daytime
        if (hour >= 8 && hour <= 20) {
            fillRate += 10;
        }

        // Apply weight based on location type if available (simulated)
        const isCommercial = binData.zone?.includes('Market') || binData.zone?.includes('Bus Stand');
        if (isCommercial) {
            fillRate *= 1.5;
        }

        // Add varying noise for realism
        const noise = Math.floor(Math.random() * 5);
        fillRate += noise;

        let newFillLevel = currentFillLevel + Math.round(fillRate);

        // Capping at 100%
        if (newFillLevel >= 100) {
            newFillLevel = 100;
        }

        batch.update(binDoc.ref, {
            fillLevel: newFillLevel,
            lastPredictedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: newFillLevel >= 85 ? 'full' : newFillLevel >= 50 ? 'half' : 'empty'
        });
    });

    await batch.commit();
    console.log(`Updated predicted fill levels for ${binsSnapshot.size} bins.`);
});
