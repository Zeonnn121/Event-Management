import { Navigate, Routes, Route } from 'react-router-dom';
import { useAuth } from './stores/auth';

// Pages
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import EventsPage from './pages/Events';
import EventDetailPage from './pages/EventDetail';
import CreateEventPage from './pages/CreateEvent';
import EditEventPage from './pages/EditEvent';
import ParticipantsPage from './pages/Participants';
import CreateParticipantPage from './pages/CreateParticipant';
import ParticipantDetailPage from './pages/ParticipantDetail';
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
        <Route path="/events/new" element={<ProtectedRoute element={<CreateEventPage />} />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/events/:id/edit" element={<ProtectedRoute element={<EditEventPage />} />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/participants/new" element={<ProtectedRoute element={<CreateParticipantPage />} />} />
        <Route path="/participants/:id" element={<ParticipantDetailPage />} />
        <Route path="/certificates" element={<CertificatesPage />} />
        <Route path="/users" element={<ProtectedRoute element={<UsersPage />} adminOnly />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
