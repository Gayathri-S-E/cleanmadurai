import { useState, useCallback } from 'react';
import type { GeoPoint } from '../types';

interface GeolocationState {
    position: GeoPoint | null;
    address: string;
    loading: boolean;
    error: string | null;
}

export function useGeolocation() {
    const [state, setState] = useState<GeolocationState>({
        position: null,
        address: '',
        loading: false,
        error: null,
    });

    const fetchLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setState((s) => ({ ...s, error: 'Geolocation not supported', loading: false }));
            return;
        }
        setState((s) => ({ ...s, loading: true, error: null }));

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                const position: GeoPoint = { lat, lng };
                setState((s) => ({ ...s, position, loading: true }));

                // Reverse geocode using OpenStreetMap Nominatim (free, no key needed)
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
                        { headers: { 'Accept-Language': 'en' } }
                    );
                    const data = await res.json();
                    const addr = data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                    setState({ position, address: addr, loading: false, error: null });
                } catch {
                    setState({ position, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, loading: false, error: null });
                }
            },
            (err) => {
                setState({ position: null, address: '', loading: false, error: err.message });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    return { ...state, fetchLocation };
}
