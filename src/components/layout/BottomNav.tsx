import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Map, ArrowUpFromLine, Trophy, User, LayoutDashboard, Repeat2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessAdminPanel, canAccessOfficerDashboard, canAccessWasteExchange } from '../../config/navRoles';
import styles from './BottomNav.module.css';

function BottomNav() {
    const { t } = useTranslation();
    const { roles } = useAuth();

    const isOfficerOrAdmin = canAccessAdminPanel(roles) || canAccessOfficerDashboard(roles);
    const showExchange = canAccessWasteExchange(roles);

    // Build the 4 nav slots (excluding the center FAB)
    // Slot order: Left1, Left2, [FAB], Right1, Right2 — Admin Panel only for corp_admin, system_admin, super_admin
    const isAdmin = canAccessAdminPanel(roles);
    const leftSlot2 = isOfficerOrAdmin
        ? { to: isAdmin ? '/admin' : '/dashboard', icon: isAdmin ? <ShieldCheck size={20} /> : <LayoutDashboard size={20} />, label: isAdmin ? 'Admin' : 'Dashboard' }
        : { to: '/map', icon: <Map size={20} />, label: t('nav.map') };

    const rightSlot1 = showExchange
        ? { to: '/exchange', icon: <Repeat2 size={20} />, label: t('nav.exchange') }
        : { to: '/leaderboard', icon: <Trophy size={20} />, label: t('nav.leaderboard') };

    return (
        <nav className={styles.bottomNav}>
            {/* Home */}
            <NavLink to="/home" className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}>
                <div className={styles.iconWrap}>
                    <Home size={20} />
                </div>
                <span className={styles.label}>{t('nav.home')}</span>
            </NavLink>

            {/* Map or Dashboard (for officers/admins) */}
            <NavLink to={leftSlot2.to} className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}>
                <div className={styles.iconWrap}>
                    {leftSlot2.icon}
                </div>
                <span className={styles.label}>{leftSlot2.label}</span>
            </NavLink>

            {/* Center FAB - Report */}
            <NavLink to="/report" className={styles.fab} aria-label="Report an issue">
                <ArrowUpFromLine size={24} />
            </NavLink>

            {/* Leaderboard or Exchange */}
            <NavLink to={rightSlot1.to} className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}>
                <div className={styles.iconWrap}>
                    {rightSlot1.icon}
                </div>
                <span className={styles.label}>{rightSlot1.label}</span>
            </NavLink>

            {/* Profile */}
            <NavLink to="/profile" className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}>
                <div className={styles.iconWrap}>
                    <User size={20} />
                </div>
                <span className={styles.label}>{t('nav.profile')}</span>
            </NavLink>
        </nav>
    );
}

export default BottomNav;
