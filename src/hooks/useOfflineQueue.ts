import { useState, useEffect, useCallback } from 'react';
import { set, get, del, keys } from 'idb-keyval';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';

interface PendingReport {
    id: string;
    data: Record<string, unknown>;
    imageDataUrl?: string;
    timestamp: number;
}

const STORE_KEY_PREFIX = 'pending_report_';

/**
 * 5.2 / IndexedDB: Full offline queue – store report + optional image; on sync upload image then create report.
 */
export function useOfflineQueue() {
    const [pendingCount, setPendingCount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    const refreshCount = useCallback(async () => {
        const allKeys = await keys();
        const pending = allKeys.filter((k) => String(k).startsWith(STORE_KEY_PREFIX));
        setPendingCount(pending.length);
    }, []);

    useEffect(() => {
        refreshCount();
    }, [refreshCount]);

    useEffect(() => {
        const handleOnline = () => syncPendingReports();
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    const enqueueReport = useCallback(async (reportData: Record<string, unknown>, options?: { imageDataUrl?: string }) => {
        const id = `${STORE_KEY_PREFIX}${Date.now()}`;
        const pending: PendingReport = { id, data: reportData, imageDataUrl: options?.imageDataUrl, timestamp: Date.now() };
        await set(id, pending);
        await refreshCount();
    }, [refreshCount]);

    const syncPendingReports = useCallback(async () => {
        if (!navigator.onLine || syncing) return;
        setSyncing(true);
        try {
            const allKeys = await keys();
            const pendingKeys = allKeys.filter((k) => String(k).startsWith(STORE_KEY_PREFIX));
            const { auth } = await import('../services/firebase');
            const uid = auth.currentUser?.uid;
            for (const key of pendingKeys) {
                const report = await get(key) as PendingReport;
                if (!report) continue;
                try {
                    let photoURL: string | undefined;
                    if (report.imageDataUrl && uid) {
                        const storageRef = ref(storage, `reports/${uid}/${Date.now()}_offline.jpg`);
                        await uploadString(storageRef, report.imageDataUrl, 'data_url');
                        photoURL = await getDownloadURL(storageRef);
                    }
                    await addDoc(collection(db, 'reports'), {
                        ...report.data,
                        ...(photoURL && { photoURL }),
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        syncedFromOffline: true,
                    });
                    await del(key);
                } catch (err) {
                    console.error('Failed to sync report:', err);
                }
            }
        } finally {
            setSyncing(false);
            await refreshCount();
        }
    }, [syncing, refreshCount]);

    return { pendingCount, syncing, enqueueReport, syncPendingReports };
}
