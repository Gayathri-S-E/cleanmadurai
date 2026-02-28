import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { Globe, Leaf, MapPin, Trophy, ArrowRight, Users, CheckCircle2, Map, Flag } from 'lucide-react';
import styles from './LandingPage.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { PublicPreview } from './PublicPreview';
function LandingPage() {
    const { t, i18n } = useTranslation();
    const { user, hasRole, loading, profileChecked } = useAuth();

    // If Firebase is still resolving, render nothing briefly
    if (loading || !profileChecked) return null;

    // Already logged in → send to the right area
    if (user) {
        if (hasRole(['super_admin', 'corp_admin', 'system_admin'])) return <Navigate to="/admin" replace />;
        if (hasRole(['corp_officer', 'zonal_officer', 'ward_officer', 'sanitation_worker'])) return <Navigate to="/dashboard" replace />;
        return <Navigate to="/home" replace />;
    }



    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'en' ? 'ta' : 'en');
    };

    const isEnglish = i18n.language === 'en';

    const features = [
        {
            icon: <Flag size={28} />,
            title: t('landing.features.report.title'),
            desc: t('landing.features.report.desc'),
            color: 'var(--color-danger)',
            bg: 'rgba(239, 68, 68, 0.08)',
        },
        {
            icon: <Map size={28} />,
            title: t('landing.features.map.title'),
            desc: t('landing.features.map.desc'),
            color: 'var(--color-primary-500)',
            bg: 'rgba(34, 197, 94, 0.08)',
        },
        {
            icon: <ArrowRight size={28} />,
            title: t('landing.features.exchange.title'),
            desc: t('landing.features.exchange.desc'),
            color: 'var(--color-warning)',
            bg: 'rgba(234, 179, 8, 0.08)',
        },
        {
            icon: <Trophy size={28} />,
            title: t('landing.features.leaderboard.title'),
            desc: t('landing.features.leaderboard.desc'),
            color: 'var(--color-secondary)',
            bg: 'rgba(99, 102, 241, 0.08)',
        },
    ];

    const stats = [
        { value: '12,400+', label: t('landing.stats.reports') },
        { value: '38', label: t('landing.stats.wards') },
        { value: '4,200+', label: t('landing.stats.citizens') },
    ];

    return (
        <div className={styles.page}>
            {/* ─── Header ─── */}
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>
                            <Leaf size={20} />
                        </div>
                        <span className={styles.logoName}>Clean Madurai</span>
                    </div>

                    <div className={styles.headerActions}>
                        {/* Language toggle */}
                        <button
                            className={styles.langBtn}
                            onClick={toggleLanguage}
                            aria-label="Toggle language"
                        >
                            <Globe size={15} />
                            <span>{isEnglish ? 'தமிழ்' : 'EN'}</span>
                        </button>

                        <Link to="/login" className={`btn btn-outline ${styles.loginLink}`}>
                            {t('auth.login')}
                        </Link>
                        <Link to="/signup" className={`btn btn-primary ${styles.signupLink}`}>
                            {t('auth.signup')}
                        </Link>
                    </div>
                </div>
            </header>

            {/* ─── Hero ─── */}
            <section className={styles.hero}>
                <div className={styles.heroBg}>
                    <div className={styles.heroBlob1} />
                    <div className={styles.heroBlob2} />
                    <div className={styles.heroGrid} />
                </div>

                <div className={styles.heroContent}>
                    <div className={styles.heroBadge}>
                        <span>🏆</span>
                        <span>{t('landing.hero.badge')}</span>
                    </div>

                    <h1 className={styles.heroTitle}>
                        {t('landing.hero.title1')}
                        <span className={styles.heroTitleAccent}> {t('landing.hero.title2')}</span>
                    </h1>

                    <p className={styles.heroSubtitle}>{t('landing.hero.subtitle')}</p>

                    <div className={styles.heroCtas}>
                        <Link to="/signup" className={`btn btn-primary ${styles.ctaPrimary}`}>
                            {t('landing.hero.cta')}
                            <ArrowRight size={18} />
                        </Link>
                        <Link to="/login" className={`btn btn-outline ${styles.ctaSecondary}`}>
                            {t('auth.login')}
                        </Link>
                    </div>

                    {/* Trust strip */}
                    <div className={styles.trustStrip}>
                        <div className={styles.trustItem}>
                            <CheckCircle2 size={14} />
                            <span>{t('landing.hero.trust1')}</span>
                        </div>
                        <div className={styles.trustItem}>
                            <CheckCircle2 size={14} />
                            <span>{t('landing.hero.trust2')}</span>
                        </div>
                        <div className={styles.trustItem}>
                            <CheckCircle2 size={14} />
                            <span>{t('landing.hero.trust3')}</span>
                        </div>
                    </div>
                </div>

                {/* Hero visual */}
                <div className={styles.heroVisual}>
                    <div className={styles.heroCard}>
                        <div className={styles.heroCardHeader}>
                            <div className={styles.heroCardDot} style={{ background: '#ef4444' }} />
                            <div className={styles.heroCardDot} style={{ background: '#f59e0b' }} />
                            <div className={styles.heroCardDot} style={{ background: '#22c55e' }} />
                        </div>
                        <div className={styles.heroMapMock}>
                            <MapPin size={32} style={{ color: 'var(--color-danger)', filter: 'drop-shadow(0 2px 8px rgba(239,68,68,0.5))' }} />
                            <div className={styles.heroMapLabel}>{t('landing.hero.mapLabel')}</div>
                        </div>
                        <div className={styles.heroCardStats}>
                            <div className={styles.heroStatRow}>
                                <span className={styles.heroStatDot} style={{ background: '#ef4444' }} />
                                <span>{t('landing.hero.statOpen')}</span>
                                <span className={styles.heroStatVal}>24</span>
                            </div>
                            <div className={styles.heroStatRow}>
                                <span className={styles.heroStatDot} style={{ background: '#22c55e' }} />
                                <span>{t('landing.hero.statResolved')}</span>
                                <span className={styles.heroStatVal}>312</span>
                            </div>
                            <div className={styles.heroStatRow}>
                                <span className={styles.heroStatDot} style={{ background: '#f59e0b' }} />
                                <span>{t('landing.hero.statProgress')}</span>
                                <span className={styles.heroStatVal}>8</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Stats ─── */}
            <section className={styles.stats}>
                {stats.map((s) => (
                    <div key={s.label} className={styles.statItem}>
                        <div className={styles.statValue}>{s.value}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </section>

            {/* ─── Features ─── */}
            <section className={styles.features}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{t('landing.features.heading')}</h2>
                    <p className={styles.sectionSubtitle}>{t('landing.features.subheading')}</p>
                </div>

                <div className={styles.featureGrid}>
                    {features.map((f) => (
                        <div key={f.title} className={styles.featureCard}>
                            <div className={styles.featureIconWrap} style={{ background: f.bg, color: f.color }}>
                                {f.icon}
                            </div>
                            <h3 className={styles.featureTitle}>{f.title}</h3>
                            <p className={styles.featureDesc}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Public Preview ─── */}
            <PublicPreview />

            {/* ─── CTA Banner ─── */}
            <section className={styles.ctaBanner}>
                <div className={styles.ctaBannerInner}>
                    <Users size={40} className={styles.ctaBannerIcon} />
                    <h2 className={styles.ctaBannerTitle}>{t('landing.cta.title')}</h2>
                    <p className={styles.ctaBannerSubtitle}>{t('landing.cta.subtitle')}</p>
                    <Link to="/signup" className={`btn btn-primary ${styles.ctaBannerBtn}`}>
                        {t('landing.cta.button')}
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className={styles.footer}>
                <div className={styles.footerInner}>
                    <div className={styles.footerLogo}>
                        <Leaf size={16} />
                        <span>Clean Madurai</span>
                    </div>
                    <p className={styles.footerText}>{t('landing.footer.credit')}</p>
                    <p className={styles.footerSubText}>{t('app.swachhSurvekshan')}</p>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
