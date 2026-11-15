import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/useAuth.jsx'
import Navbar from './components/Navbar.jsx'
import MobileNavigation, { MobileNavigationProvider } from './components/MobileNavigation.jsx'
import AiTestPage from './pages/AiTestPage.jsx'
import ForbiddenPage from './pages/ForbiddenPage.jsx'
import ForSchoolsPage from './pages/ForSchoolsPage.jsx'
import GroupDetailsPage from './pages/GroupDetailsPage.jsx'
import GroupJournalPage from './pages/GroupJournalPage.jsx'
import GroupsPage from './pages/GroupsPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import { ConsentPage, OperatorPage, PrivacyPage, TermsPage } from './pages/LegalPage.jsx'
import LessonPage from './pages/LessonPage.jsx'
import LiveUnavailablePage from './pages/LiveUnavailablePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ReaderAuthPage from './pages/ReaderAuthPage.jsx'
import ReaderAccountPage from './pages/ReaderAccountPage.jsx'
import HomeworkPage, { HomeworkDetailPage } from './pages/HomeworkPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PlatformPage from './pages/PlatformPage.jsx'
import QuranPage from './pages/QuranPage.jsx'
import StaffPage from './pages/StaffPage.jsx'

function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.role === 'reader') return <Navigate to="/practice" replace />

  if (user.role === 'platform_admin' && location.pathname !== '/platform') {
    return <Navigate to="/platform" replace />
  }

  return <Outlet />
}

function ReadingRoute() {
  const { user } = useAuth()
  const location = useLocation()
  return user ? <AiTestPage /> : <Navigate to={new URLSearchParams(location.search).has('assignment') ? '/login' : '/reader'} replace state={{ from: location }} />
}

function ReaderAccountRoute() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/reader" replace />
  if (user.role !== 'reader') return <Navigate to={user.role === 'platform_admin' ? '/platform' : '/groups'} replace />
  return <ReaderAccountPage />
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

function PlatformRoute() {
  const { user } = useAuth()
  return user?.role === 'platform_admin' ? <Outlet /> : <Navigate to="/forbidden" replace />
}

function App() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return (
    <MobileNavigationProvider>
      {!online && <div className="app-offline-banner" role="status">Нет сети. Задания и распознавание будут доступны после подключения.</div>}
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/legal" element={<OperatorPage />} />
      <Route path="/for-schools" element={<ForSchoolsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/consent" element={<ConsentPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/practice" element={<ReadingRoute />} />
      <Route path="/ai-test" element={<ReadingRoute />} />
      <Route path="/reader" element={<ReaderAuthPage />} />
      <Route path="/account" element={<ReaderAccountRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/live/join" element={<LiveUnavailablePage />} />
      <Route path="/live/:id" element={<LiveUnavailablePage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<PlatformRoute />}>
          <Route path="/platform" element={<PlatformPage />} />
        </Route>
        <Route element={<AppLayout />}>
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/group/:id" element={<GroupDetailsPage />} />
          <Route path="/group/:id/journal" element={<GroupJournalPage />} />
          <Route path="/lesson/:id" element={<LessonPage />} />
          <Route path="/quran" element={<QuranPage />} />
          <Route path="/homework" element={<HomeworkPage />} />
          <Route path="/homework/:id" element={<HomeworkDetailPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/live" element={<LiveUnavailablePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <MobileNavigation />
    </MobileNavigationProvider>
  )
}

export default App
