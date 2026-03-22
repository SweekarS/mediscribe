import { useState, useEffect } from 'react'
import { useToast } from '../../context/ToastContext'
import { getApiBaseUrl } from '../../lib/devApiBase.js'

const API = getApiBaseUrl()

export default function HistoryPage() {
  const { showToast } = useToast()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/sessions/?provider_id=doctor_1`)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        setSessions(data)
      } catch {
        showToast('Could not load past sessions — is the backend running?')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [showToast])

  const toggleExpand = (id) => {
    setExpanded(expanded === id ? null : id)
  }

  const deleteSession = async (id) => {
    try {
      await fetch(`${API}/api/sessions/${id}/`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== id))
      showToast('Session deleted.')
    } catch {
      showToast('Failed to delete session.')
    }
  }

  const endAndSummarize = async (id) => {
    try {
      const res = await fetch(`${API}/api/sessions/${id}/end/`, { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      const updated = await res.json()
      setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)))
      showToast('Session ended — summary generated.')
    } catch {
      showToast('Failed to end session.')
    }
  }

  const langLabel = (code) =>
    ({ es: 'Spanish', zh: 'Mandarin', vi: 'Vietnamese', fr: 'French', pt: 'Portuguese', ar: 'Arabic', hi: 'Hindi', ne: 'Nepali' })[code] || code

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-surface">
        <div className="flex items-center gap-3 text-outline">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading past visits...
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-surface">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface-container px-8">
        <h1 className="text-xl font-bold tracking-tight text-primary">Past visits</h1>
        <span className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-bold text-outline">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <span className="material-symbols-outlined text-5xl text-outline-variant">history</span>
            <h2 className="text-lg font-bold text-on-surface">No past visits yet</h2>
            <p className="max-w-sm text-sm text-on-surface-variant">
              Once you complete a live session (Remote visit or Solo demo), it will appear here with the full transcript and AI summary.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(s.id)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.ended_at ? 'bg-secondary-container' : 'bg-tertiary-container'}`}>
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {s.ended_at ? 'check_circle' : 'radio_button_checked'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">{langLabel(s.patient_language)}</span>
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold text-outline">
                          {s.ended_at ? 'COMPLETED' : 'ACTIVE'}
                        </span>
                      </div>
                      <span className="text-xs text-outline">
                        {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-outline transition-transform ${expanded === s.id ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {expanded === s.id && (
                  <div className="border-t border-outline-variant/20 px-6 py-4">
                    {s.medical_summary ? (
                      <div className="mb-4 rounded-lg bg-secondary-container/10 p-4">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-secondary">AI Summary</div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{s.medical_summary}</p>
                      </div>
                    ) : !s.ended_at ? (
                      <div className="mb-4 flex items-center justify-between rounded-lg bg-tertiary-container/10 p-4">
                        <p className="text-xs text-outline">Session still active — end it to generate a summary.</p>
                        <button
                          type="button"
                          onClick={() => endAndSummarize(s.id)}
                          className="ml-4 shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:bg-primary/80"
                        >
                          End &amp; Summarize
                        </button>
                      </div>
                    ) : (
                      <p className="mb-4 text-xs text-outline">No summary available for this session.</p>
                    )}

                    {(s.messages || []).length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-outline">Transcript</div>
                        {s.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.direction === 'patient_to_provider' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                              m.direction === 'patient_to_provider'
                                ? 'bg-surface-container-low'
                                : 'bg-primary/5'
                            }`}>
                              <span className="font-bold text-outline">
                                {m.direction === 'patient_to_provider' ? 'Patient' : 'Doctor'}:
                              </span>{' '}
                              <span className="text-on-surface">{m.translated_text || m.original_text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-outline">No messages recorded.</p>
                    )}

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => deleteSession(s.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-error transition hover:bg-error-container/20"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
