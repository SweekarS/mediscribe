import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SimpleModal from '../components/SimpleModal'
import BrandMark from '../components/BrandMark'
import { useToast } from '../context/ToastContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      showToast('Please enter your email and password.')
      return
    }
    navigate('/dashboard')
  }

  const handleContinueAsGuest = () => {
    showToast('Continuing as guest. Some account features are limited (demo).')
    navigate('/dashboard')
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-surface text-on-surface md:flex-row">
      {/* ── Left branded panel ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 md:flex md:w-1/2 lg:w-3/5">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-secondary-container opacity-20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-primary-container opacity-30 blur-[150px]" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-sm">
              <BrandMark bare size="md" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">MediScribe</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="mb-6 text-5xl font-bold leading-[1.1] tracking-tight text-white lg:text-6xl">
            Never miss a word <br />
            your doctor <span className="text-secondary-container">says.</span>
          </h1>
          <p className="text-lg font-medium leading-relaxed text-on-primary-container opacity-90">
            Real-time translation that helps you understand your care — clearly, accurately, and in your own language.
          </p>
        </div>

        <div className="relative z-10 flex gap-12 border-t border-white/10 pt-8">
          <div>
            <div className="text-2xl font-bold text-secondary-container">100+</div>
            <div className="text-xs font-bold uppercase tracking-widest text-on-primary-container">Languages supported</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-secondary-container">Private</div>
            <div className="text-xs font-bold uppercase tracking-widest text-on-primary-container">End-to-end encrypted</div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center bg-surface-container p-6 md:p-12 lg:p-24">
        <div className="w-full max-w-md">
          <div className="mb-12 flex items-center gap-2 md:hidden">
            <BrandMark size="sm" />
            <span className="text-xl font-black tracking-tighter text-on-surface">MediScribe</span>
          </div>

          <div className="rounded-2xl bg-surface-container-lowest p-8 shadow-[0px_20px_40px_rgba(25,28,29,0.04)] lg:p-10">
            <div className="mb-10">
              <h2 className="mb-2 text-2xl font-bold tracking-tight text-on-surface">Sign in to your visit</h2>
              <p className="text-sm text-on-surface-variant">Enter your details to access your care dashboard.</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-[0.6875rem] font-bold uppercase tracking-wider text-outline">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full rounded-lg border-0 border-b-2 border-transparent bg-surface-container-low px-4 py-3.5 text-on-surface transition-all placeholder:text-outline/50 focus:border-primary focus:outline-none focus:ring-0"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-[0.6875rem] font-bold uppercase tracking-wider text-outline">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-[0.6875rem] font-bold text-primary hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border-0 border-b-2 border-transparent bg-surface-container-low px-4 py-3.5 text-on-surface transition-all placeholder:text-outline/50 focus:border-primary focus:outline-none focus:ring-0"
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  className="clinical-gradient flex w-full items-center justify-center gap-2 rounded-lg px-6 py-4 font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <span>Sign in</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
                <button
                  type="button"
                  onClick={handleContinueAsGuest}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-outline-variant/40 bg-transparent px-6 py-3.5 text-sm font-bold text-on-surface transition-colors hover:border-primary/50 hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-[18px] text-outline">person_outline</span>
                  Continue as guest
                </button>
              </div>

              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-outline-variant/30" />
                <span className="mx-4 shrink-0 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
                  Or continue with
                </span>
                <div className="flex-grow border-t border-outline-variant/30" />
              </div>

              <button
                type="button"
                onClick={() => showToast('Demo mode: Google sign-in is not connected.')}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-surface-container-highest px-6 py-3.5 font-bold text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </form>

            <div className="mt-8 border-t border-outline-variant/20 pt-8 text-center">
              <p className="text-sm text-on-surface-variant">
                Need an account?{' '}
                <a href="mailto:support@mediscribe.demo" className="font-bold text-primary hover:underline">
                  Contact your care team
                </a>
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 opacity-40">
            <div className="flex items-center gap-1.5 grayscale">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span className="text-[0.625rem] font-bold uppercase tracking-widest">End-to-end Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5 grayscale">
              <span className="material-symbols-outlined text-[16px]">lock_person</span>
              <span className="text-[0.625rem] font-bold uppercase tracking-widest">Private &amp; Secure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating pill (desktop only) */}
      <div className="absolute bottom-12 left-1/2 z-20 hidden -translate-x-1/2 lg:block">
        <div className="flex max-w-xs items-center gap-4 rounded-xl border border-white/20 bg-surface/70 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container">
            <span className="material-symbols-outlined text-on-secondary-container">hearing</span>
          </div>
          <div>
            <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-outline">Live Translation</div>
            <div className="text-sm font-bold text-on-surface">Ready when you are</div>
          </div>
          <div className="ml-auto flex gap-1">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
          </div>
        </div>
      </div>

      <SimpleModal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Reset password">
        <p>
          Please contact your care team or the clinic front desk to reset your password. They can help you get back
          into your account.
        </p>
        <a href="mailto:support@mediscribe.demo" className="mt-4 inline-block font-bold text-primary hover:underline">
          support@mediscribe.demo
        </a>
      </SimpleModal>
    </div>
  )
}
