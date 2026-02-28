import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

function LoginPage() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            navigate('/home'); // go to app; RootGate/ProtectedRoute handle role or onboarding

        } catch (err: any) {
            setError(err.message ?? 'Login failed. Please try again.');
            toast.error('Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            {/* Left panel – hero */}
            <div className={styles.hero}>
                <div className={styles.heroContent}>
                    <div className={styles.heroBrand}>
                        <div className={styles.heroIcon}>
                            <Leaf size={32} />
                        </div>
                        <span className={styles.heroBrandName}>{t('app.name')}</span>
                    </div>
                    <h1 className={styles.heroTitle}>
                        {t('app.tagline')}
                    </h1>
                    <p className={styles.heroDesc}>
                        {t('app.motto')}
                    </p>
                    <p className={styles.heroSwachh}>{t('app.swachhSurvekshan')}</p>
                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatVal}>100+</div>
                            <div className={styles.heroStatLabel}>Wards</div>
                        </div>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatVal}>10K+</div>
                            <div className={styles.heroStatLabel}>Citizens</div>
                        </div>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatVal}>95%</div>
                            <div className={styles.heroStatLabel}>Resolved</div>
                        </div>
                    </div>
                </div>
                <div className={styles.decor1} />
                <div className={styles.decor2} />
                <div className={styles.decor3} />
            </div>

            {/* Right panel – form */}
            <div className={styles.formPanel}>
                <div className={styles.formBox}>
                    <div className={styles.formHeader}>
                        <h2 className={styles.formTitle}>{t('auth.login')}</h2>
                        <p className={styles.formSubtitle}>Welcome back! Sign in to your account</p>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
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
                            <div className={styles.passwordField}>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className={`input ${error ? 'error' : ''}`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className={styles.eyeBtn}
                                    onClick={() => setShowPassword((v) => !v)}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {error && <div className="form-error" style={{ marginTop: '-8px' }}>{error}</div>}

                        <Link to="/forgot-password" className={styles.forgotLink}>{t('auth.forgotPassword')}</Link>

                        <button
                            type="submit"
                            className="btn btn-primary btn-full btn-lg"
                            disabled={loading}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                            {loading ? 'Signing in...' : t('auth.login')}
                        </button>
                    </form>

                    <div className={styles.dividerRow}>
                        <div className={styles.dividerLine} />
                        <span className={styles.dividerText}>or</span>
                        <div className={styles.dividerLine} />
                    </div>

                    {/* Demo accounts for testing */}
                    <div className={styles.demoSection}>
                        <div className={styles.demoTitle}>⚡ Try Demo Accounts</div>
                        <div className={styles.demoButtons}>
                            {[
                                { label: '🏙️ Citizen', email: 'citizen@demo.in', pwd: 'Demo@1234', role: 'citizen' },
                                { label: '🛡️ Officer', email: 'officer@demo.in', pwd: 'Demo@1234', role: 'corp_officer' },
                                { label: '⚙️ Admin', email: 'admin@demo.in', pwd: 'Demo@1234', role: 'corp_admin' },
                            ].map((d) => (
                                <button
                                    key={d.label}
                                    type="button"
                                    className={`btn btn-outline btn-sm ${styles.demoBtn}`}
                                    disabled={loading}
                                    onClick={async () => {
                                        setEmail(d.email);
                                        setPassword(d.pwd);
                                        setLoading(true);
                                        setError('');
                                        try {
                                            await login(d.email, d.pwd);
                                            navigate('/home');

                                        } catch (err: any) {
                                            setError('Demo account not found. Please run the seed script first.');
                                            toast.error('Demo account not set up yet');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                >
                                    {d.label}
                                    <span className={styles.demoPill}>{d.role.replace('_', ' ')}</span>
                                </button>
                            ))}
                        </div>
                        <div className={styles.demoHint}>
                            All demo accounts use password: <code>Demo@1234</code>
                        </div>
                    </div>

                    <p className={styles.switchText}>
                        {t('auth.dontHaveAccount')}{' '}
                        <Link to="/signup" className={styles.switchLink}>{t('auth.signup')}</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
