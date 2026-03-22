/**
 * callCapture — Dual-stream audio capture for the Cluely-style call listener.
 *
 * Captures TWO independent audio streams simultaneously:
 *   1. System audio (loopback) — the doctor's voice coming through speakers
 *   2. Microphone — the patient's voice
 *
 * Both streams are chunked via MediaRecorder and sent over the same WebSocket
 * with different `direction` metadata so the backend pipelines them correctly.
 *
 * In Electron: uses getDisplayMedia (auto-granted via setDisplayMediaRequestHandler
 *   with loopback audio) for system audio.
 * In browser: falls back to getDisplayMedia with user prompt.
 */

const TIMESLICE_MS = 1500
const MIME_TYPE = 'audio/webm;codecs=opus'

let systemStream = null
let micStream = null
let systemRecorder = null
let micRecorder = null
let activeWs = null
let activeLang = 'es'
let activeRole = 'patient'
let micMuted = false
let systemMuted = false
let capturePaused = false

function recorderOptions() {
  return MediaRecorder.isTypeSupported(MIME_TYPE) ? { mimeType: MIME_TYPE } : {}
}

function sendChunk(blob, direction) {
  if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return
  if (capturePaused) return
  if (blob.size < 500) return

  activeWs.send(JSON.stringify({
    type: 'audio_metadata',
    direction,
    patient_language: activeLang,
  }))
  blob.arrayBuffer().then((buf) => {
    if (activeWs?.readyState === WebSocket.OPEN) {
      activeWs.send(buf)
    }
  })
}

/**
 * Start capturing system audio (doctor) via getDisplayMedia.
 * In Electron, setDisplayMediaRequestHandler auto-grants with loopback.
 * In browsers, the user picks a tab/screen to share.
 */
async function startSystemCapture() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { width: 1, height: 1, frameRate: 1 },
    audio: true,
  })

  stream.getVideoTracks().forEach((t) => t.stop())
  const audioTracks = stream.getAudioTracks()
  if (audioTracks.length === 0) {
    throw new Error('No system audio track — user may have denied audio sharing')
  }

  systemStream = new MediaStream(audioTracks)
  systemRecorder = new MediaRecorder(systemStream, recorderOptions())

  systemRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && !systemMuted) {
      sendChunk(e.data, 'provider_to_patient')
    }
  }

  systemRecorder.start(TIMESLICE_MS)
}

/**
 * Start capturing microphone (patient voice).
 */
async function startMicCapture(deviceId) {
  const constraints = {
    audio: deviceId
      ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true },
  }

  micStream = await navigator.mediaDevices.getUserMedia(constraints)
  micRecorder = new MediaRecorder(micStream, recorderOptions())

  micRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && !micMuted) {
      sendChunk(e.data, 'patient_to_provider')
    }
  }

  micRecorder.start(TIMESLICE_MS)
}

/**
 * Start both captures. System audio = doctor, mic = patient.
 * Use this for single-client (Cluely) mode.
 *
 * @param {object} opts
 * @param {WebSocket} opts.ws - open WebSocket connection
 * @param {string} opts.language - patient language code
 * @param {string} [opts.micDeviceId] - specific mic device
 */
export async function startDualCapture({ ws, language, micDeviceId } = {}) {
  activeWs = ws
  activeLang = language

  await Promise.all([
    startSystemCapture(),
    startMicCapture(micDeviceId),
  ])
}

/**
 * Start mic-only capture with explicit direction.
 * Use this for 2-client mode: each person picks a role (patient or doctor)
 * and their mic audio is tagged with the correct direction.
 *
 * @param {object} opts
 * @param {WebSocket} opts.ws - open WebSocket connection
 * @param {string} opts.language - patient language code
 * @param {'patient'|'doctor'} opts.role - who is speaking on this client
 * @param {string} [opts.micDeviceId] - specific mic device
 */
export async function startMicOnly({ ws, language, role, micDeviceId } = {}) {
  activeWs = ws
  activeLang = language
  activeRole = role

  const constraints = {
    audio: micDeviceId
      ? { deviceId: { exact: micDeviceId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true },
  }

  micStream = await navigator.mediaDevices.getUserMedia(constraints)
  micRecorder = new MediaRecorder(micStream, recorderOptions())

  const direction = role === 'doctor' ? 'provider_to_patient' : 'patient_to_provider'

  micRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && !micMuted) {
      sendChunk(e.data, direction)
    }
  }

  micRecorder.start(TIMESLICE_MS)
}

/** Stop all captures and release all tracks. */
export function stopAll() {
  if (systemRecorder?.state !== 'inactive') systemRecorder?.stop()
  if (micRecorder?.state !== 'inactive') micRecorder?.stop()
  systemRecorder = null
  micRecorder = null

  systemStream?.getTracks().forEach((t) => t.stop())
  micStream?.getTracks().forEach((t) => t.stop())
  systemStream = null
  micStream = null
  activeWs = null
}

export function setMicMuted(value) {
  micMuted = value
  micStream?.getAudioTracks().forEach((t) => { t.enabled = !value })
}

export function setSystemMuted(value) {
  systemMuted = value
}

export function setCapturePaused(value) {
  capturePaused = value
}

export function isMicMuted() { return micMuted }
export function isSystemMuted() { return systemMuted }
export function isCapturePaused() { return capturePaused }

export function isCapturing() {
  return (
    (systemRecorder?.state === 'recording') ||
    (micRecorder?.state === 'recording')
  )
}

export function isMicCapturing() {
  return micRecorder?.state === 'recording'
}

export function isSystemCapturing() {
  return systemRecorder?.state === 'recording'
}

export async function listMicrophones() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === 'audioinput')
}
