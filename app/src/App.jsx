import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/useAuth.jsx'
import Navbar from './components/Navbar.jsx'
import ForbiddenPage from './pages/ForbiddenPage.jsx'
import GroupDetailsPage from './pages/GroupDetailsPage.jsx'
import GroupJournalPage from './pages/GroupJournalPage.jsx'
import GroupsPage from './pages/GroupsPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LessonPage from './pages/LessonPage.jsx'
import LiveUnavailablePage from './pages/LiveUnavailablePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import QuranPage from './pages/QuranPage.jsx'
import StaffPage from './pages/StaffPage.jsx'

function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/live/join" element={<LiveUnavailablePage />} />
      <Route path="/live/:id" element={<LiveUnavailablePage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/group/:id" element={<GroupDetailsPage />} />
          <Route path="/group/:id/journal" element={<GroupJournalPage />} />
          <Route path="/lesson/:id" element={<LessonPage />} />
          <Route path="/quran" element={<QuranPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/live" element={<LiveUnavailablePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
