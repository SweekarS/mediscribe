import { Link } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import BrandMark from './BrandMark'

export default function Footer() {
  const { showToast } = useToast()

  return (
    <footer className="dark-section px-8 pb-12 pt-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 grid grid-cols-1 gap-12 md:grid-cols-12">
          {/* Brand column */}
          <div className="md:col-span-4">
            <div className="mb-6">
              <BrandMark
                size="lg"
                variant="onDark"
                showWordmark
                wordmarkClassName="text-2xl font-black text-white"
              />
            </div>
            <p className="mb-8 max-w-xs font-medium leading-relaxed text-white/60">
              Understand every word your doctor says, in the language you think in.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => showToast('Share link copied (demo).')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white"
                aria-label="Share"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
              </button>
            </div>
          </div>

          {/* Help column */}
          <div className="md:col-span-2">
            <h4 className="mb-6 text-xs font-bold uppercase tracking-widest text-white/80">Help</h4>
            <ul className="space-y-4 text-sm font-medium text-white/60">
              <li>
                <button type="button" onClick={() => showToast('Get help — demo.')} className="text-left transition-colors hover:text-white">
                  Get help
                </button>
              </li>
              <li>
                <button type="button" onClick={() => showToast('How it works — demo.')} className="text-left transition-colors hover:text-white">
                  How it works
                </button>
              </li>
              <li>
                <a href="mailto:support@mediscribe.demo" className="transition-colors hover:text-white">
                  Contact us
                </a>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div className="md:col-span-2">
            <h4 className="mb-6 text-xs font-bold uppercase tracking-widest text-white/80">Legal</h4>
            <ul className="space-y-4 text-sm font-medium text-white/60">
              <li>
                <button type="button" onClick={() => showToast('Privacy policy — full text coming soon (demo).')} className="text-left transition-colors hover:text-white">
                  Privacy
                </button>
              </li>
              <li>
                <button type="button" onClick={() => showToast('Accessibility statement — demo.')} className="text-left transition-colors hover:text-white">
                  Accessibility
                </button>
              </li>
              <li>
                <button type="button" onClick={() => showToast('Terms of use — demo.')} className="text-left transition-colors hover:text-white">
                  Terms of use
                </button>
              </li>
            </ul>
          </div>

          {/* CTA card */}
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-8 backdrop-blur-sm md:col-span-4">
            <h4 className="mb-3 text-lg font-black text-white">Take control of your health today</h4>
            <p className="mb-6 text-sm font-medium leading-relaxed text-white/60">
              Don&apos;t just listen — truly understand with MediScribe.
            </p>
            <Link
              to="/login"
              className="mb-5 block w-full rounded-lg bg-primary py-3.5 text-center font-bold text-white shadow-sm transition-opacity hover:bg-primary-container hover:opacity-90"
            >
              Launch MediScribe
            </Link>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
              Your data is protected end-to-end
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-[10px] font-bold uppercase tracking-widest text-white/40 md:flex-row">
          <div>&copy; {new Date().getFullYear()} MediScribe. All rights reserved.</div>
          <div className="flex flex-wrap justify-center gap-8">
            <button type="button" onClick={() => showToast('Privacy Policy — full text coming soon (demo).')} className="transition-colors hover:text-white/70">
              Privacy Policy
            </button>
            <button type="button" onClick={() => showToast('Terms of Service — full text coming soon (demo).')} className="transition-colors hover:text-white/70">
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
