import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface HeatmapLayerProps {
    points: [number, number, number?][];
    options?: { radius?: number; blur?: number; maxZoom?: number; max?: number; gradient?: Record<number, string> };
}

/**
 * PR-30: Real density heatmap. PR-32: Use with glass-only points and stronger gradient for glass density.
 */
export default function HeatmapLayer({ points, options = {} }: HeatmapLayerProps) {
    const map = useMap();
    const layerRef = useRef<{ setLatLngs: (p: [number, number, number?][]) => void; redraw: () => void } | null>(null);

    useEffect(() => {
        if (!map || !('heatLayer' in L)) return;
        const opts = { radius: options.radius ?? 25, blur: options.blur ?? 15, maxZoom: 17, max: 1, gradient: options.gradient ?? { 0.2: '#10B981', 0.5: '#F59E0B', 0.8: '#EF4444', 1: '#7F1D1D' } };
        const heat = (L as any).heatLayer(points.length ? points : [], opts).addTo(map);
        layerRef.current = heat;
        return () => {
            map.removeLayer(heat);
            layerRef.current = null;
        };
    }, [map]);

    useEffect(() => {
        if (layerRef.current) {
            layerRef.current.setLatLngs(points);
            layerRef.current.redraw();
        }
    }, [points]);

    return null;
}
