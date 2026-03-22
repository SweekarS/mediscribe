import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from './BrandMark'

function scrollToHash(hash) {
  const el = document.getElementById(hash)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
    return true
  }
  return false
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  const handleAnchorClick = (e, hash) => {
    e.preventDefault()
    setMobileOpen(false)
    if (location.pathname === '/') {
      scrollToHash(hash)
    } else {
      navigate('/')
      setTimeout(() => scrollToHash(hash), 150)
    }
  }

  const links = [
    { hash: 'patient-experience', label: 'How it works' },
    { hash: 'clinical-insight', label: 'Your visit' },
    { hash: 'trust', label: 'Privacy' },
  ]

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'border-b border-outline-variant/30 bg-surface/95 shadow-sm backdrop-blur-md'
          : 'border-b border-transparent bg-surface/80 backdrop-blur-sm'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 md:px-8">
        <Link to="/" className="flex items-center">
          <BrandMark showWordmark wordmarkClassName="text-xl font-bold tracking-tight text-primary" />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.hash}
              href={`#${link.hash}`}
              onClick={(e) => handleAnchorClick(e, link.hash)}
              className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-on-surface-variant transition-colors hover:text-primary sm:block"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:bg-primary-container hover:opacity-90"
          >
            Launch MediScribe
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high md:hidden"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-[22px]">
              {mobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-outline-variant/20 bg-surface/98 px-6 pb-6 pt-4 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((link) => (
              <a
                key={link.hash}
                href={`#${link.hash}`}
                onClick={(e) => handleAnchorClick(e, link.hash)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/login"
              className="mt-2 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
