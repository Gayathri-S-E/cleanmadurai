import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import styles from './AppShell.module.css';
import { WifiOff } from 'lucide-react';

function AppShell() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useAuth();
    const setOnline = useAppStore((s) => s.setOnline);
    const setNotifications = useAppStore((s) => s.setNotifications);
    const isOnline = useAppStore((s) => s.isOnline);

    // Offline queue pending count from localStorage
    const [pendingCount, setPendingCount] = useState(0);
    useEffect(() => {
        try {
            const q = JSON.parse(localStorage.getItem('offlineQueue') ?? '[]');
            setPendingCount(Array.isArray(q) ? q.length : 0);
        } catch {
            setPendingCount(0);
        }
    }, [isOnline]);

    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setOnline]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, `users/${user.uid}/notifications`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        }, (err) => {
            console.error('AppShell notification listen error:', err);
        });
        return () => unsubscribe();
    }, [user, setNotifications]);

    // Close sidebar on route change (mobile)
    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className={styles.shell}>
            {/* Offline Banner */}
            {!isOnline && (
                <div className={styles.offlineBanner}>
                    <WifiOff size={15} />
                    <span>
                        நீங்கள் ஆஃப்லைன் | You are offline
                        {pendingCount > 0 && ` — ${pendingCount} report${pendingCount > 1 ? 's' : ''} pending sync`}
                    </span>
                </div>
            )}

            {/* Sidebar — sticky on desktop, fixed overlay on mobile */}
            <div className={styles.shellBody}>
                <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

                {/* Mobile overlay backdrop */}
                {sidebarOpen && (
                    <div className={styles.overlay} onClick={closeSidebar} />
                )}

                {/* Main area */}
                <div className={styles.main}>
                    <TopBar onMenuClick={() => setSidebarOpen((v) => !v)} />
                    <main className={styles.content}>
                        <Outlet />
                    </main>
                </div>
            </div>

            {/* Mobile bottom nav */}
            <BottomNav />
        </div>
    );
}

export default AppShell;
