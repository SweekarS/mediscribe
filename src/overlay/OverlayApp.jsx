import { useState, useEffect, useRef, useCallback } from 'react'
import { connectSession, createSession, ragQuery } from '../services/api'
import * as callCapture from '../services/callCapture'
import BrandMark from '../components/BrandMark'

const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'ko', label: '한국어' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ne', label: 'नेपाली' },
]

const COMPACT_HEIGHT = 200
const FULL_HEIGHT = 580
const FULL_WIDTH = 380

export default function OverlayApp() {
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [language, setLanguage] = useState('es')
  const [role, setRole] = useState('patient') // 'patient' | 'doctor'
  const [sessionId, setSessionId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [micMuted, setMicMuted] = useState(false)
  const [activeTab, setActiveTab] = useState('transcript')
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState('')
  const [compact, setCompact] = useState(true)
  const [opacity, setOpacity] = useState(1)
  const [showSettings, setShowSettings] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [widgetPaused, setWidgetPaused] = useState(false)
  const feedRef = useRef(null)
  const sessionRef = useRef(null)
  const audioRef = useRef(null)
  const autoStartRef = useRef(false)

  useEffect(() => {
    const cleanupStart = window.electronAPI?.onSessionStarted?.(() => {})
    const cleanupEnd = window.electronAPI?.onSessionEnded?.(() => stopListening())
    return () => { cleanupStart?.(); cleanupEnd?.() }
  }, [])

  useEffect(() => {
    const cleanupPause = window.electronAPI?.onWidgetPause?.(() => {
      callCapture.setCapturePaused(true)
      setWidgetPaused(true)
      setStatus('Paused')
    })
    const cleanupResume = window.electronAPI?.onWidgetResume?.(() => {
      callCapture.setCapturePaused(false)
      setWidgetPaused(false)
      setStatus((prev) => (prev === 'Paused' ? 'Live' : prev))
    })
    const cleanupExpand = window.electronAPI?.onWidgetExpand?.(() => setCompact(false))
    return () => {
      cleanupPause?.()
      cleanupResume?.()
      cleanupExpand?.()
    }
  }, [])

  useEffect(() => {
    // Widget-first behavior: auto start once on app launch.
    if (autoStartRef.current || listening) return
    autoStartRef.current = true
    handleQuickStart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [messages, chatHistory])

  useEffect(() => { callCapture.setMicMuted(micMuted) }, [micMuted])

  useEffect(() => {
    if (messages.length > 0) window.electronAPI?.setTrayBadge?.(true)
  }, [messages.length])

  useEffect(() => {
    window.electronAPI?.resizeOverlay?.(FULL_WIDTH, compact ? COMPACT_HEIGHT : FULL_HEIGHT)
  }, [compact])

  useEffect(() => {
    window.electronAPI?.setOverlayOpacity?.(opacity)
  }, [opacity])

  const visibleMessages = compact ? messages.slice(-2) : messages

  async function handleCreate() {
    try {
      setStatus('Creating session...')
      const session = await createSession({ providerId: 'doctor_1', patientLanguage: language })
      setSessionId(session.id)
      connectToSession(session.id, { useDualCapture: false })
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
  }

  async function handleQuickStart() {
    try {
      setStatus('Starting widget...')
      const session = await createSession({ providerId: 'doctor_1', patientLanguage: language })
      setRole('patient')
      setSessionId(session.id)
      connectToSession(session.id, { useDualCapture: true })
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
  }

  function handleJoin() {
    const id = joinCode.trim()
    if (!id || !role) return
    setSessionId(id)
    connectToSession(id)
  }

  function connectToSession(id, { useDualCapture = false } = {}) {
    setListening(true)
    setMessages([])
    setChatHistory([])
    setStatus('Connecting...')

    const conn = connectSession({
      sessionId: id,
      onOpen: async () => {
        setStatus('Starting mic...')
        try {
          if (useDualCapture) {
            await callCapture.startDualCapture({
              ws: conn.ws,
              language,
            })
            setStatus('Live')
          } else {
            await callCapture.startMicOnly({
              ws: conn.ws,
              language,
              role,
            })
            setStatus(`Live as ${role}`)
          }
        } catch (err) {
          // Graceful fallback: if system capture fails, still run mic-only.
          if (useDualCapture) {
            try {
              await callCapture.startMicOnly({
                ws: conn.ws,
                language,
                role: 'patient',
              })
              setStatus('Live (mic-only fallback)')
              return
            } catch {
              // continue to error state below
            }
          }
          setStatus(err.name === 'NotAllowedError' ? 'Mic denied' : 'Mic error')
        }
      },
      onMessage: handleWsMessage,
      onClose: () => {
        setStatus('Disconnected')
        callCapture.stopAll()
      },
      onError: () => setStatus('Connection error'),
    })

    sessionRef.current = conn
    if (!conn.ws) setStatus('Demo mode')
  }

  function stopListening() {
    callCapture.stopAll()
    callCapture.setCapturePaused(false)
    setWidgetPaused(false)
    sessionRef.current?.close()
    sessionRef.current = null
    setListening(false)
    setStatus('')
    setSessionId('')
    setRole('patient')
    autoStartRef.current = false
  }

  function togglePauseCapture() {
    const next = !widgetPaused
    callCapture.setCapturePaused(next)
    setWidgetPaused(next)
    setStatus(next ? 'Paused' : 'Live')
    if (next) window.electronAPI?.pauseWidget?.()
    else window.electronAPI?.resumeWidget?.()
  }

  function handleWsMessage(data) {
    switch (data.type) {
      case 'connection_established':
        setStatus(widgetPaused ? 'Paused' : `Live — ${role}`)
        break
      case 'processing':
      case 'transcribing':
      case 'translating':
        setStatus(data.message || data.type)
        break
      case 'patient_message':
        setMessages((prev) => [...prev, {
          speaker: 'Patient',
          text: data.original,
          translatedText: data.fixed_english || data.translated,
          medicalFlags: data.medical_flags,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
        }])
        setStatus(widgetPaused ? 'Paused' : `Live — ${role}`)
        break
      case 'provider_message':
        setMessages((prev) => [...prev, {
          speaker: 'Doctor',
          text: data.original,
          simplified: data.simplified,
          translatedText: data.translated,
          suggestions: data.follow_up_suggestions,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
        }])
        if (data.audio_base64) playAudio(data.audio_base64)
        setStatus(widgetPaused ? 'Paused' : `Live — ${role}`)
        break
      case 'error':
        setStatus(`Error: ${data.message}`)
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

  const handleAskQuestion = useCallback(async () => {
    const q = chatInput.trim()
    if (!q) return
    setChatHistory((prev) => [...prev, { role: 'user', text: q }])
    setChatInput('')
    try {
      const res = await ragQuery({ question: q, sessionContext: messages })
      setChatHistory((prev) => [...prev, { role: 'assistant', text: res.answer }])
    } catch {
      setChatHistory((prev) => [...prev, { role: 'assistant', text: 'Sorry, I could not get an answer right now.' }])
    }
  }, [chatInput, messages])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskQuestion() }
  }

  // --- Not connected yet: show setup ---
  if (!listening) {
    return (
      <div className="w-full h-screen flex flex-col select-none" style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex flex-col h-full rounded-2xl overflow-hidden bg-[#0d1117]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl">
          <TitleBar compact={compact} setCompact={setCompact} showSettings={showSettings} setShowSettings={setShowSettings} listening={listening} status={status} />

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white/90">Widget ready</p>
                  <p className="text-[10px] text-white/50">Auto translation starts with one click.</p>
                </div>
                <button
                  onClick={handleQuickStart}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                >
                  Start
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70 hover:text-white"
            >
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </button>

            {showAdvanced && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Patient language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#161b22] px-3 py-2 text-xs text-white outline-none">
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <button onClick={handleCreate} className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500">
                    Create session (manual)
                  </button>
                  <div className="flex gap-2">
                    <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoin()} placeholder="Session code..." className="flex-1 rounded-lg border border-white/10 bg-[#161b22] px-3 py-2 text-xs text-white placeholder-white/30 outline-none" />
                    <button onClick={handleJoin} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500">
                      Join
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Active session ---
  return (
    <div className="w-full h-screen flex flex-col select-none" style={{ WebkitAppRegion: 'drag' }}>
      <div className="flex flex-col h-full rounded-2xl overflow-hidden bg-[#0d1117]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl">
        <TitleBar compact={compact} setCompact={setCompact} showSettings={showSettings} setShowSettings={setShowSettings} listening={listening} status={status} />

        {compact && (
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2" style={{ WebkitAppRegion: 'no-drag' }}>
            <button onClick={() => setMicMuted(!micMuted)} className={`rounded px-2 py-1 text-[10px] font-semibold ${micMuted ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {micMuted ? 'Mic Off' : 'Mic On'}
            </button>
            <button onClick={togglePauseCapture} className={`rounded px-2 py-1 text-[10px] font-semibold ${widgetPaused ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/80'}`}>
              {widgetPaused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={() => setCompact(false)} className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80">
              Expand
            </button>
          </div>
        )}

        {showSettings && (
          <div className="px-4 py-2 border-b border-white/5 space-y-2" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 w-14 shrink-0">Opacity</span>
              <input type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="flex-1 accent-emerald-400 h-1" />
              <span className="text-[10px] text-white/40 w-8 text-right">{Math.round(opacity * 100)}%</span>
            </div>
          </div>
        )}

        {!compact && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5" style={{ WebkitAppRegion: 'no-drag' }}>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${role === 'doctor' ? 'bg-blue-500/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              {role === 'doctor' ? 'Doctor' : 'Patient'}
            </span>
            <code className="text-[10px] text-white/30 font-mono">{sessionId.slice(0, 8)}</code>
            <button onClick={() => setMicMuted(!micMuted)} className={`ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium ${micMuted ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              <span className="material-symbols-outlined text-[12px]">{micMuted ? 'mic_off' : 'mic'}</span>
              {micMuted ? 'Muted' : 'Live'}
            </button>
          </div>
        )}

        {!compact && (
          <div className="flex border-b border-white/5" style={{ WebkitAppRegion: 'no-drag' }}>
            {['transcript', 'ask'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 text-xs py-2 font-medium transition-colors ${activeTab === tab ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/50 hover:text-white/80'}`}>
                {tab === 'transcript' ? 'Live Translation' : 'Ask a Question'}
              </button>
            ))}
          </div>
        )}

        <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ WebkitAppRegion: 'no-drag' }}>
          {(compact || activeTab === 'transcript') ? (
            messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm text-center">
                <div className="flex gap-1 mb-3">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.5s]" />
                </div>
                <p>Listening... speak on your call.</p>
              </div>
            ) : (
              visibleMessages.map((msg, i) => <MessageBubble key={i} msg={msg} myRole={role} />)
            )
          ) : (
            <>
              {chatHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm text-center">
                  <span className="material-symbols-outlined text-3xl mb-2">chat</span>
                  <p>Ask about anything from the conversation</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`text-sm rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-emerald-600/20 text-emerald-200 ml-8' : 'bg-white/5 text-white/90 mr-8'}`}>{msg.text}</div>
              ))}
            </>
          )}
        </div>

        {!compact && activeTab === 'ask' && (
          <div className="px-3 py-2 border-t border-white/10" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="flex gap-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="What does that mean?" className="flex-1 bg-[#161b22] text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-emerald-400/50 placeholder-white/30" />
              <button onClick={handleAskQuestion} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors">Ask</button>
            </div>
          </div>
        )}

        <div className="px-4 py-2 border-t border-white/10" style={{ WebkitAppRegion: 'no-drag' }}>
          <button onClick={stopListening} className="w-full flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg py-2 text-xs font-semibold transition-colors">
            <span className="material-symbols-outlined text-[14px]">stop_circle</span>
            End session
          </button>
        </div>

        <div className="h-1.5 cursor-ns-resize bg-transparent hover:bg-white/10 transition-colors" style={{ WebkitAppRegion: 'no-drag' }} />
      </div>
    </div>
  )
}

function TitleBar({ compact, setCompact, showSettings, setShowSettings, listening, status }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[#010409] border-b border-white/10">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${listening ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
        <BrandMark size="sm" showWordmark wordmarkClassName="text-xs font-semibold tracking-wide uppercase text-white/90" imgClassName="opacity-95 drop-shadow-[0_0_6px_rgba(0,109,104,0.45)]" />
        {status && <span className="text-[10px] text-white/40 ml-1 truncate max-w-[120px]">{status}</span>}
      </div>
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <button onClick={() => setShowSettings(!showSettings)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Settings">
          <span className="material-symbols-outlined text-[14px]">tune</span>
        </button>
        <button onClick={() => setCompact(!compact)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors" title={compact ? 'Expand' : 'Compact'}>
          <span className="material-symbols-outlined text-[14px]">{compact ? 'expand_content' : 'collapse_content'}</span>
        </button>
        <button onClick={() => window.electronAPI?.toggleOverlay(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors text-sm" title="Minimize">−</button>
      </div>
    </div>
  )
}

function MessageBubble({ msg, myRole }) {
  const isDoctor = msg.speaker === 'Doctor'
  const isMe = (isDoctor && myRole === 'doctor') || (!isDoctor && myRole === 'patient')

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`material-symbols-outlined text-[12px] ${isDoctor ? 'text-blue-400/70' : 'text-emerald-400/70'}`}>
          {isDoctor ? 'stethoscope' : 'person'}
        </span>
        <span className={`text-[10px] uppercase font-bold tracking-wider ${isDoctor ? 'text-blue-400/70' : 'text-emerald-400/70'}`}>
          {msg.speaker}{isMe ? ' (you)' : ''}
        </span>
        {msg.timestamp && <span className="text-[10px] text-white/30">{msg.timestamp}</span>}
      </div>
      <p className="text-sm leading-snug text-white/90">{msg.translatedText}</p>
      {isDoctor && msg.simplified && msg.simplified !== msg.text && (
        <p className="text-[11px] text-emerald-300/60 italic">Simplified: {msg.simplified}</p>
      )}
      {msg.text !== msg.translatedText && (
        <p className="text-xs text-white/30 italic">{msg.text}</p>
      )}
      {msg.medicalFlags?.symptoms?.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {msg.medicalFlags.symptoms.map((s, j) => (
            <span key={j} className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}
      {msg.suggestions?.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {msg.suggestions.map((s, j) => (
            <p key={j} className="text-[10px] text-blue-300/50">💡 {s}</p>
          ))}
        </div>
      )}
    </div>
  )
}
