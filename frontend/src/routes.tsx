import { Navigate, Routes, Route } from 'react-router-dom';
import { useAuth } from './stores/auth';
import type { Role } from './lib/types';

// Pages
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
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
import CouncilsPage from './pages/Councils';
import ApprovalsPage from './pages/Approvals';
import MyEventsPage from './pages/MyEvents';
import MyInfoPage from './pages/MyInfo';
import NotFoundPage from './pages/NotFound';
import { AppShell } from './components/AppShell';

function ProtectedRoute({
  element,
  roles,
}: {
  element: React.ReactNode;
  roles?: Role[];
}) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to="/" replace />;
  }
  return element;
}

export function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={user ? <AppShell /> : <Navigate to="/login" replace />}
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/new" element={<ProtectedRoute roles={['super_admin', 'council_lead']} element={<CreateEventPage />} />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/events/:id/edit" element={<ProtectedRoute roles={['super_admin', 'council_lead']} element={<EditEventPage />} />} />
        <Route path="/my-events" element={<ProtectedRoute roles={['super_admin', 'council_lead', 'council_member']} element={<MyEventsPage />} />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/participants/new" element={<ProtectedRoute roles={['super_admin', 'council_lead']} element={<CreateParticipantPage />} />} />
        <Route path="/participants/:id" element={<ParticipantDetailPage />} />
        <Route path="/certificates" element={<CertificatesPage />} />
        <Route path="/users" element={<ProtectedRoute roles={['super_admin', 'council_lead']} element={<UsersPage />} />} />
        <Route path="/councils" element={<ProtectedRoute roles={['super_admin']} element={<CouncilsPage />} />} />
        <Route path="/approvals" element={<ProtectedRoute roles={['super_admin']} element={<ApprovalsPage />} />} />
        <Route path="/my-info" element={<MyInfoPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
