import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import './i18n';

// Auth pages (not lazy — needed immediately)
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import OnboardingPage from './features/auth/OnboardingPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import LandingPage from './features/landing/LandingPage';

// Feature pages (lazy loaded)
const HomePage = lazy(() => import('./features/home/HomePage'));
const ReportPage = lazy(() => import('./features/reports/ReportPage'));
const MyReports = lazy(() => import('./features/reports/MyReports'));
const MapPage = lazy(() => import('./features/map/MapPage'));
const WasteExchange = lazy(() => import('./features/waste-exchange/WasteExchange'));
const Leaderboard = lazy(() => import('./features/gamification/Leaderboard'));
const AdoptBlock = lazy(() => import('./features/adopt/AdoptBlock'));
const MaduraiMirror = lazy(() => import('./features/mirror/MaduraiMirror'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const NotificationsList = lazy(() => import('./features/notifications/NotificationsList'));
const DashboardRouter = lazy(() => import('./features/dashboard/DashboardRouter'));
const WasteCrime = lazy(() => import('./features/reports/WasteCrime'));
const TaskCompletion = lazy(() => import('./features/dashboard/sanitation-worker/TaskCompletion'));
const RestroomFinder = lazy(() => import('./features/restroom/RestroomFinder'));
const RestroomManagement = lazy(() => import('./features/restroom/RestroomManagement'));
const EventsPage = lazy(() => import('./features/events/EventsPage'));
const BadgesPage = lazy(() => import('./features/gamification/BadgesPage'));
const RequestBinPage = lazy(() => import('./features/citizen/RequestBinPage'));

function PageLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '40px', height: '40px',
        border: '3px solid var(--color-primary-100)',
        borderTop: '3px solid var(--color-primary-500)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)', fontSize: '14px' }}>
        Loading...
      </span>
    </div>
  );
}

/**
 * Root gate: shown at "/" and "/*" unknown paths.
 * - While Firebase is still resolving auth state → render nothing (brief flicker prevention)
 * - Unauthenticated → show the public Landing page directly (no redirect bounce to /login)
 * - Authenticated → role-based redirect to the right section
 */
function RootGate() {
  const { user, hasRole, loading, profileChecked } = useAuth();
  if (loading || !profileChecked) return null; // wait for auth to resolve
  if (!user) return <LandingPage />;           // unauthenticated → show landing
  if (hasRole(['super_admin', 'corp_admin', 'system_admin'])) return <Navigate to="/admin/overview" replace />;
  if (hasRole(['corp_officer', 'zonal_officer', 'ward_officer', 'sanitation_worker'])) return <Navigate to="/dashboard/queue" replace />;
  return <Navigate to="/home" replace />;
}

/**
 * Blocks admin/officer roles from citizen-only pages (Report, My Reports, etc.).
 * Redirects them to their appropriate home instead.
 */
function CitizenOnlyRoute({ children }: { children: React.ReactNode }) {
  const { hasRole, loading, profileChecked } = useAuth();
  if (loading || !profileChecked) return null;
  if (hasRole(['super_admin', 'corp_admin', 'system_admin'])) return <Navigate to="/admin/overview" replace />;
  if (hasRole(['corp_officer', 'zonal_officer', 'ward_officer', 'sanitation_worker'])) return <Navigate to="/dashboard/queue" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-display)',
              fontWeight: '500',
              fontSize: '14px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
            },
            success: { iconTheme: { primary: 'var(--color-success)', secondary: 'white' } },
            error: { iconTheme: { primary: 'var(--color-danger)', secondary: 'white' } },
          }}
        />

        <Routes>
          {/* Root "/" — landing for guests, role redirect for logged-in users */}
          <Route index element={<RootGate />} />

          {/* Public landing page (bookmarkable) */}
          <Route path="/landing" element={<LandingPage />} />

          {/* Public auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Protected routes — wrapped in AppShell layout */}
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>

            {/* Citizen / shared pages */}
            <Route path="/home" element={<Suspense fallback={<PageLoading />}><HomePage /></Suspense>} />
            <Route path="/home/citizen" element={<Suspense fallback={<PageLoading />}><HomePage /></Suspense>} />
            <Route path="/report" element={<CitizenOnlyRoute><Suspense fallback={<PageLoading />}><ReportPage /></Suspense></CitizenOnlyRoute>} />
            <Route path="/my-reports" element={<CitizenOnlyRoute><Suspense fallback={<PageLoading />}><MyReports /></Suspense></CitizenOnlyRoute>} />
            <Route path="/map" element={<Suspense fallback={<PageLoading />}><MapPage /></Suspense>} />
            <Route path="/leaderboard" element={<Suspense fallback={<PageLoading />}><Leaderboard /></Suspense>} />
            <Route path="/adopt" element={<Suspense fallback={<PageLoading />}><AdoptBlock /></Suspense>} />
            <Route path="/mirror" element={<Suspense fallback={<PageLoading />}><MaduraiMirror /></Suspense>} />
            <Route path="/profile" element={<Suspense fallback={<PageLoading />}><ProfilePage /></Suspense>} />
            <Route path="/notifications" element={<Suspense fallback={<PageLoading />}><NotificationsList /></Suspense>} />
            <Route path="/waste-crime" element={<Suspense fallback={<PageLoading />}><WasteCrime /></Suspense>} />
            <Route path="/restrooms" element={<Suspense fallback={<PageLoading />}><RestroomFinder /></Suspense>} />
            <Route path="/restroom-management" element={<Suspense fallback={<PageLoading />}><RestroomManagement /></Suspense>} />
            <Route path="/events" element={<Suspense fallback={<PageLoading />}><EventsPage /></Suspense>} />
            <Route path="/badges" element={<Suspense fallback={<PageLoading />}><BadgesPage /></Suspense>} />
            <Route path="/request-bin" element={<CitizenOnlyRoute><Suspense fallback={<PageLoading />}><RequestBinPage /></Suspense></CitizenOnlyRoute>} />

            {/* Exchange — business roles only */}
            <Route
              path="/exchange"
              element={
                <ProtectedRoute allowedRoles={['shop_owner', 'hotel_owner', 'market_vendor', 'farmer', 'animal_shelter', 'recycler']}>
                  <Suspense fallback={<PageLoading />}><WasteExchange /></Suspense>
                </ProtectedRoute>
              }
            />

            {/* Officer / Admin dashboards — base routes redirect to default tab */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['corp_officer', 'corp_admin', 'system_admin', 'super_admin', 'zonal_officer', 'ward_officer', 'sanitation_worker']}>
                  <Navigate to="/dashboard/queue" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/:tab"
              element={
                <ProtectedRoute allowedRoles={['corp_officer', 'corp_admin', 'system_admin', 'super_admin', 'zonal_officer', 'ward_officer', 'sanitation_worker']}>
                  <Suspense fallback={<PageLoading />}><DashboardRouter /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/task/:id"
              element={
                <ProtectedRoute allowedRoles={['sanitation_worker']}>
                  <Suspense fallback={<PageLoading />}><TaskCompletion /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['corp_admin', 'system_admin', 'super_admin']}>
                  <Navigate to="/admin/overview" replace />
                </ProtectedRoute>
              }
            />
            {/* Super admin-only tabs: settings, system */}
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <Suspense fallback={<PageLoading />}><DashboardRouter /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/system"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <Suspense fallback={<PageLoading />}><DashboardRouter /></Suspense>
                </ProtectedRoute>
              }
            />
            {/* General admin tabs: overview, kpi, wards, roles, users, zones */}
            <Route
              path="/admin/:tab"
              element={
                <ProtectedRoute allowedRoles={['corp_admin', 'system_admin', 'super_admin']}>
                  <Suspense fallback={<PageLoading />}><DashboardRouter /></Suspense>
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Unknown routes → landing */}
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
