import { Bell, Globe, Menu, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAppStore } from '../../store/useAppStore';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import styles from './TopBar.module.css';

interface TopBarProps {
    onMenuClick?: () => void;
}

function TopBar({ onMenuClick }: TopBarProps) {
    const { t, i18n } = useTranslation();
    const { profile } = useAuth();
    const { unreadCount, festivalModeActive } = useAppStore();
    const { pendingCount } = useOfflineQueue();
    const isOnline = useAppStore((s) => s.isOnline);

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'en' ? 'ta' : 'en');
    };

    return (
        <header className={`${styles.topbar} ${festivalModeActive ? styles.festivalMode : ''}`}>
            {/* Mobile menu button */}
            <button className={`${styles.menuBtn} btn btn-ghost btn-icon`} onClick={onMenuClick}>
                <Menu size={20} />
            </button>

            {/* Page title / breadcrumb area */}
            <div className={styles.center}>
                {festivalModeActive && (
                    <div className={styles.festivalBadge}>
                        🎊 Festival Mode Active
                    </div>
                )}
            </div>

            {/* Right actions */}
            <div className={styles.actions}>
                {/* Offline indicator */}
                {!isOnline && (
                    <div className={styles.offlineChip}>
                        <WifiOff size={12} />
                        <span>Offline</span>
                    </div>
                )}

                {/* Pending sync count */}
                {pendingCount > 0 && (
                    <div className={styles.syncChip}>
                        {pendingCount} pending
                    </div>
                )}

                {/* Language toggle */}
                <button className={`btn btn-ghost btn-icon-sm ${styles.langBtn}`} onClick={toggleLanguage}>
                    <Globe size={16} />
                    <span className={styles.langCode}>{i18n.language.toUpperCase()}</span>
                </button>

                {/* Notifications */}
                <Link to="/notifications" className={`btn btn-ghost btn-icon ${styles.notifBtn}`}>
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className={styles.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                </Link>
            </div>
        </header>
    );
}

export default TopBar;
