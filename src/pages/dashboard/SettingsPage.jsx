import { useState } from 'react'
import { useToast } from '../../context/ToastContext'

const LANGUAGES = [
  { code: 'es', label: 'Spanish' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ne', label: 'Nepali' },
  { code: 'zh', label: 'Mandarin Chinese' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
]

export default function SettingsPage() {
  const { showToast } = useToast()

  const [language, setLanguage] = useState('es')
  const [autoPlay, setAutoPlay] = useState(true)
  const [showRaw, setShowRaw] = useState(false)
  const [fontSize, setFontSize] = useState('normal')
  const [highContrast, setHighContrast] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [micMode, setMicMode] = useState('vad')

  const handleSave = () => showToast('Preferences saved.')
  const handleReset = () => {
    setLanguage('es')
    setAutoPlay(true)
    setShowRaw(false)
    setFontSize('normal')
    setHighContrast(false)
    setNotifications(true)
    setMicMode('vad')
    showToast('Preferences reset to defaults.')
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-surface">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface-container px-8">
        <h1 className="text-xl font-bold tracking-tight text-primary">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card title="Language" icon="translate">
            <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-outline">
              Default patient language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-outline">This will be pre-selected when starting new sessions.</p>
          </Card>

          <Card title="Audio & Input" icon="mic">
            <div className="space-y-4">
              <Toggle label="Auto-play translated audio" description="Automatically play TTS audio when a translation arrives" checked={autoPlay} onChange={setAutoPlay} />
              <div>
                <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-outline">
                  Microphone mode
                </label>
                <div className="flex gap-3">
                  <RadioButton label="VAD (auto-detect)" value="vad" selected={micMode} onChange={setMicMode} />
                  <RadioButton label="Push-to-talk" value="ptt" selected={micMode} onChange={setMicMode} />
                </div>
                <p className="mt-2 text-xs text-outline">
                  VAD automatically detects when you start and stop talking. Push-to-talk requires holding a button.
                </p>
              </div>
            </div>
          </Card>

          <Card title="Display" icon="visibility">
            <div className="space-y-4">
              <Toggle label="Show raw translation" description="Display the raw English translation before grammar recovery" checked={showRaw} onChange={setShowRaw} />
              <div>
                <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-outline">
                  Text size
                </label>
                <div className="flex gap-3">
                  <RadioButton label="Normal" value="normal" selected={fontSize} onChange={setFontSize} />
                  <RadioButton label="Large" value="large" selected={fontSize} onChange={setFontSize} />
                  <RadioButton label="Extra large" value="xl" selected={fontSize} onChange={setFontSize} />
                </div>
              </div>
              <Toggle label="High contrast mode" description="Increase contrast for better readability" checked={highContrast} onChange={setHighContrast} />
            </div>
          </Card>

          <Card title="Notifications" icon="notifications">
            <Toggle label="Session notifications" description="Get notified when a session starts or ends" checked={notifications} onChange={setNotifications} />
          </Card>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="clinical-gradient rounded-lg px-6 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Save preferences
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-outline-variant/40 px-6 py-3 text-sm font-bold text-on-surface transition hover:bg-surface-container-high"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function Card({ title, icon, children }) {
  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-outline">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-on-surface">{label}</div>
        {description && <div className="text-xs text-outline">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-outline-variant'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  )
}

function RadioButton({ label, value, selected, onChange }) {
  const active = selected === value
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-outline-variant/30 text-on-surface hover:bg-surface-container-high'
      }`}
    >
      {label}
    </button>
  )
}
