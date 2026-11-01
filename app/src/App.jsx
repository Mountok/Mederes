import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/useAuth.jsx'
import Navbar from './components/Navbar.jsx'
import MobileTabBar from './components/MobileTabBar.jsx'
import AiTestPage from './pages/AiTestPage.jsx'
import ForbiddenPage from './pages/ForbiddenPage.jsx'
import GroupDetailsPage from './pages/GroupDetailsPage.jsx'
import GroupJournalPage from './pages/GroupJournalPage.jsx'
import GroupsPage from './pages/GroupsPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LessonPage from './pages/LessonPage.jsx'
import LiveUnavailablePage from './pages/LiveUnavailablePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import HomeworkPage, { HomeworkDetailPage } from './pages/HomeworkPage.jsx'
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
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return (
    <>
      {!online && <div className="app-offline-banner" role="status">Нет сети. Задания и распознавание будут доступны после подключения.</div>}
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/ai-test" element={<AiTestPage />} />
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
          <Route path="/homework" element={<HomeworkPage />} />
          <Route path="/homework/:id" element={<HomeworkDetailPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/live" element={<LiveUnavailablePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <MobileTabBar />
    </>
  )
}

export default App
