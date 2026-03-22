import { NavLink, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import BrandMark from './BrandMark'

const navItems = [
  { icon: 'graphic_eq', label: 'Live session', to: '/dashboard', end: true },
  { icon: 'record_voice_over', label: 'Real-Time Talk', to: '/dashboard/talk' },
  { icon: 'history', label: 'Past visits', to: '/dashboard/history' },
  { icon: 'person', label: 'My info', to: '/dashboard/patients' },
  { icon: 'settings', label: 'Settings', to: '/dashboard/settings' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const handleStartVisit = () => {
    navigate('/dashboard')
    showToast('Pick Remote visit or Solo demo, then start your session.')
  }

  const handleSupport = () => {
    showToast('Support: help@mediscribe.demo')
    window.location.href = 'mailto:help@mediscribe.demo?subject=MediScribe%20Support'
  }

  const handleSignOut = () => {
    showToast('Signed out.')
    navigate('/')
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-outline-variant/30 bg-surface-container">
      <div className="flex h-full flex-col gap-2 p-4">
        {/* Logo */}
        <div className="px-3 py-6">
          <Link to="/" className="flex items-center">
            <BrandMark showWordmark wordmarkClassName="text-lg font-black tracking-tighter text-primary" />
          </Link>
        </div>

        {/* User profile chip */}
        <div className="mb-4 flex items-center gap-3 rounded-lg px-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-primary-container text-on-primary-container">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-on-surface">Hung N.</span>
            <span className="text-xs text-outline">Patient</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-surface-container-lowest text-primary-container shadow-sm'
                    : 'text-outline hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Start listening CTA */}
        <div className="mt-auto px-2">
          <button
            type="button"
            onClick={handleStartVisit}
            className="clinical-gradient mb-6 w-full rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition-transform duration-200 active:scale-[0.98]"
          >
            Start listening
          </button>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col gap-1 border-t border-outline-variant/20 pt-3">
          <button
            type="button"
            onClick={handleSupport}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-outline transition-all hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
            <span>Get help</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-outline transition-all hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
