import { onRequest } from 'firebase-functions/v2/https';
import * as vision from '@google-cloud/vision';

// Initialize the Vision client
const visionClient = new vision.ImageAnnotatorClient();

// ------------------------------------------------------------------------
// MODULE 17: Cloud Vision API — Landmark & Object Detection
// ------------------------------------------------------------------------
// Receives an image (base64 or URL), calls Vision API, and returns metadata.
export const apiProcessReportImage = onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        // Firebase Callable Functions (httpsCallable from client) wrap payload in a `data` field
        const payload = req.body.data || req.body;
        const { imageBase64, imageUrl } = payload;

        if (!imageBase64 && !imageUrl) {
            res.status(400).send({ error: 'Missing image data (base64 or url required)' });
            return;
        }

        // Prepare request for Vision API
        const requestOpts = imageBase64
            ? { image: { content: imageBase64 } }
            : { image: { source: { imageUri: imageUrl } } };

        // We want Landmark, Object, and Text detection as per Phase 7
        const [result] = await visionClient.annotateImage({
            ...requestOpts,
            features: [
                { type: 'LANDMARK_DETECTION', maxResults: 3 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 5 },
                { type: 'TEXT_DETECTION' },
                { type: 'SAFE_SEARCH_DETECTION' }
            ]
        });

        const landmarks = result.landmarkAnnotations?.map(l => l.description) || [];
        const objects = result.localizedObjectAnnotations?.map(o => o.name) || [];
        const text = result.textAnnotations?.[0]?.description || "";
        const safeSearch = result.safeSearchAnnotation;

        // Auto-reject inappropriate images
        let isSafe = true;
        if (safeSearch) {
            const badFlags = ['LIKELY', 'VERY_LIKELY'];
            if (badFlags.includes(safeSearch.adult as string) ||
                badFlags.includes(safeSearch.violence as string)) {
                isSafe = false;
            }
        }

        // Basic waste mapping based on objects found
        let detectedType = 'other';
        const objectsLower = objects.map(o => (o || '').toLowerCase());
        if (objectsLower.some(o => o.includes('plastic') || o.includes('bottle'))) detectedType = 'plastic';
        if (objectsLower.some(o => o.includes('fire') || o.includes('smoke'))) detectedType = 'burning';
        if (objectsLower.some(o => o.includes('water') || o.includes('liquid'))) detectedType = 'sewage';

        res.status(200).send({
            data: {
                isSafe,
                landmarks,
                objects,
                detectedType,
                detectedText: text,
                rawSafeSearch: safeSearch
            }
        });

    } catch (error) {
        console.error("Vision API Error:", error);
        res.status(500).send({ error: "Failed to process image with Vision API." });
    }
});
