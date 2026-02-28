import { useLocation } from 'react-router-dom';
import OfficerDashboard from './corp-officer/OfficerDashboard';
import AdminDashboard from './corp-admin/AdminDashboard';

/**
 * Renders AdminDashboard for /admin/* routes,
 * OfficerDashboard for /dashboard/* routes.
 * ProtectedRoute in App.tsx gates these routes by role.
 */
function DashboardRouter() {
    const location = useLocation();

    if (location.pathname.startsWith('/admin')) {
        return <AdminDashboard />;
    }

    return <OfficerDashboard />;
}

export default DashboardRouter;
