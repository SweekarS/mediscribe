import { getApiBaseUrl, getWsBaseUrl } from '../lib/devApiBase.js'

const BASE_URL = getApiBaseUrl()
const WS_BASE = getWsBaseUrl(BASE_URL)
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------

async function jsonPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function jsonGet(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Sessions (real backend endpoints)
// ---------------------------------------------------------------------------

export async function createSession({ providerId = 'doctor_1', patientLanguage = 'es' } = {}) {
  return jsonPost('/api/sessions/', { provider_id: providerId, patient_language: patientLanguage })
}

export async function getSession(sessionId) {
  return jsonGet(`/api/sessions/${sessionId}/`)
}

export async function listSessions(providerId) {
  return jsonGet(`/api/sessions/?provider_id=${encodeURIComponent(providerId)}`)
}

export async function endSession(sessionId) {
  return jsonPost(`/api/sessions/${sessionId}/end/`, {})
}

export async function getSessionSummary(sessionId) {
  return jsonGet(`/api/sessions/${sessionId}/summary/`)
}

export async function getSessionMessages(sessionId) {
  return jsonGet(`/api/sessions/${sessionId}/messages/`)
}

export async function healthCheck() {
  return jsonGet('/api/health/')
}

// ---------------------------------------------------------------------------
// RAG question helper (used by Electron overlay Ask tab)
// ---------------------------------------------------------------------------

export async function ragQuery({ question, sessionContext }) {
  if (!USE_MOCK) {
    try {
      const res = await fetch(`${BASE_URL}/api/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, sessionContext }),
      })
      if (res.ok) return res.json()
    } catch {
      // Fall through to local fallback response.
    }
  }

  await delay(600)
  const q = (question || '').toLowerCase()
  let answer = 'Based on your visit, this sounds like a common diagnostic step. Ask your care team if you want more detail on why each test is being ordered.'
  if (q.includes('hypertension') || q.includes('blood pressure')) {
    answer = 'Hypertension means blood pressure is consistently high. Doctors usually monitor it over time and may recommend lifestyle changes and medication.'
  } else if (q.includes('troponin') || q.includes('blood test')) {
    answer = 'Troponin is a blood marker doctors use to check possible heart muscle injury. It helps decide whether chest pain could be heart-related.'
  } else if (q.includes('ekg') || q.includes('ecg') || q.includes('electrocardiogram')) {
    answer = 'An EKG records your heart’s electrical activity. It is quick and painless and helps detect rhythm or heart strain issues.'
  }

  return {
    answer,
    sources: [
      { title: 'MedlinePlus', url: 'https://medlineplus.gov' },
      { title: 'Mayo Clinic', url: 'https://www.mayoclinic.org' },
    ],
  }
}

// ---------------------------------------------------------------------------
// WebSocket — real connection with mock fallback
// ---------------------------------------------------------------------------

export function connectSession({ sessionId, onMessage, onClose, onError, onOpen } = {}) {
  if (USE_MOCK) {
    return _connectSessionMock({ onMessage, onClose })
  }

  const wsUrl = `${WS_BASE}/ws/session/${sessionId}/`
  const ws = new WebSocket(wsUrl)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => onOpen?.()
  ws.onerror = (event) => onError?.(event)
  ws.onclose = (event) => onClose?.(event)

  ws.onmessage = (event) => {
    if (typeof event.data === 'string') {
      try { onMessage?.(JSON.parse(event.data)) } catch { /* ignore parse errors */ }
    }
  }

  return {
    ws,
    send: (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data))
      }
    },
    sendAudio: async (blob, direction, patientLanguage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'audio_metadata', direction, patient_language: patientLanguage }))
        const buf = await blob.arrayBuffer()
        ws.send(buf)
      }
    },
    sendText: (text, patientLanguage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'provider_text', text, patient_language: patientLanguage }))
      }
    },
    close: () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Mock fallback (for dev without Django backend running)
// ---------------------------------------------------------------------------

function _connectSessionMock({ onMessage, onClose } = {}) {
  let closed = false

  const mockMessages = [
    { type: 'patient_message', speaker: 'Patient', original: 'Me duele mucho el pecho.', translated: 'My chest hurts a lot.', medical_flags: { symptoms: ['chest pain'] }, patient_language: 'es' },
    { type: 'provider_message', speaker: 'Doctor', original: 'When did the pain start?', translated: '¿Cuándo empezó el dolor?', audio_base64: '', patient_language: 'es' },
    { type: 'patient_message', speaker: 'Patient', original: 'Empezó ayer por la noche.', translated: 'It started last night.', medical_flags: {}, patient_language: 'es' },
    { type: 'provider_message', speaker: 'Doctor', original: 'Does it get worse when you breathe deeply?', translated: '¿Empeora cuando respira profundo?', audio_base64: '', patient_language: 'es' },
    { type: 'patient_message', speaker: 'Patient', original: 'Sí, mucho peor.', translated: 'Yes, much worse.', medical_flags: { symptoms: ['pleuritic pain'] }, patient_language: 'es' },
    { type: 'provider_message', speaker: 'Doctor', original: "I'd like to order a troponin test and an EKG.", translated: 'Me gustaría ordenar una prueba de troponina y un EKG.', audio_base64: '', patient_language: 'es' },
  ]

  setTimeout(() => {
    if (!closed) onMessage?.({ type: 'connection_established', session_id: 'mock', message: 'Mock session connected.' })
  }, 100)

  let idx = 0
  const interval = setInterval(() => {
    if (closed || idx >= mockMessages.length) {
      clearInterval(interval)
      if (!closed) onClose?.()
      return
    }
    const msg = { ...mockMessages[idx], timestamp: new Date().toLocaleTimeString() }
    onMessage?.(msg)
    idx++
  }, 3000)

  return {
    ws: null,
    send: () => {},
    sendAudio: () => {},
    sendText: () => {},
    close: () => {
      closed = true
      clearInterval(interval)
      onClose?.()
    },
  }
}
