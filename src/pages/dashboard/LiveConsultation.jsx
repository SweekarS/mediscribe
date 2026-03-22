import { useState, useEffect, useRef, useCallback } from 'react'
import { useDashboardSession } from '../../context/DashboardSessionContext'
import { useToast } from '../../context/ToastContext'
import { connectSession, createSession } from '../../services/api'
import useVAD from '../../hooks/useVAD'
import { getApiBaseUrl } from '../../lib/devApiBase.js'

const API = getApiBaseUrl()

const LANGUAGES = [
  { code: 'es', label: 'Spanish' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ne', label: 'Nepali' },
  { code: 'zh', label: 'Mandarin' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
]

export default function LiveConsultation() {
  const { inCall, startCall, endCall } = useDashboardSession()
  const { showToast } = useToast()

  const [role, setRole] = useState(null) // 'patient' | 'doctor'
  const [mode, setMode] = useState(null) // 'create' | 'join'
  const [sessionId, setSessionId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [patientLang, setPatientLang] = useState('es')
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('')
  const [step, setStep] = useState('')
  const [micActive, setMicActive] = useState(false)
  const [vadStatus, setVadStatus] = useState('idle')
  const [doctorText, setDoctorText] = useState('')
  const [pttHeld, setPttHeld] = useState(false)
  const [aiDoctorOn, setAiDoctorOn] = useState(false)

  const scrollRef = useRef(null)
  const sessionRef = useRef(null)
  const audioRef = useRef(null)
  const langRef = useRef(patientLang)
  const roleRef = useRef(role)
  const pttRecorderRef = useRef(null)
  const pttStreamRef = useRef(null)
  const pttChunksRef = useRef([])
  const processingTimerRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])
  useEffect(() => { langRef.current = patientLang }, [patientLang])
  useEffect(() => { roleRef.current = role }, [role])
  useEffect(() => {
    if (vadStatus === 'error') showToast('Voice detection failed — use Push-to-Talk instead.')
  }, [vadStatus, showToast])

  const sendAudio = useCallback((blob) => {
    const conn = sessionRef.current
    if (!conn?.ws || conn.ws.readyState !== WebSocket.OPEN) return
    const direction = roleRef.current === 'patient' ? 'patient_to_provider' : 'provider_to_patient'
    conn.sendAudio(blob, direction, langRef.current)
  }, [])

  const vad = useVAD({ onSpeechEnd: sendAudio, onStatusChange: setVadStatus })

  const toggleMic = useCallback(async () => {
    if (micActive) {
      await vad.pause()
      setMicActive(false)
    } else {
      await vad.start()
      setMicActive(true)
    }
  }, [micActive, vad])

  // --- PTT fallback (works without WASM) ---
  const pttDown = useCallback(async (pttRole) => {
    if (pttHeld) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      pttStreamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      pttChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) pttChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(pttChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        if (blob.size > 1000) {
          const conn = sessionRef.current
          if (conn?.ws?.readyState === WebSocket.OPEN) {
            const direction = pttRole === 'patient' ? 'patient_to_provider' : 'provider_to_patient'
            conn.sendAudio(blob, direction, langRef.current)
          }
        }
      }
      recorder.start()
      pttRecorderRef.current = recorder
      roleRef.current = pttRole
      setPttHeld(true)
    } catch (err) {
      pttStreamRef.current?.getTracks().forEach((t) => t.stop())
      showToast(`Mic error: ${err.message}`)
    }
  }, [pttHeld, showToast])

  const pttUp = useCallback(() => {
    if (pttRecorderRef.current?.state === 'recording') {
      pttRecorderRef.current.stop()
    }
    pttRecorderRef.current = null
    pttStreamRef.current?.getTracks().forEach((t) => t.stop())
    pttStreamRef.current = null
    setPttHeld(false)
  }, [])

  const toggleAiDoctor = useCallback(() => {
    const conn = sessionRef.current
    if (!conn?.ws || conn.ws.readyState !== WebSocket.OPEN) return
    const next = !aiDoctorOn
    conn.ws.send(JSON.stringify({ type: 'toggle_ai_doctor', enabled: next }))
    setAiDoctorOn(next)
  }, [aiDoctorOn])

  const sendPreset = useCallback((text) => {
    if (!text || !sessionRef.current) return
    sessionRef.current.sendText(text, langRef.current)
  }, [])

  const sendDocText = useCallback(() => {
    const t = doctorText.trim()
    if (!t || !sessionRef.current) return
    sessionRef.current.sendText(t, langRef.current)
    setDoctorText('')
  }, [doctorText])

  // --- Create session (first client) ---
  const handleCreate = useCallback(async () => {
    try {
      setStatus('Creating session...')
      const session = await createSession({ providerId: 'doctor_1', patientLanguage: patientLang })
      const id = session.id
      setSessionId(id)
      setMode('create')
      showToast('Session created — share the code with the other person.')
      connectToSession(id)
    } catch (err) {
      showToast(`Failed to create session: ${err.message}`)
      setStatus('')
    }
  }, [patientLang, role])

  // --- Join session (second client) ---
  const handleJoin = useCallback(() => {
    const id = joinCode.trim()
    if (!id) {
      showToast('Enter a session code.')
      return
    }
    setSessionId(id)
    setMode('join')
    connectToSession(id)
  }, [joinCode, role, patientLang])

  // --- Connect WebSocket + start mic ---
  function connectToSession(id) {
    startCall()
    setMessages([])
    setStatus('Connecting...')

    const conn = connectSession({
      sessionId: id,
      onOpen: () => {
        setStatus('Connected — toggle mic to start')
        showToast(`Connected as ${role}. Toggle your mic to begin.`)
      },
      onMessage: handleWsMessage,
      onClose: () => {
        setStatus('Disconnected')
        vad.destroy()
        setMicActive(false)
      },
      onError: () => setStatus('Connection error'),
    })

    sessionRef.current = conn

    if (!conn.ws) {
      setStatus('Demo mode — mock messages')
    }
  }

  const handleStop = async () => {
    await vad.destroy()
    setMicActive(false)
    sessionRef.current?.close()
    sessionRef.current = null
    if (sessionId) {
      try {
        const res = await fetch(`${API}/api/sessions/${sessionId}/end/`, { method: 'POST' })
        if (!res.ok) throw new Error(`${res.status}`)
        showToast('Session ended — summary saved.')
      } catch {
        showToast('Failed to save session summary.')
      }
    }
    endCall()
    setStatus('')
    setStep('')
    setSessionId('')
    setMode(null)
  }

  function handleWsMessage(data) {
    // Clear any processing timeout when we get a real result
    if (data.type !== 'processing') {
      clearTimeout(processingTimerRef.current)
    }
    switch (data.type) {
      case 'connection_established':
        setStatus('Live — speak naturally')
        setStep('')
        break
      case 'processing':
        setStatus(data.message || 'Processing...')
        setStep(data.step || '')
        // Auto-reset if stuck for 30s
        clearTimeout(processingTimerRef.current)
        processingTimerRef.current = setTimeout(() => {
          setStatus('Live')
          setStep('')
          showToast('Processing timed out — try again.')
        }, 30000)
        break
      case 'patient_message':
        setStatus('Live')
        setStep('')
        setMessages((prev) => [...prev, {
          role: 'patient',
          original: data.original,
          rawEnglish: data.raw_english,
          fixedEnglish: data.fixed_english,
          flags: data.medical_flags,
          ts: new Date().toLocaleTimeString(),
        }])
        break
      case 'provider_message':
        setStatus('Live')
        setStep('')
        setMessages((prev) => [...prev, {
          role: 'doctor',
          original: data.original,
          simplified: data.simplified,
          translated: data.translated,
          audio: data.audio_base64,
          suggestions: data.follow_up_suggestions,
          ts: new Date().toLocaleTimeString(),
        }])
        if (data.audio_base64) playAudio(data.audio_base64)
        break
      case 'ai_doctor_status':
        setAiDoctorOn(data.enabled)
        break
      case 'error':
        setStatus('Live')
        setStep('')
        showToast(data.message || 'An error occurred')
        break
      default:
        break
    }
  }

  function playAudio(base64) {
    try {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      if (!audioRef.current) audioRef.current = new Audio()
      audioRef.current.src = url
      audioRef.current.play().catch(() => {})
    } catch { /* best-effort */ }
  }

  const stepIcons = { transcribing: '🎧', gemini: '🧠', tts: '🔊' }

  // --- If no role selected yet, show setup screen ---
  if (!role || !inCall) {
    return <SetupScreen
      role={role} setRole={setRole}
      patientLang={patientLang} setPatientLang={setPatientLang}
      joinCode={joinCode} setJoinCode={setJoinCode}
      sessionId={sessionId}
      status={status}
      onCreate={handleCreate}
      onJoin={handleJoin}
    />
  }

  // --- Active session ---
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface-container px-8">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-primary">Live Session</h1>
          <span className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold ${
            role === 'doctor'
              ? 'bg-secondary/10 text-secondary'
              : 'bg-primary/10 text-primary'
          }`}>
            <span className="material-symbols-outlined text-[14px]">{role === 'doctor' ? 'stethoscope' : 'person'}</span>
            {role === 'doctor' ? 'Doctor' : 'Patient'} · {LANGUAGES.find((l) => l.code === patientLang)?.label}
          </span>
          <div className="flex items-center rounded-full bg-surface-container-highest px-1 py-1">
            <div className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-1.5 text-xs font-bold text-primary shadow-sm">
              <span className="h-2 w-2 rounded-full bg-tertiary-fixed-dim pulse-active" />
              {step ? `${stepIcons[step] || ''} ${status}` : status || 'LIVE'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Session code */}
          <div className="flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Session</span>
            <code className="text-xs font-bold text-on-surface">{sessionId.slice(0, 8)}</code>
          </div>

          <button
            onClick={toggleMic}
            disabled={vad.loading}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              micActive ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-container-high text-outline'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{micActive ? 'mic' : 'mic_off'}</span>
            {vad.loading ? '...' : micActive ? (vadStatus === 'speaking' ? 'Speaking...' : 'Listening') : 'Mic Off'}
          </button>

          {/* PTT fallback buttons */}
          <button
            onMouseDown={() => pttDown('patient')}
            onMouseUp={pttUp}
            onMouseLeave={pttUp}
            onTouchStart={() => pttDown('patient')}
            onTouchEnd={pttUp}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition select-none ${
              pttHeld && roleRef.current === 'patient' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-outline'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
            PTT Patient
          </button>
          <button
            onMouseDown={() => pttDown('doctor')}
            onMouseUp={pttUp}
            onMouseLeave={pttUp}
            onTouchStart={() => pttDown('doctor')}
            onTouchEnd={pttUp}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition select-none ${
              pttHeld && roleRef.current === 'doctor' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-outline'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
            PTT Doctor
          </button>

          <button
            onClick={toggleAiDoctor}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              aiDoctorOn ? 'bg-tertiary text-on-tertiary' : 'bg-surface-container-high text-outline'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            AI Doctor {aiDoctorOn ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleStop}
            className="flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-bold text-white transition-opacity active:opacity-80"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>stop_circle</span>
            End session
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col bg-surface">
          <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-8">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.5s]" />
                  </div>
                  <p className="text-sm text-on-surface-variant">Waiting for speech... Start talking on your call.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <TranscriptBubble key={i} msg={m} myRole={role} />
              ))}
              {messages.length > 0 && inCall && (
                <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-outline-variant/30 bg-surface-container-low/50 p-3">
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-container" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-container [animation-delay:-0.3s]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-container [animation-delay:-0.5s]" />
                  </div>
                  <span className="text-xs font-medium text-outline">Listening...</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <InsightsSidebar messages={messages} />
      </div>

      {/* Doctor controls */}
      <div className="space-y-2 border-t border-outline-variant/30 bg-surface-container px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Doctor says:</span>
          {(() => {
            const aiSuggestions = messages
              .filter((m) => m.role === 'patient' && m.flags?.suggested_questions?.length)
              .flatMap((m) => m.flags.suggested_questions)
            const unique = [...new Set(aiSuggestions)].slice(-6)
            const starters = [
              "Do you have any allergies to medications?",
              "When did the symptoms start?",
              "Can you describe the pain?",
              "Are you currently taking any medication?",
            ]
            const phrases = unique.length > 0 ? unique : starters
            return phrases.map((phrase, i) => (
              <button
                key={i}
                onClick={() => sendPreset(phrase)}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  unique.length > 0
                    ? 'bg-tertiary/10 text-tertiary hover:bg-tertiary/20 border border-tertiary/20'
                    : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                }`}
              >
                {unique.length > 0 && <span className="mr-1">AI:</span>}
                {phrase.length > 60 ? phrase.slice(0, 60) + '...' : phrase}
              </button>
            ))
          })()}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={doctorText}
            onChange={(e) => setDoctorText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendDocText()}
            placeholder="Doctor: type a message..."
            className="flex-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-sm text-on-surface placeholder:text-outline/50"
          />
          <button
            onClick={sendDocText}
            disabled={!doctorText.trim()}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-on-secondary transition hover:bg-secondary/80 disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Setup screen — role picker + session create/join
// ---------------------------------------------------------------------------

function SetupScreen({ role, setRole, patientLang, setPatientLang, joinCode, setJoinCode, sessionId, status, onCreate, onJoin }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface p-8">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-primary">Start a session</h1>
          <p className="mt-2 text-on-surface-variant">
            Both you and the other person open MediScribe. One creates, the other joins with the code.
          </p>
        </div>

        {/* Step 1: Pick role */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-outline">I am the...</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setRole('patient')}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
                role === 'patient'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-outline-variant/30 hover:border-primary/40'
              }`}
            >
              <span className="material-symbols-outlined text-4xl text-primary">person</span>
              <span className="text-lg font-bold text-on-surface">Patient</span>
              <span className="text-xs text-on-surface-variant">I speak another language</span>
            </button>
            <button
              onClick={() => setRole('doctor')}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
                role === 'doctor'
                  ? 'border-secondary bg-secondary/5 shadow-sm'
                  : 'border-outline-variant/30 hover:border-secondary/40'
              }`}
            >
              <span className="material-symbols-outlined text-4xl text-secondary">stethoscope</span>
              <span className="text-lg font-bold text-on-surface">Doctor</span>
              <span className="text-xs text-on-surface-variant">I speak English</span>
            </button>
          </div>
        </div>

        {/* Step 2: Language */}
        {role && (
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-outline">Patient language</label>
            <select
              value={patientLang}
              onChange={(e) => setPatientLang(e.target.value)}
              className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Step 3: Create or Join */}
        {role && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
              <h3 className="mb-1 text-sm font-bold text-on-surface">Create session</h3>
              <p className="mb-4 text-xs text-on-surface-variant">Start first, then share the code</p>
              <button
                onClick={onCreate}
                className="clinical-gradient w-full rounded-lg py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Create
              </button>
              {sessionId && (
                <div className="mt-4 rounded-lg bg-surface-container-high p-3 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Share this code</span>
                  <div
                    className="mt-1 cursor-pointer font-mono text-lg font-black tracking-widest text-primary"
                    onClick={() => {
                      navigator.clipboard?.writeText(sessionId)
                    }}
                    title="Click to copy"
                  >
                    {sessionId.slice(0, 8)}
                  </div>
                  <span className="text-[10px] text-outline">Full: {sessionId}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
              <h3 className="mb-1 text-sm font-bold text-on-surface">Join session</h3>
              <p className="mb-4 text-xs text-on-surface-variant">Enter the code from the other person</p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Paste session ID..."
                className="mb-3 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-outline/50"
                onKeyDown={(e) => e.key === 'Enter' && onJoin()}
              />
              <button
                onClick={onJoin}
                className="w-full rounded-lg border-2 border-primary bg-primary/5 py-3 text-sm font-bold text-primary transition hover:bg-primary/10"
              >
                Join
              </button>
            </div>
          </div>
        )}

        {status && (
          <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {status}
          </div>
        )}
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Transcript bubble
// ---------------------------------------------------------------------------

function TranscriptBubble({ msg, myRole }) {
  const isPatient = msg.role === 'patient'
  const isMe = msg.role === myRole

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[600px] rounded-2xl px-5 py-3 ${
        isPatient
          ? `rounded-bl-sm border border-primary/20 bg-primary/5`
          : `rounded-br-sm border border-secondary/20 bg-secondary/5`
      }`}>
        <div className="mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px]" style={{
            color: isPatient ? 'var(--color-primary)' : 'var(--color-secondary)',
          }}>
            {isPatient ? 'person' : 'stethoscope'}
          </span>
          <span className={`text-xs font-bold ${isPatient ? 'text-primary' : 'text-secondary'}`}>
            {isPatient ? 'Patient' : 'Doctor'}{isMe ? ' (you)' : ''}
          </span>
          <span className="text-[10px] text-outline">{msg.ts}</span>
        </div>

        {isPatient ? (
          <>
            <p className="text-sm text-on-surface-variant">{msg.original}</p>
            {msg.rawEnglish && msg.rawEnglish !== msg.fixedEnglish && (
              <p className="mt-1 text-xs text-outline line-through">{msg.rawEnglish}</p>
            )}
            <p className="mt-1 text-sm font-medium text-on-surface">{msg.fixedEnglish}</p>
            {msg.flags?.symptoms?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {msg.flags.urgency && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    msg.flags.urgency === 'high' ? 'bg-error/10 text-error'
                    : msg.flags.urgency === 'medium' ? 'bg-tertiary/10 text-tertiary'
                    : 'bg-surface-container-high text-outline'
                  }`}>
                    {msg.flags.urgency} urgency
                  </span>
                )}
                {msg.flags.symptoms.map((s, i) => (
                  <span key={i} className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] text-on-surface">{s}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant">{msg.original}</p>
            {msg.simplified && msg.simplified !== msg.original && (
              <p className="mt-1 rounded bg-secondary/10 px-2 py-1 text-xs text-secondary">
                Simplified: {msg.simplified}
              </p>
            )}
            <p className="mt-1 text-sm font-medium text-on-surface">→ {msg.translated}</p>
            {msg.audio && (
              <audio className="mt-2 h-8 w-full" controls src={`data:audio/mpeg;base64,${msg.audio}`} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Insights sidebar
// ---------------------------------------------------------------------------

function InsightsSidebar({ messages }) {
  const allSymptoms = messages
    .filter((m) => m.role === 'patient' && m.flags?.symptoms?.length)
    .flatMap((m) => m.flags.symptoms)
  const allSuggestions = messages
    .filter((m) => m.role === 'doctor' && m.suggestions?.length)
    .flatMap((m) => m.suggestions)

  const symptoms = [...new Set(allSymptoms)].slice(-8)
  const suggestions = [...new Set(allSuggestions)].slice(-6)

  return (
    <aside className="no-scrollbar w-full max-w-[320px] shrink-0 space-y-6 overflow-y-auto border-l border-outline-variant/30 bg-surface-container-low p-6">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-on-surface">
        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
        Insights
      </h2>

      {symptoms.length > 0 && (
        <div className="rounded-lg border-l-4 border-error bg-surface-container-lowest p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-error">Medical topics</span>
          <ul className="mt-2 space-y-1.5">
            {symptoms.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-error">info</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-lg bg-surface-container-lowest p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-primary">Suggested follow-ups</span>
          <ul className="mt-2 space-y-1.5">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">lightbulb</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {symptoms.length === 0 && suggestions.length === 0 && (
        <p className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
          Insights will appear as the conversation progresses.
        </p>
      )}
    </aside>
  )
}
