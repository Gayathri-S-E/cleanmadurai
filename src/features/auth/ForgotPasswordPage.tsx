import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Leaf, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebase';
import styles from './AuthPage.module.css';

function ForgotPasswordPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) {
            setError('Please enter your email address');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await sendPasswordResetEmail(auth, trimmed);
            setSent(true);
            toast.success('Password reset email sent! Check your inbox.');
        } catch (err: any) {
            const code = err?.code ?? '';
            let msg = 'Failed to send reset email. Please try again.';
            if (code === 'auth/user-not-found') {
                // Don't reveal whether email exists — show generic success
                setSent(true);
                toast.success('If that email is registered, a reset link has been sent.');
                return;
            } else if (code === 'auth/invalid-email') {
                msg = 'Invalid email address.';
            } else if (code === 'auth/too-many-requests') {
                msg = 'Too many requests. Please wait a moment and try again.';
            }
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.hero}>
                <div className={styles.heroContent}>
                    <div className={styles.heroBrand}>
                        <div className={styles.heroIcon}>
                            <Leaf size={32} />
                        </div>
                        <span className={styles.heroBrandName}>Clean Madurai</span>
                    </div>
                    <h1 className={styles.heroTitle}>
                        Reset your<br />
                        <span className={styles.heroAccent}>Password</span>
                    </h1>
                    <p className={styles.heroDesc}>
                        Enter your account email and we'll send you a secure password reset link.
                    </p>
                </div>
                <div className={styles.decor1} />
                <div className={styles.decor2} />
                <div className={styles.decor3} />
            </div>

            <div className={styles.formPanel}>
                <div className={styles.formBox}>
                    <div className={styles.formHeader}>
                        <h2 className={styles.formTitle}>
                            {t('auth.forgotPassword')}
                        </h2>
                        <p className={styles.formSubtitle}>
                            {sent
                                ? `We sent a reset link to ${email}. Check your inbox (and spam folder).`
                                : "Enter the email linked to your account and we'll send a reset link."}
                        </p>
                    </div>

                    {sent ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            padding: 'var(--space-6) 0',
                        }}>
                            <CheckCircle2 size={56} color="var(--color-success)" strokeWidth={1.5} />
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '14px' }}>
                                Didn't receive it? Check your spam folder or{' '}
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ display: 'inline', padding: 0 }}
                                    onClick={() => setSent(false)}
                                >
                                    try again
                                </button>.
                            </p>
                            <button
                                className="btn btn-primary btn-full"
                                onClick={() => navigate('/login')}
                            >
                                Back to Sign In
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleRequestReset} className={styles.form}>
                            <div className="form-group">
                                <label className="form-label required" htmlFor="forgot-email">
                                    {t('auth.email')}
                                </label>
                                <input
                                    id="forgot-email"
                                    type="email"
                                    className={`input ${error ? 'error' : ''}`}
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                />
                            </div>
                            {error && <div className="form-error">{error}</div>}
                            <button
                                type="submit"
                                className="btn btn-primary btn-full btn-lg"
                                disabled={loading}
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                    )}

                    <p className={styles.switchText} style={{ marginTop: 'var(--space-6)' }}>
                        <Link to="/login" className={styles.switchLink} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <ArrowLeft size={16} /> Back to {t('auth.login')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;
