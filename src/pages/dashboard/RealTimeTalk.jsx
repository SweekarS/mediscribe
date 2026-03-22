import { useState, useEffect, useRef, useCallback } from 'react'
import useVAD from '../../hooks/useVAD'
import { useToast } from '../../context/ToastContext'
import { getApiBaseUrl, getWsBaseUrl } from '../../lib/devApiBase.js'

const API = getApiBaseUrl()
const WS_BASE = getWsBaseUrl(API)

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

export default function RealTimeTalk() {
  const { showToast } = useToast()
  const [lang, setLang] = useState('es')
  const [sessionId, setSessionId] = useState(null)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('')
  const [step, setStep] = useState('')
  const [doctorText, setDoctorText] = useState('')
  const [micRole, setMicRole] = useState(null) // 'patient' | 'doctor' | null
  const [vadStatus, setVadStatus] = useState('idle') // idle | listening | speaking | error
  const [pttHeld, setPttHeld] = useState(false)
  const [aiDoctorOn, setAiDoctorOn] = useState(false)

  const wsRef = useRef(null)
  const langRef = useRef(lang)
  const micRoleRef = useRef(null)
  const scrollRef = useRef(null)
  const pttRecorderRef = useRef(null)
  const pttStreamRef = useRef(null)
  const pttChunksRef = useRef([])

  useEffect(() => { langRef.current = lang }, [lang])
  useEffect(() => { micRoleRef.current = micRole }, [micRole])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const addMsg = useCallback((msg) => {
    setMessages((prev) => [...prev, { ...msg, ts: new Date().toLocaleTimeString() }])
  }, [])

  // --- Send audio blob over WebSocket ---
  const sendAudio = useCallback(async (blob) => {
    const ws = wsRef.current
    const role = micRoleRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN || !role) return

    const direction = role === 'patient' ? 'patient_to_provider' : 'provider_to_patient'
    ws.send(JSON.stringify({ type: 'audio_metadata', direction, patient_language: langRef.current }))
    const buf = await blob.arrayBuffer()
    ws.send(buf)
  }, [])

  // --- VAD hook (Silero, 800ms silence timeout) ---
  const vad = useVAD({
    onSpeechEnd: sendAudio,
    onStatusChange: setVadStatus,
  })

  // --- Session management ---
  const startSession = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: 'doctor_1', patient_language: lang }),
      })
      const data = await res.json()
      setSessionId(data.id)
      setStatus('Connecting...')

      const ws = new WebSocket(`${WS_BASE}/ws/session/${data.id}/`)

      ws.onopen = () => { setConnected(true); setStatus('Connected') }

      ws.onmessage = (e) => {
        const d = JSON.parse(e.data)
        if (d.type === 'connection_established') {
          setStatus('Ready'); setStep('')
        } else if (d.type === 'processing') {
          setStatus(d.message || 'Processing...'); setStep(d.step || '')
        } else if (d.type === 'patient_message') {
          setStatus('Ready'); setStep('')
          addMsg({
            role: 'patient',
            original: d.original,
            rawEnglish: d.raw_english,
            fixedEnglish: d.fixed_english,
            flags: d.medical_flags,
          })
        } else if (d.type === 'provider_message') {
          setStatus('Ready'); setStep('')
          addMsg({
            role: 'doctor',
            original: d.original,
            simplified: d.simplified,
            translated: d.translated,
            audio: d.audio_base64,
            suggestions: d.follow_up_suggestions,
          })
        } else if (d.type === 'ai_doctor_status') {
          setAiDoctorOn(d.enabled)
        } else if (d.type === 'error') {
          setStatus('Ready'); setStep('')
          showToast(d.message || 'An error occurred')
        }
      }

      ws.onclose = () => {
        setConnected(false); setStatus('Disconnected')
        vad.destroy()
        setMicRole(null)
      }

      wsRef.current = ws
      addMsg({ role: 'system', original: `Session started — ${LANGUAGES.find((l) => l.code === lang)?.label}` })
    } catch (err) {
      setStatus(`Failed: ${err.message}`)
      showToast(`Connection failed: ${err.message}`)
    }
  }, [lang, addMsg, vad, showToast])

  const endSession = useCallback(async () => {
    await vad.destroy()
    setMicRole(null)
    if (wsRef.current) wsRef.current.close()
    if (sessionId) {
      try {
        const res = await fetch(`${API}/api/sessions/${sessionId}/end/`, { method: 'POST' })
        if (!res.ok) throw new Error(`${res.status}`)
        showToast('Session ended — summary saved.')
      } catch (err) {
        showToast('Failed to save session summary. Check the backend.')
      }
    }
    setConnected(false); setSessionId(null); setStatus('')
    addMsg({ role: 'system', original: 'Session ended' })
  }, [sessionId, addMsg, vad, showToast])

  // --- Toggle VAD mic for a role ---
  const toggleVAD = useCallback(async (role) => {
    if (micRole === role) {
      await vad.pause()
      setMicRole(null)
    } else {
      if (micRole) await vad.pause()
      setMicRole(role)
      await vad.start()
    }
  }, [micRole, vad])

  // --- PTT (push-to-talk) fallback ---
  const pttDown = useCallback(async (role) => {
    if (pttHeld) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      pttStreamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      pttChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) pttChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        const blob = new Blob(pttChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        if (blob.size > 1000) {
          const ws = wsRef.current
          if (ws?.readyState === WebSocket.OPEN) {
            const direction = role === 'patient' ? 'patient_to_provider' : 'provider_to_patient'
            ws.send(JSON.stringify({ type: 'audio_metadata', direction, patient_language: langRef.current }))
            const buf = await blob.arrayBuffer()
            ws.send(buf)
          }
        }
      }
      recorder.start()
      pttRecorderRef.current = recorder
      micRoleRef.current = role
      setPttHeld(true)
    } catch (err) {
      setStatus(`Mic error: ${err.message}`)
    }
  }, [pttHeld])

  const pttUp = useCallback(() => {
    if (pttRecorderRef.current?.state === 'recording') {
      pttRecorderRef.current.stop()
    }
    pttRecorderRef.current = null
    setPttHeld(false)
  }, [])

  const toggleAiDoctor = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const next = !aiDoctorOn
    ws.send(JSON.stringify({ type: 'toggle_ai_doctor', enabled: next }))
    setAiDoctorOn(next)
  }, [aiDoctorOn])

  const sendDoctorText = useCallback(() => {
    const text = doctorText.trim()
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'provider_text', text, patient_language: lang }))
    setDoctorText('')
  }, [doctorText, lang])

  const stepIcons = { transcribing: '🎧', gemini: '🧠', tts: '🔊' }

  return (
    <div className="flex h-full flex-col bg-[#0f172a] text-[#e2e8f0]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e293b] px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Real-Time Talk</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
            connected ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
          }`}>
            {step ? `${stepIcons[step] || ''} ${status}` : status || 'Offline'}
          </span>
          {micRole && (
            <VadIndicator vadStatus={vadStatus} micRole={micRole} />
          )}
          {pttHeld && (
            <span className="flex items-center gap-1.5 rounded-full bg-orange-900/50 px-3 py-1 text-xs font-bold text-orange-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              PTT recording...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={connected}
            className="rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-sm disabled:opacity-50"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {connected && (
            <button
              onClick={toggleAiDoctor}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                aiDoctorOn ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              AI Doctor {aiDoctorOn ? 'ON' : 'OFF'}
            </button>
          )}
          {!connected ? (
            <button onClick={startSession} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">
              Start Session
            </button>
          ) : (
            <button onClick={endSession} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700">
              End Session
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-6">
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-600">
              <p className="text-lg">Start a session to begin</p>
              <p className="max-w-lg text-center text-sm">
                <strong>VAD mode</strong>: toggle a mic — it auto-detects when you start and stop talking (800ms silence triggers send).
                <br />
                <strong>PTT mode</strong>: hold a PTT button to record, release to send.
              </p>
            </div>
          )}
        </div>

        {connected && <SuggestionsSidebar messages={messages} wsRef={wsRef} lang={lang} />}
      </div>

      {/* Controls */}
      {connected && (
        <div className="space-y-2 border-t border-[#1e293b] px-6 py-3">
          {/* Doctor quick-send presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Doctor says:</span>
            {[
              "Your blood pressure is 150 over 95, which is high. We need to start you on medication.",
              "I'm going to order a complete blood count and a metabolic panel to check your liver and kidneys.",
              "You have acute bronchitis. I'm prescribing an inhaler and antibiotics for 7 days.",
              "The X-ray shows no fracture, but you have soft tissue swelling. Rest, ice, and ibuprofen.",
              "I need you to fast for 12 hours before your next visit so we can do a fasting glucose test.",
              "Do you have any allergies to medications?",
            ].map((phrase, i) => (
              <button
                key={i}
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'provider_text', text: phrase, patient_language: lang }))
                  }
                }}
                className="rounded-lg bg-emerald-900/30 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-900/50"
              >
                {phrase.length > 50 ? phrase.slice(0, 50) + '...' : phrase}
              </button>
            ))}
          </div>

          {/* Mic + text row */}
          <div className="flex items-center gap-3">
            <span className="w-10 text-[10px] font-bold uppercase tracking-wider text-gray-500">VAD</span>
            <button
              onClick={() => toggleVAD('patient')}
              disabled={vad.loading || pttHeld}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                micRole === 'patient'
                  ? 'bg-red-600 text-white'
                  : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
              } disabled:opacity-40`}
            >
              {vad.loading ? '...' : micRole === 'patient' ? '⏹ Stop Patient' : '🎤 Patient'}
            </button>
            <button
              onClick={() => toggleVAD('doctor')}
              disabled={vad.loading || pttHeld}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                micRole === 'doctor'
                  ? 'bg-red-600 text-white'
                  : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
              } disabled:opacity-40`}
            >
              {vad.loading ? '...' : micRole === 'doctor' ? '⏹ Stop Doctor' : '🩺 Doctor'}
            </button>

            <div className="mx-2 h-6 w-px bg-[#334155]" />

            <span className="w-10 text-[10px] font-bold uppercase tracking-wider text-gray-500">PTT</span>
            <button
              onMouseDown={() => pttDown('patient')}
              onMouseUp={pttUp}
              onMouseLeave={pttUp}
              disabled={!!micRole}
              className="rounded-lg bg-blue-900/30 px-3 py-2 text-xs font-bold text-blue-300 transition hover:bg-blue-900/50 active:bg-blue-700 disabled:opacity-30"
            >
              Hold: Patient
            </button>
            <button
              onMouseDown={() => pttDown('doctor')}
              onMouseUp={pttUp}
              onMouseLeave={pttUp}
              disabled={!!micRole}
              className="rounded-lg bg-emerald-900/30 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-900/50 active:bg-emerald-700 disabled:opacity-30"
            >
              Hold: Doctor
            </button>

            <div className="mx-2 h-6 w-px bg-[#334155]" />

            <input
              type="text"
              value={doctorText}
              onChange={(e) => setDoctorText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendDoctorText()}
              placeholder="Doctor: type a message..."
              className="flex-1 rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-2 text-sm placeholder:text-gray-600"
            />
            <button
              onClick={sendDoctorText}
              disabled={!doctorText.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// VAD status indicator
// ---------------------------------------------------------------------------

function VadIndicator({ vadStatus, micRole }) {
  const labels = {
    idle: 'Mic idle',
    listening: 'Listening for speech...',
    speaking: 'Speech detected',
    error: 'VAD error',
  }
  const colors = {
    idle: 'bg-gray-800 text-gray-500',
    listening: 'bg-yellow-900/50 text-yellow-400',
    speaking: 'bg-red-900/50 text-red-400',
    error: 'bg-red-900/50 text-red-400',
  }

  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${colors[vadStatus] || colors.idle}`}>
      {vadStatus === 'speaking' && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />}
      {vadStatus === 'listening' && <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />}
      {micRole === 'patient' ? 'Patient' : 'Doctor'}: {labels[vadStatus] || vadStatus}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg }) {
  if (msg.role === 'system') {
    return (
      <div className="text-center text-xs text-gray-500">
        {msg.original} <span className="text-gray-700">· {msg.ts}</span>
      </div>
    )
  }

  const isPatient = msg.role === 'patient'

  return (
    <div className={`flex ${isPatient ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[640px] rounded-2xl px-5 py-3 ${
        isPatient
          ? 'rounded-bl-sm border border-blue-900/50 bg-[#1a2744]'
          : 'rounded-br-sm border border-green-900/50 bg-[#1a2e1a]'
      }`}>
        <div className="mb-1 flex items-center gap-2">
          <span className={`text-xs font-bold ${isPatient ? 'text-blue-400' : 'text-green-400'}`}>
            {isPatient ? 'Patient' : 'Doctor'}
          </span>
          <span className="text-[10px] text-gray-600">{msg.ts}</span>
        </div>

        {isPatient ? (
          <>
            <p className="text-sm text-gray-400">{msg.original}</p>
            {msg.rawEnglish && msg.rawEnglish !== msg.fixedEnglish && (
              <p className="mt-1 text-xs text-gray-600 line-through">{msg.rawEnglish}</p>
            )}
            <p className="mt-1 text-sm font-medium text-white">{msg.fixedEnglish}</p>
            {msg.flags && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {msg.flags.urgency && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    msg.flags.urgency === 'high' ? 'bg-red-900/50 text-red-400'
                    : msg.flags.urgency === 'medium' ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-gray-800 text-gray-400'
                  }`}>
                    {msg.flags.urgency} urgency
                  </span>
                )}
                {(msg.flags.symptoms || []).map((s, i) => (
                  <span key={i} className="rounded-full bg-[#334155] px-2 py-0.5 text-[10px]">{s}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400">{msg.original}</p>
            {msg.simplified && msg.simplified !== msg.original && (
              <p className="mt-1 rounded bg-green-900/20 px-2 py-1 text-xs text-green-300">
                Simplified: {msg.simplified}
              </p>
            )}
            <p className="mt-1 text-sm font-medium text-white">→ {msg.translated}</p>
            {msg.audio && (
              <audio className="mt-2 h-8 w-full" controls autoPlay src={`data:audio/mpeg;base64,${msg.audio}`} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar — follow-up suggestions
// ---------------------------------------------------------------------------

function SuggestionsSidebar({ messages, wsRef, lang }) {
  const allSuggestions = messages
    .filter((m) => m.role === 'doctor' && m.suggestions?.length)
    .flatMap((m) => m.suggestions)
  const allFlags = messages
    .filter((m) => m.role === 'patient' && m.flags?.suggested_questions?.length)
    .flatMap((m) => m.flags.suggested_questions)

  const patientSuggestions = [...new Set(allSuggestions)].slice(-6)
  const doctorFollowUps = [...new Set(allFlags)].slice(-6)

  if (patientSuggestions.length === 0 && doctorFollowUps.length === 0) {
    return (
      <aside className="w-72 shrink-0 border-l border-[#1e293b] p-4">
        <p className="text-xs text-gray-600">Suggestions will appear as the conversation progresses.</p>
      </aside>
    )
  }

  return (
    <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-[#1e293b] p-4">
      {patientSuggestions.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-400">Patient could ask</h3>
          <div className="space-y-1.5">
            {patientSuggestions.map((s, i) => (
              <p key={i} className="rounded-lg bg-blue-900/20 px-3 py-2 text-xs text-blue-200">{s}</p>
            ))}
          </div>
        </div>
      )}
      {doctorFollowUps.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-green-400">Doctor follow-ups</h3>
          <div className="space-y-1.5">
            {doctorFollowUps.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'provider_text', text: q, patient_language: lang }))
                  }
                }}
                className="block w-full rounded-lg bg-green-900/20 px-3 py-2 text-left text-xs text-green-200 transition hover:bg-green-900/40"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
