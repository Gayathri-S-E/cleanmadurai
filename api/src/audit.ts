import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';

admin.initializeApp();

/**
 * Audit Log Trigger: Reports
 * Listens for new reports and status changes to create immutable audit logs.
 */
export const onReportCreated = onDocumentCreated('reports/{reportId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const reportData = snapshot.data();

    await admin.firestore().collection('audit_log').add({
        action: 'REPORT_CREATED',
        entityId: event.params.reportId,
        entityType: 'report',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actorUid: reportData.citizenId || 'system',
        details: {
            location: reportData.location,
            wasteType: reportData.wasteType,
            status: reportData.status
        }
    });
});

export const onReportStatusChanged = onDocumentUpdated('reports/{reportId}', async (event) => {
    const newValue = event.data?.after.data();
    const previousValue = event.data?.before.data();

    if (!newValue || !previousValue) return;

    // Only log if the status actually changed
    if (newValue.status !== previousValue.status) {
        await admin.firestore().collection('audit_log').add({
            action: 'REPORT_STATUS_CHANGED',
            entityId: event.params.reportId,
            entityType: 'report',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            // We'd ideally pull the actor from auth context, but for Firestore triggers
            // on datastore changes, we log the system or the assigned officer if status is verified
            actorUid: newValue.assignedOfficerId || 'system',
            details: {
                oldStatus: previousValue.status,
                newStatus: newValue.status,
                verifiedBy: newValue.verifiedBy || null
            }
        });

        // If status changed to OPEN, check if we need to notify nearby workers (Module 5 simulated)
        /*
        if (newValue.status === 'open') {
            const payload = {
                notification: {
                    title: 'New Issue Assigned!',
                    body: `A new ${newValue.wasteType} issue has been assigned in your area.`
                }
            };
            // await admin.messaging().sendToTopic('workers', payload);
        }
        */
    }
});
