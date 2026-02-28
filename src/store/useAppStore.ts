import { create } from 'zustand';
import type { Notification } from '../types';

interface AppState {
    // Online status
    isOnline: boolean;
    setOnline: (v: boolean) => void;

    // Notifications
    notifications: Notification[];
    unreadCount: number;
    setNotifications: (n: Notification[]) => void;
    markAllRead: () => void;

    // Map state
    mapCenter: [number, number];
    mapZoom: number;
    setMapCenter: (center: [number, number], zoom?: number) => void;

    // Report filters
    reportFilters: {
        ward: string;
        issueType: string;
        status: string;
        timeRange: string;
    };
    setReportFilter: (key: string, value: string) => void;
    clearReportFilters: () => void;

    // Modal state
    activeModal: string | null;
    modalData: unknown;
    openModal: (id: string, data?: unknown) => void;
    closeModal: () => void;

    // Festival mode
    festivalModeActive: boolean;
    activeSpecialZones: string[];
    setFestivalMode: (active: boolean, zones: string[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
    isOnline: navigator.onLine,
    setOnline: (v) => set({ isOnline: v }),

    notifications: [],
    unreadCount: 0,
    setNotifications: (notifications) =>
        set({ notifications, unreadCount: notifications.filter((n) => !n.read).length }),
    markAllRead: () =>
        set((s) => ({
            notifications: s.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
        })),

    // Madurai city center
    mapCenter: [9.9252, 78.1198],
    mapZoom: 13,
    setMapCenter: (mapCenter, zoom) =>
        set((s) => ({ mapCenter, mapZoom: zoom ?? s.mapZoom })),

    reportFilters: { ward: '', issueType: '', status: '', timeRange: 'last7d' },
    setReportFilter: (key, value) =>
        set((s) => ({ reportFilters: { ...s.reportFilters, [key]: value } })),
    clearReportFilters: () =>
        set({ reportFilters: { ward: '', issueType: '', status: '', timeRange: 'last7d' } }),

    activeModal: null,
    modalData: null,
    openModal: (id, data) => set({ activeModal: id, modalData: data }),
    closeModal: () => set({ activeModal: null, modalData: null }),

    festivalModeActive: false,
    activeSpecialZones: [],
    setFestivalMode: (festivalModeActive, activeSpecialZones) =>
        set({ festivalModeActive, activeSpecialZones }),
}));
