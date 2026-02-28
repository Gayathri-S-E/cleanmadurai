import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';
import { Leaf } from 'lucide-react';

function SignupPage() {
    const { t } = useTranslation();
    const { signup } = useAuth();
    const navigate = useNavigate();

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName || !email || !password) return;
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await signup(email, password, displayName);
            navigate('/onboarding');
        } catch (err: any) {
            setError(err.message ?? 'Sign up failed. Please try again.');
            toast.error('Sign up failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            {/* Hero */}
            <div className={styles.hero}>
                <div className={styles.heroContent}>
                    <div className={styles.heroBrand}>
                        <div className={styles.heroIcon}><Leaf size={32} /></div>
                        <span className={styles.heroBrandName}>Clean Madurai</span>
                    </div>
                    <h1 className={styles.heroTitle}>
                        Join the<br />
                        <span className={styles.heroAccent}>Cleanliness</span><br />
                        Movement
                    </h1>
                    <p className={styles.heroDesc}>
                        Over 10,000 citizens are already making Madurai cleaner. Your contribution matters!
                    </p>
                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatVal}>500+</div>
                            <div className={styles.heroStatLabel}>Reports Daily</div>
                        </div>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatVal}>200+</div>
                            <div className={styles.heroStatLabel}>Volunteers</div>
                        </div>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatVal}>50+</div>
                            <div className={styles.heroStatLabel}>Exchange/Day</div>
                        </div>
                    </div>
                </div>
                <div className={styles.decor1} />
                <div className={styles.decor2} />
                <div className={styles.decor3} />
            </div>

            {/* Form */}
            <div className={styles.formPanel}>
                <div className={styles.formBox}>
                    <div className={styles.formHeader}>
                        <h2 className={styles.formTitle}>{t('auth.signup')}</h2>
                        <p className={styles.formSubtitle}>Create your account to get started</p>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className="form-group">
                            <label className="form-label required" htmlFor="name">Full Name</label>
                            <input
                                id="name"
                                type="text"
                                className="input"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Kathir Raja"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label required" htmlFor="email">{t('auth.email')}</label>
                            <input
                                id="email"
                                type="email"
                                className={`input ${error ? 'error' : ''}`}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label required" htmlFor="password">{t('auth.password')}</label>
                            <input
                                id="password"
                                type="password"
                                className={`input ${error ? 'error' : ''}`}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Minimum 8 characters"
                                autoComplete="new-password"
                                required
                                minLength={8}
                            />
                        </div>

                        {error && <div className="form-error">{error}</div>}

                        <button
                            type="submit"
                            className="btn btn-primary btn-full btn-lg"
                            disabled={loading}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className={styles.switchText}>
                        {t('auth.alreadyHaveAccount')}{' '}
                        <Link to="/login" className={styles.switchLink}>{t('auth.login')}</Link>
                    </p>

                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center', marginTop: 'var(--space-4)', lineHeight: 'var(--leading-relaxed)' }}>
                        By signing up, you agree to our Terms of Service. Clean Madurai is not an emergency service — please call 100/108 for emergencies.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;
