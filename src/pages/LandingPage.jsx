import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import PatientExperienceScrolly from '../components/PatientExperienceScrolly'
import SimpleModal from '../components/SimpleModal'
import BrandMark from '../components/BrandMark'
import { useToast } from '../context/ToastContext'

const GITHUB_RELEASES_URL = 'https://github.com/Sabalpp/HOOHACKS/releases/latest'

export default function LandingPage() {
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const { showToast } = useToast()

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased">
      <Navbar />

      {/* ── Hero ── */}
      <header className="dark-section relative overflow-hidden px-8 pb-24 pt-36 md:pb-40 md:pt-52">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary-container opacity-20 blur-[140px]" />
          <div className="absolute -bottom-20 -right-20 h-[400px] w-[400px] rounded-full bg-secondary-container opacity-15 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center text-center">
          <div className="animate-float-in mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/90">
            <BrandMark bare size="sm" />
            Live Medical Translation
          </div>

          <h1 className="animate-float-in mb-8 text-5xl font-black leading-[1.08] tracking-tighter text-white md:text-7xl lg:text-8xl [animation-delay:100ms]">
            Understand your doctor,{' '}
            <br className="hidden sm:block" />
            <span className="text-secondary-container">
              in your language.
            </span>
          </h1>

          <p className="animate-float-in mb-14 max-w-2xl text-lg font-medium leading-relaxed text-white/70 md:text-xl [animation-delay:200ms]">
            Real-time video and call translation so you never miss a word during
            your next visit. Every word your doctor says, explained clearly in the
            language that&apos;s clear to you.
          </p>

          <div className="animate-float-in flex flex-col gap-4 sm:flex-row [animation-delay:300ms]">
            <Link
              to="/login"
              className="group relative rounded-xl bg-primary px-10 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-primary-container hover:shadow-xl"
            >
              <span className="relative z-10">Launch MediScribe</span>
              <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-[#1a2d3f] px-10 py-4 text-lg font-bold text-white transition-all duration-200 hover:bg-[#243a52]"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              Download desktop app
            </a>
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              className="rounded-xl border border-white/20 bg-[#1a2d3f] px-10 py-4 text-lg font-bold text-white transition-all duration-200 hover:bg-[#243a52]"
            >
              Your privacy matters
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
      </header>

      {/* ── Scrollytelling ── */}
      <div id="patient-experience">
        <PatientExperienceScrolly />
      </div>

      {/* ── Clinical Insight ── */}
      <section id="clinical-insight" className="bg-surface px-8 py-28">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 md:grid-cols-12">
          {/* Mock UI */}
          <div className="flex justify-center md:col-span-7">
            <div className="relative w-full overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-2xl">
              <div className="flex h-9 w-full items-center gap-2 border-b border-outline-variant/10 bg-surface-container-high px-4">
                <div className="h-2.5 w-2.5 rounded-full bg-error/40" />
                <div className="h-2.5 w-2.5 rounded-full bg-tertiary/40" />
                <div className="h-2.5 w-2.5 rounded-full bg-secondary/40" />
                <span className="ml-3 text-[10px] font-bold uppercase tracking-wider text-outline/50">MediScribe Dashboard</span>
              </div>

              <div className="grid grid-cols-3 gap-6 p-8">
                <div className="col-span-2 space-y-4">
                  <div className="mb-6 h-4 w-48 rounded bg-surface-container-high" />

                  <div className="rounded-lg bg-surface-container-low p-4">
                    <div className="mb-1 text-[10px] font-bold uppercase text-primary">What your doctor said</div>
                    <p className="text-sm font-medium text-on-surface">
                      &ldquo;I&apos;d like to check for{' '}
                      <span className="medical-highlight">pleuritic symptoms</span>. We&apos;ll run a{' '}
                      <span className="medical-highlight">troponin test</span> and an{' '}
                      <span className="medical-highlight">EKG</span>.&rdquo;
                    </p>
                  </div>

                  <div className="border-l-4 border-secondary bg-secondary-container/10 p-4">
                    <div className="mb-1 text-[10px] font-bold uppercase text-secondary">What it means for you</div>
                    <p className="text-sm font-medium">
                      Your doctor wants to check if your chest pain is related to
                      your heart or lungs. These are quick, painless tests.
                    </p>
                  </div>
                </div>

                <div className="col-span-1 space-y-4">
                  <div className="flex h-32 items-center justify-center rounded-lg bg-primary/5">
                    <div className="opacity-[0.22]">
                      <BrandMark size="xl" className="gap-0" />
                    </div>
                  </div>
                  <div className="h-4 w-full rounded bg-surface-container-high" />
                  <div className="h-4 w-2/3 rounded bg-surface-container-high" />
                </div>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div className="md:col-span-5">
            <div className="mb-8 h-1 w-12 bg-primary" />
            <h2 className="mb-6 text-4xl font-black tracking-tight text-primary md:text-5xl">
              Expect more.
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-on-surface-variant">
              MediScribe does more than just translate — it breaks down complex
              medical language, giving you the control to make informed choices
              about your health.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-surface-container-low p-5">
                <div className="text-3xl font-black text-primary">99%</div>
                <div className="text-xs font-bold uppercase tracking-tighter text-on-surface-variant">
                  Translation Accuracy
                </div>
              </div>
              <div className="rounded-xl bg-surface-container-low p-5">
                <div className="text-3xl font-black text-primary">&lt;150ms</div>
                <div className="text-xs font-bold uppercase tracking-tighter text-on-surface-variant">
                  Latency
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section id="trust" className="bg-surface-container-low px-8 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <h3 className="mb-14 text-xs font-black uppercase tracking-[0.2em] text-outline">
            Powered by technology you can trust
          </h3>
          <div className="flex flex-wrap justify-center gap-12 opacity-60 transition-all duration-500 grayscale hover:opacity-100 hover:grayscale-0 md:gap-24">
            {[
              { name: 'ElevenLabs', role: 'Records Voice' },
              { name: 'Google Gemini', role: 'Transcribes Speech' },
              { name: 'Snowflake', role: 'Checks Transcription' },
            ].map((tech) => (
              <div key={tech.name} className="flex flex-col items-center gap-2">
                <div className="text-2xl font-black tracking-tighter text-on-surface">{tech.name}</div>
                <div className="text-[10px] font-bold uppercase text-outline">{tech.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Download section ── */}
      <section id="download" className="dark-section relative overflow-hidden px-8 py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 top-10 h-[400px] w-[400px] rounded-full bg-secondary-container opacity-15 blur-[120px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="mb-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
              <span className="material-symbols-outlined text-[14px]">devices</span>
              Desktop app
            </span>
          </div>
          <h2 className="mb-4 text-center text-4xl font-black tracking-tight text-white md:text-5xl">
            On top of your calls
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-lg text-white/60">
            Download the MediScribe desktop app and get a live translation overlay that floats
            on top of Zoom, Google Meet, FaceTime, or any video call.
          </p>

          <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                platform: 'macOS',
                icon: 'laptop_mac',
                file: '.dmg',
                note: 'Apple Silicon & Intel',
              },
              {
                platform: 'Windows',
                icon: 'desktop_windows',
                file: '.exe',
                note: 'Windows 10+',
              },
              {
                platform: 'Linux',
                icon: 'terminal',
                file: '.AppImage',
                note: 'Ubuntu, Fedora, etc.',
              },
            ].map((p) => (
              <a
                key={p.platform}
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 text-center transition-all hover:border-white/25 hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-4xl text-white/80 transition-colors group-hover:text-white">
                  {p.icon}
                </span>
                <span className="text-lg font-bold text-white">{p.platform}</span>
                <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold text-white/60">
                  {p.file}
                </span>
                <span className="text-xs text-white/40">{p.note}</span>
              </a>
            ))}
          </div>

          <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/5 p-6">
            <button
              type="button"
              onClick={() => setInstallOpen(!installOpen)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-white/80">
                <span className="material-symbols-outlined text-[18px] text-white/50">help</span>
                First time opening? Read this
              </span>
              <span className={`material-symbols-outlined text-white/40 transition-transform ${installOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>
            {installOpen && (
              <div className="mt-4 space-y-4 text-sm text-white/60">
                <div>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/40">macOS</span>
                  <p>
                    Open the .dmg, drag MediScribe to Applications. On first launch, macOS may say
                    the app can&apos;t be verified. <strong className="text-white/80">Right-click the app &rarr; Open &rarr; Open</strong> to
                    bypass this once. Alternatively, run in Terminal:{' '}
                    <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/70">xattr -cr /Applications/MediScribe.app</code>
                  </p>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/40">Windows</span>
                  <p>
                    Run the installer. SmartScreen may show &ldquo;Windows protected your PC.&rdquo;
                    Click <strong className="text-white/80">More info &rarr; Run anyway</strong>. This only happens once.
                  </p>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/40">Linux</span>
                  <p>
                    Download the .AppImage, make it executable (<code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/70">chmod +x MediScribe*.AppImage</code>),
                    and run it. No installation required.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />

      {/* ── Privacy modal ── */}
      <SimpleModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="How we protect your privacy">
        <ul className="list-inside list-disc space-y-2">
          <li>Your conversations are encrypted end-to-end during your visit.</li>
          <li>We never share your health information with anyone without your permission.</li>
          <li>Audio is processed in real time and is not stored after your visit ends.</li>
          <li>You can request deletion of all your data at any time.</li>
        </ul>
        <p className="mt-4 text-xs text-outline">
          Full privacy policy available upon request. Contact your care team for details.
        </p>
        <button
          type="button"
          onClick={() => {
            showToast('Privacy info sent to your email (demo).')
            setPrivacyOpen(false)
          }}
          className="clinical-gradient mt-6 w-full rounded-lg py-3 text-sm font-bold text-white"
        >
          Send me the full policy
        </button>
      </SimpleModal>
    </div>
  )
}
