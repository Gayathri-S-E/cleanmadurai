import { useLocation } from 'react-router-dom';
import OfficerDashboard from './corp-officer/OfficerDashboard';
import AdminDashboard from './corp-admin/AdminDashboard';
import WorkerDashboard from './sanitation-worker/WorkerDashboard';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Renders AdminDashboard for /admin/* routes,
 * WorkerDashboard for sanitation workers,
 * OfficerDashboard for /dashboard/* routes.
 * ProtectedRoute in App.tsx gates these routes by role.
 */
function DashboardRouter() {
    const location = useLocation();
    const { hasRole } = useAuth();

    if (location.pathname.startsWith('/admin')) {
        return <AdminDashboard />;
    }

    if (hasRole('sanitation_worker')) {
        return <WorkerDashboard />;
    }

    return <OfficerDashboard />;
}

export default DashboardRouter;
