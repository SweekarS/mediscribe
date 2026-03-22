import { Routes, Route, Link } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './layouts/DashboardLayout'
import LiveConsultation from './pages/dashboard/LiveConsultation'
import RealTimeTalk from './pages/dashboard/RealTimeTalk'
import HistoryPage from './pages/dashboard/HistoryPage'
import PatientsPage from './pages/dashboard/PatientsPage'
import SettingsPage from './pages/dashboard/SettingsPage'
import BrandMark from './components/BrandMark'

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-6 text-center">
      <BrandMark size="xl" />
      <h1 className="text-6xl font-black tracking-tighter text-primary">404</h1>
      <p className="max-w-md text-lg text-on-surface-variant">
        This page doesn't exist. Let's get you back to your care dashboard.
      </p>
      <div className="flex gap-4">
        <Link to="/" className="rounded-lg border-2 border-outline-variant/40 px-6 py-3 font-bold text-on-surface transition hover:border-primary/50">
          Home
        </Link>
        <Link to="/dashboard" className="clinical-gradient rounded-lg px-6 py-3 font-bold text-white shadow-sm">
          Dashboard
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<LiveConsultation />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="talk" element={<RealTimeTalk />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
