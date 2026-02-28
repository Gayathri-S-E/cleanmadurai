import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
    fallbackPath?: string;
}

function ProtectedRoute({ children, allowedRoles, fallbackPath = '/landing' }: ProtectedRouteProps) {
    const { user, profile, loading, profileChecked, hasRole } = useAuth();

    // Still loading auth state or still fetching Firestore profile
    if (loading || !profileChecked) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '16px' }}>
                <Loader2 size={32} style={{ color: 'var(--color-primary-500)', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>Loading...</p>
            </div>
        );
    }

    // Not authenticated at all
    if (!user) return <Navigate to={fallbackPath} replace />;

    // Profile confirmed missing (user is authenticated but has no Firestore doc → new user)
    if (!profile) return <Navigate to="/onboarding" replace />;

    // Profile exists but user lacks the required role for this page
    if (allowedRoles && !hasRole(allowedRoles)) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '32px' }}>
                <div style={{ fontSize: '3rem' }}>🔒</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)' }}>Access Restricted</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
                    You don't have permission to view this page. Your role ({profile?.roles?.join(', ') || 'pending'}) doesn't include this feature.
                </p>
                <a href="/home" className="btn btn-outline">Go Home</a>
            </div>
        );
    }

    return <>{children}</>;
}

export default ProtectedRoute;
