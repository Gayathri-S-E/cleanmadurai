import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../services/firebase';
import type { UserProfile, UserRole } from '../types';
import { checkAndAwardBadges } from '../services/badgeService';

// ─── Session expiry ───────────────────────────────────────────────────────────
const SESSION_KEY = 'cm_session_login_ts';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function saveSessionTimestamp() {
    localStorage.setItem(SESSION_KEY, String(Date.now()));
}

function isSessionExpired(): boolean {
    const ts = localStorage.getItem(SESSION_KEY);
    if (!ts) return false; // no timestamp = fresh login, not expired
    return Date.now() - Number(ts) > SESSION_EXPIRY_MS;
}

function clearSessionTimestamp() {
    localStorage.removeItem(SESSION_KEY);
}


interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    profileChecked: boolean;   // true once we definitely know if profile exists or not
    roles: UserRole[];
    hasRole: (role: UserRole | UserRole[]) => boolean;
    isAdmin: boolean;
    isOfficer: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, displayName: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileChecked, setProfileChecked] = useState(false);

    useEffect(() => {
        let unsubscribeSnapshot: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            // Clean up previous snapshot listener
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }

            // ── Session expiry check ──────────────────────────────────────────
            if (firebaseUser && isSessionExpired()) {
                console.info('[Auth] Session expired after 7 days — signing out.');
                clearSessionTimestamp();
                await signOut(auth);
                setUser(null);
                setProfile(null);
                setProfileChecked(true);
                setLoading(false);
                return;
            }

            setUser(firebaseUser);
            setProfileChecked(false);

            if (firebaseUser) {
                // Record/refresh session timestamp on each valid auth event
                saveSessionTimestamp();

                // Set up real-time listener so profile stays in sync
                const docRef = doc(db, 'users', firebaseUser.uid);
                unsubscribeSnapshot = onSnapshot(docRef, async (snap) => {
                    if (snap.exists()) {
                        setProfile(snap.data() as UserProfile);
                        // PR-6/PR-8: Sync Firestore roles to Auth custom claims so rules can use request.auth.token.roles
                        try {
                            const refreshClaims = httpsCallable<unknown, { updated?: boolean; roles?: string[] }>(functions, 'refreshCustomClaims');
                            await refreshClaims({});
                            await firebaseUser.getIdToken(true);
                        } catch (e) {
                            console.warn('Refresh custom claims failed (run Cloud Function):', e);
                        }
                    } else {
                        setProfile(null);
                    }
                    setProfileChecked(true);
                    setLoading(false);
                }, (err) => {
                    console.error('Profile listener error:', err);
                    setProfile(null);
                    setProfileChecked(true);
                    setLoading(false);
                });
            } else {
                setProfile(null);
                setProfileChecked(true);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
        };
    }, []);

    const roles: UserRole[] = profile?.roles ?? [];

    const hasRole = (role: UserRole | UserRole[]) => {
        if (Array.isArray(role)) return role.some((r) => roles.includes(r));
        return roles.includes(role);
    };

    const isAdmin = hasRole(['corp_admin', 'system_admin', 'super_admin']);
    const isOfficer = hasRole(['corp_officer', 'zonal_officer', 'ward_officer', 'sanitation_worker']);

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged fires automatically; profile is fetched there
    };

    const signup = async (email: string, password: string, displayName: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        // Profile doc will be created in onboarding (user is new, no Firestore doc yet)
    };

    const logout = async () => {
        clearSessionTimestamp();
        await signOut(auth);
        setProfile(null);
        setProfileChecked(false);
    };


    const updateUserProfile = async (data: Partial<UserProfile>) => {
        if (!user || (!profile && profileChecked)) return;

        // Auto-badging check if points are being updated
        if (data.points !== undefined && profile) {
            try {
                await checkAndAwardBadges(user.uid, profile, data.points);
            } catch (e) {
                console.error("Auto-badging failed:", e);
            }
        }

        const ref = doc(db, 'users', user.uid);
        await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
        setProfile((prev) => (prev ? { ...prev, ...data } : null));
    };

    // Profile is kept live via onSnapshot; refreshProfile triggers a manual re-read
    const refreshProfile = async () => {
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setProfile(snap.data() as UserProfile);
    };

    return (
        <AuthContext.Provider
            value={{
                user, profile, loading, profileChecked, roles, hasRole, isAdmin, isOfficer,
                login, signup, logout, updateUserProfile, refreshProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
