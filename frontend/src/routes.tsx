import { Navigate, Routes, Route } from 'react-router-dom';
import { useAuth } from './stores/auth';

// Pages
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import EventsPage from './pages/Events';
import EventDetailPage from './pages/EventDetail';
import ParticipantsPage from './pages/Participants';
import CertificatesPage from './pages/Certificates';
import UsersPage from './pages/Users';
import NotFoundPage from './pages/NotFound';
import { AppShell } from './components/AppShell';

function ProtectedRoute({ element, adminOnly }: { element: React.ReactNode; adminOnly?: boolean }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/" replace />;
  return element;
}

export function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={user ? <AppShell /> : <Navigate to="/login" replace />}
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/certificates" element={<CertificatesPage />} />
        <Route path="/users" element={<ProtectedRoute element={<UsersPage />} adminOnly />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
