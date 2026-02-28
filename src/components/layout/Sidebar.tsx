import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
    Home, Map, ArrowUpFromLine, Repeat2, MapPin, Trophy,
    LayoutDashboard, Settings, Users, LogOut, ChevronRight,
    Leaf, ShieldCheck, Globe, ChevronDown, ChevronUp,
    BarChart3, Building2, Flag, AlertTriangle, Brain, Smile,
    List, Star, UserCog, FileText, Layers,
} from 'lucide-react';

import { getVisibleNavSections, type NavIconId } from '../../config/navRoles';
import styles from './Sidebar.module.css';

const NAV_ICONS: Record<NavIconId, React.ReactNode> = {
    // citizen / shared
    home: <Home size={18} />,
    report: <ArrowUpFromLine size={18} />,
    map: <Map size={18} />,
    exchange: <Repeat2 size={18} />,
    adopt: <MapPin size={18} />,
    leaderboard: <Trophy size={18} />,
    // admin panel sections
    admin: <ShieldCheck size={18} />,
    admin_overview: <BarChart3 size={18} />,
    admin_kpi: <Star size={18} />,
    admin_wards: <Building2 size={18} />,
    admin_roles: <ShieldCheck size={18} />,
    admin_users: <Users size={18} />,
    admin_zones: <Flag size={18} />,
    admin_reports: <FileText size={18} />,
    admin_blocks: <Layers size={18} />,
    admin_settings: <Settings size={18} />,
    admin_system: <UserCog size={18} />,
    // officer dashboard sections
    dashboard: <LayoutDashboard size={18} />,
    officer_dashboard: <LayoutDashboard size={18} />,
    officer_queue: <AlertTriangle size={18} />,
    officer_predictions: <Brain size={18} />,
    officer_workers: <Smile size={18} />,
    // bottom bar
    profile: <Users size={18} />,
    settings: <Settings size={18} />,
    logout: <LogOut size={18} />,
};

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const { t, i18n } = useTranslation();
    const { profile, roles, logout } = useAuth();
    const navigate = useNavigate();

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'en' ? 'ta' : 'en');
    };

    const isEnglish = i18n.language === 'en';

    const sections = getVisibleNavSections(roles);

    // All sections expanded by default
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
        () => Object.fromEntries(sections.map((s) => [s.sectionKey, true]))
    );

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            {/* Logo */}
            <div className={styles.logo}>
                <div className={styles.logoIcon}>
                    <Leaf size={22} />
                </div>
                <div className={styles.logoText}>
                    <span className={styles.logoName}>Clean</span>
                    <span className={styles.logoCity}>Madurai</span>
                </div>
            </div>

            {/* User info */}
            {profile && (
                <div className={styles.userCard} onClick={() => { navigate('/profile'); onClose?.(); }}>
                    <div className={styles.avatar}>
                        {profile.photoURL ? (
                            <img src={profile.photoURL} alt={profile.displayName} />
                        ) : (
                            profile.displayName?.charAt(0)?.toUpperCase() ?? '?'
                        )}
                    </div>
                    <div className={styles.userInfo}>
                        <div className={styles.userName}>{profile.displayName}</div>
                        <div className={styles.userRole}>{profile.roles?.[0]?.replace('_', ' ')}</div>
                    </div>
                    <ChevronRight size={14} className={styles.chevron} />
                </div>
            )}

            <div className={styles.divider} />

            {/* Navigation — collapsible sections, role-filtered */}
            <nav className={styles.nav}>
                {sections.map((section) => {
                    const isExpanded = expandedSections[section.sectionKey] ?? true;
                    return (
                        <div key={section.sectionKey} className={styles.navSection}>
                            {/* Section header — only shown when there are items AND section label is meaningful */}
                            <button
                                className={styles.sectionHeader}
                                onClick={() => toggleSection(section.sectionKey)}
                                aria-expanded={isExpanded}
                            >
                                <span className={styles.sectionLabel}>{section.label}</span>
                                <span className={styles.sectionChevron}>
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </span>
                            </button>

                            {/* Section items */}
                            {isExpanded && (
                                <div className={styles.sectionItems}>
                                    {section.items.map((item) => (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            onClick={onClose}
                                            className={({ isActive }) =>
                                                `${styles.navItem} ${isActive ? styles.navActive : ''}`
                                            }
                                        >
                                            <span className={styles.navIcon}>{NAV_ICONS[item.iconId]}</span>
                                            <span className={styles.navLabel}>{t(item.labelKey)}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div className={styles.spacer} />

            {/* Bottom actions — Profile, Settings, Logout (always visible for authenticated users) */}
            <div className={styles.sidebarBottom}>
                <NavLink
                    to="/profile"
                    onClick={onClose}
                    className={({ isActive }) =>
                        `${styles.navItem} ${isActive ? styles.navActive : ''}`
                    }
                >
                    <span className={styles.navIcon}>{NAV_ICONS.profile}</span>
                    <span className={styles.navLabel}>{t('nav.profile')}</span>
                </NavLink>
                <NavLink
                    to="/settings"
                    onClick={onClose}
                    className={({ isActive }) =>
                        `${styles.navItem} ${isActive ? styles.navActive : ''}`
                    }
                >
                    <span className={styles.navIcon}>{NAV_ICONS.settings}</span>
                    <span className={styles.navLabel}>{t('nav.settings')}</span>
                </NavLink>
                <button className={`${styles.navItem} ${styles.logoutBtn}`} onClick={() => { handleLogout(); onClose?.(); }}>
                    <span className={styles.navIcon}>{NAV_ICONS.logout}</span>
                    <span className={styles.navLabel}>{t('auth.logout')}</span>
                </button>
                {/* Language toggle */}
                <button
                    className={styles.navItem}
                    onClick={toggleLanguage}
                    title={isEnglish ? 'Switch to Tamil' : 'Switch to English'}
                    style={{ marginTop: '4px' }}
                >
                    <span className={styles.navIcon}><Globe size={18} /></span>
                    <span className={styles.navLabel}>{isEnglish ? 'தமிழ்' : 'English'}</span>
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;
