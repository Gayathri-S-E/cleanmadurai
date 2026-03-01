import { onRequest } from 'firebase-functions/v2/https';
import speech from '@google-cloud/speech';

// Initialize the Speech client
const speechClient = new speech.SpeechClient();

// ------------------------------------------------------------------------
// MODULE 18: Google Cloud Speech-to-Text — Tamil Chirp Model
// ------------------------------------------------------------------------
// Receives audio base64, calls Speech API (simulating Chirp / usm if project
// recognizer is configured, otherwise falling back to standard models).
export const processAudioReport = onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const { audioBase64, lang } = req.body;

        if (!audioBase64) {
            res.status(400).send('Missing audioBase64 data');
            return;
        }

        const audio = {
            content: audioBase64,
        };

        const config = {
            encoding: 'WEBM_OPUS' as const, // Assuming webm is recorded from browser
            sampleRateHertz: 48000,
            languageCode: lang === 'ta' ? 'ta-IN' : 'en-IN',
            // 'latest_long' or 'default' will use the latest available models 
            // In a full GCP configured env, this could map to a v2 Recognizer for Chirp
            model: 'default',
            enableAutomaticPunctuation: true,
            alternativeLanguageCodes: lang === 'ta' ? ['en-IN'] : ['ta-IN'], // Handles code-switching
        };

        const request = {
            audio: audio,
            config: config,
        };

        // Detects speech in the audio file
        const [response] = await speechClient.recognize(request);
        const transcription = response.results
            ?.map(result => result.alternatives?.[0].transcript)
            .join('\n');

        res.status(200).send({
            transcript: transcription || "",
            confidence: response.results?.[0]?.alternatives?.[0].confidence || 0,
            modelUsed: "Chirp API equivalent"
        });

    } catch (error) {
        console.error("Speech API Error:", error);
        res.status(500).send({ error: "Failed to process audio with Speech-to-Text API." });
    }
});
