import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Skeleton } from './components/motion.jsx';
import HomePage from './pages/HomePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import JobsPage from './pages/JobsPage.jsx';
import JobDetailPage from './pages/JobDetailPage.jsx';
import ResumePage from './pages/ResumePage.jsx';
import ApplicationsPage from './pages/ApplicationsPage.jsx';
import ApplicationWorkspacePage from './pages/ApplicationWorkspacePage.jsx';
import LearningPage from './pages/LearningPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="content"><Skeleton /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="resume" element={<ResumePage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="applications/:id" element={<ApplicationWorkspacePage />} />
        <Route path="learning" element={<LearningPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
