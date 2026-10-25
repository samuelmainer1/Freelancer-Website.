import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import PostJob from './pages/PostJob.jsx';
import JobDetail from './pages/JobDetail.jsx';
import MyJobs from './pages/MyJobs.jsx';
import MyBids from './pages/MyBids.jsx';
import Profile from './pages/Profile.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Freelancers from './pages/Freelancers.jsx';
import Messages, { Inbox } from './pages/Messages.jsx';
import EditJob from './pages/EditJob.jsx';
import BuyConnects from './pages/BuyConnects.jsx';
import { useAuth } from './AuthContext.jsx';

function RequireRole({ role, children }) {
  const { user, booting } = useAuth();
  if (booting) {
    return <div className="grid min-h-[60vh] place-items-center text-slate-400">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/freelancers" element={<Freelancers />} />
          <Route
            path="/jobs/:id/edit"
            element={
              <RequireRole role="client">
                <EditJob />
              </RequireRole>
            }
          />
          <Route
            path="/inbox"
            element={
              <RequireRole>
                <Inbox />
              </RequireRole>
            }
          />
          <Route
            path="/messages/:jobId/:userId"
            element={
              <RequireRole>
                <Messages />
              </RequireRole>
            }
          />
          <Route path="/users/:id" element={<Profile />} />
          <Route
            path="/settings/profile"
            element={
              <RequireRole>
                <EditProfile />
              </RequireRole>
            }
          />
          <Route
            path="/post-job"
            element={
              <RequireRole role="client">
                <PostJob />
              </RequireRole>
            }
          />
          <Route
            path="/my-jobs"
            element={
              <RequireRole role="client">
                <MyJobs />
              </RequireRole>
            }
          />
          <Route
            path="/my-bids"
            element={
              <RequireRole role="freelancer">
                <MyBids />
              </RequireRole>
            }
          />
          <Route
            path="/connects"
            element={
              <RequireRole role="freelancer">
                <BuyConnects />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-400">
        FreelanceHub — post jobs, hire talent, get work done.
      </footer>
    </div>
  );
}
