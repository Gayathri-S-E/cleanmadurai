import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// ------------------------------------------------------------------------
// MODULE 1: The Citizen "Waste Credit Score" (WCS) Engine
// ------------------------------------------------------------------------
// Runs weekly on Sunday at 2:00 AM
// Calculates the WCS based on verified reports and points.
export const onWeeklyWCS = onSchedule('0 2 * * 0', async (event) => {
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();

    const batch = db.batch();

    usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        // A simple WCS calculation logic based on Master Spec
        // Baseline 300, max 850.
        let baseScore = 300;

        const reportedCount = userData.totalReports || 0;
        const verifiedCount = userData.verifiedReports || 0;
        const points = userData.points || 0;

        // Base points + multiplier for accuracy (verified / reported)
        const accuracy = reportedCount > 0 ? (verifiedCount / reportedCount) : 1;

        // Add points. Every 10 points is 1 WCS point, capped.
        let addedScore = Math.floor(points / 10) + (verifiedCount * 5 * accuracy);

        let finalWCS = Math.min(850, Math.max(300, baseScore + addedScore));

        batch.update(userDoc.ref, {
            wcs: Math.round(finalWCS),
            wcsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
    console.log(`Updated WCS for ${usersSnapshot.size} users.`);
});

// ------------------------------------------------------------------------
// MODULE 13: Cleanliness Stability Score (CSS) & Degradation Velocity (DV)
// ------------------------------------------------------------------------
// Runs nightly at 3:00 AM
export const onNightlyAnalytics = onSchedule('0 3 * * *', async (event) => {
    const db = admin.firestore();
    const wardsSnapshot = await db.collection('wards').get();

    const batch = db.batch();
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all reports from the last week once to optimize
    const recentReportsSnapshot = await db.collection('reports')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(oneWeekAgo))
        .get();

    wardsSnapshot.forEach(wardDoc => {
        const wardId = wardDoc.id;

        // Filter reports for this ward
        const wardReports = recentReportsSnapshot.docs
            .map(d => d.data())
            .filter(r => r.ward === wardId);

        const newReportsCount = wardReports.length;
        const resolvedReportsCount = wardReports.filter(r => r.status === 'resolved').length;

        // CSS (Cleanliness Stability Score) - 1 to 10
        // Based on ratio of resolved vs new in the last week
        let css = 5; // Default average
        if (newReportsCount > 0) {
            const resolutionRate = resolvedReportsCount / newReportsCount;
            css = Math.min(10, Math.max(1, Math.round(resolutionRate * 10)));
        } else if (newReportsCount === 0 && resolvedReportsCount === 0) {
            css = 8; // Stable, no new issues
        }

        // DV (Degradation Velocity)
        // Rate of new reports per day over the last week
        const dv = newReportsCount / 7;

        batch.update(wardDoc.ref, {
            css: css,
            degradationVelocity: Number(dv.toFixed(2)),
            analyticsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
    console.log(`Updated CSS and DV for ${wardsSnapshot.size} wards.`);
});
