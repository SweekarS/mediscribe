# MediScribe Demo Guide

Step-by-step script for demoing MediScribe end-to-end. Covers setup, both UI modes, the Electron overlay, and the backend pipeline.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Python | 3.9+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| `.env` file | — | Must have `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` |

> Snowflake keys are optional. Without them, RAG validation is skipped and everything else works.

---

## 1. Start the Backend

```bash
cd HOOHACKS
python3 -m venv .venv        # first time only
source .venv/bin/activate
pip install -r requirements.txt  # first time only
python manage.py migrate         # first time only
python manage.py runserver 8000
```

Wait for: `Listening on TCP address 127.0.0.1:8000`

Verify: open `http://localhost:8000/api/health/` — should return `{"status": "ok", "service": "VoiceBridge API"}`

---

## 2. Start the Frontend

In a second terminal:

```bash
cd HOOHACKS
npm install     # first time only
npm run dev
```

Wait for: `Local: http://localhost:5173/`

---

## 3. Demo Flow A — Solo demo (single computer)

From the dashboard, one person can control both the patient and doctor sides.

### Open it

Navigate to `http://localhost:5173/dashboard`, choose **Solo demo**, then **Start solo session**.

### Start a session

1. Pick a patient language (Spanish is the best demo language)
2. Click **Start solo session**
3. Status changes to **Connected** then **Ready**

### Demo the Doctor typing (Mode 1 — Simplify + Translate)

Type in the doctor text box:

```
You have acute pleuritic chest pain consistent with pericarditis. We need to do an echocardiogram and start you on NSAIDs.
```

Press Enter. Watch the pipeline:

- Status flashes **Simplifying & translating...** then **Generating speech...**
- A green doctor bubble appears with:
  - **Original**: the medical jargon
  - **Simplified**: plain English ("sharp pain in your chest... swelling around your heart... special picture test")
  - **Translated**: the Spanish version
  - **Audio player**: auto-plays the Spanish translation out loud
- **Right sidebar**: follow-up suggestions for the patient ("Ask: Is this serious?")

### Demo the Patient mic (Mode 2 — Translate + Grammar Recovery)

Two input methods:

**VAD mode** (recommended for demo):
1. Click **Patient** under the VAD row
2. Status shows **Patient: Listening for speech...**
3. Speak in Spanish (or any selected language): *"Me duele mucho el pecho cuando respiro, y siento que mi corazón late muy rápido"*
4. Stop talking — after ~800ms of silence, audio auto-sends
5. Status flashes **Listening...** then **Processing...**

**PTT mode** (fallback):
1. Hold the **Hold: Patient** button
2. Speak while holding
3. Release to send

What appears:

- A blue patient bubble with:
  - **Original**: the patient's words in their language
  - **Raw English** (struck through): rough direct translation
  - **Fixed English** (bold): professional medical English ("Patient reports significant chest pain on respiration with associated palpitations")
  - **Medical flags**: urgency tag (low/medium/high) + symptom chips

### Demo the Doctor mic (Mode 1 via audio)

1. Click **Doctor** under VAD (or hold **Hold: Doctor** for PTT)
2. Speak in English: *"I need to run some blood tests and check your heart rhythm"*
3. Same output as typing — the audio gets STT'd first, then simplified + translated

### End the session

Click **End Session**. Backend generates an AI clinical summary (visible in Past Visits).

---

## 4. Demo Flow B — Live Consultation (Two-Client Mode)

This is the patient-facing UI. Two separate browser tabs (or devices) connect to the same session.

### Open it

Navigate to `http://localhost:5173/dashboard` (the default dashboard page)

### Client 1 — Create

1. Choose a role: **Patient** or **Doctor**
2. Pick the patient language
3. Click **Create**
4. A session code appears — copy it

### Client 2 — Join

1. Open a second browser tab to `http://localhost:5173/dashboard`
2. Pick the opposite role
3. Paste the session code
4. Click **Join**

Both clients now share a live WebSocket session. Each person's microphone is continuously captured and tagged with the correct direction (patient or doctor). Translations appear on both screens in real time.

### Key things to point out

- The status pill in the header shows live pipeline steps (Listening, Processing, Generating speech)
- The **Insights** sidebar on the right aggregates medical symptoms and follow-up suggestions across the entire conversation
- The mic mute button lets you temporarily silence your mic without disconnecting

---

## 5. Demo Flow C — Electron Desktop Overlay

The overlay floats on top of any video call (Zoom, Google Meet, FaceTime).

### Launch it

```bash
npm run electron:dev
```

This starts Vite + Electron. The main dashboard opens in a native window, and a floating overlay is available via:
- **System tray icon** (click to toggle)
- **Cmd+Shift+M** (global shortcut)

### How system audio capture works

When running in Electron, `getDisplayMedia` is auto-granted via `setDisplayMediaRequestHandler` with loopback audio. The app captures whatever audio is playing through the system (the doctor's voice on a Zoom call) and routes it to the backend as `provider_to_patient` direction.

### Overlay features

- **Compact mode**: click the collapse button — shrinks to show only the last 2 messages
- **Opacity slider**: settings gear lets you adjust overlay transparency
- **Two tabs**: Live Translation (transcript) and Ask a Question (RAG-powered Q&A)
- **Content-protected**: the overlay window is invisible to screen recording/sharing

---

## 6. Past Visits & Session Summary

Navigate to `http://localhost:5173/dashboard/history`

- Shows all completed sessions with timestamps and language
- Expand any session to see:
  - **AI Summary**: structured clinical summary (Chief Complaint, Symptoms, Urgency Assessment, Follow-up Actions)
  - **Full transcript**: every message in order

---

## 7. Backend-Only Quick Test

If you just want to verify the backend pipeline without the UI:

```bash
source .venv/bin/activate
python test_ws.py
```

This script:
1. Creates a session via REST API
2. Connects via WebSocket
3. Sends 3 doctor messages
4. Verifies Gemini returns real translations (not mock)
5. Verifies ElevenLabs generates audio

Expected output: `Test PASSED — Gemini + ElevenLabs both working!`

### Manual cURL tests

```bash
# Health check
curl -s http://localhost:8000/api/health/ | python3 -m json.tool

# Create a session
curl -s -X POST http://localhost:8000/api/sessions/ \
  -H "Content-Type: application/json" \
  -d '{"provider_id":"demo","patient_language":"es"}' | python3 -m json.tool

# End session (replace SESSION_ID)
curl -s -X POST http://localhost:8000/api/sessions/SESSION_ID/end/ | python3 -m json.tool

# Get AI summary
curl -s http://localhost:8000/api/sessions/SESSION_ID/summary/ | python3 -m json.tool
```

---

## 8. API Cost Estimate (Demo Budget)

| Action | API Calls | Services |
|---|---|---|
| Doctor types a message | 2 | Gemini (simplify + translate) + ElevenLabs TTS |
| Doctor mic (per chunk) | 3 | ElevenLabs STT + Gemini + ElevenLabs TTS |
| Patient mic (per chunk) | 2 | ElevenLabs STT + Gemini (translate + grammar fix) |

A typical 3-minute demo with 10-15 exchanges costs ~25-40 API calls total.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Status stuck on "Connecting..." | Backend must be running on port 8000 |
| "Mic error: NotAllowedError" | Use Chrome (not Safari). Must be on `localhost` |
| No "Simplified" text appears | `GEMINI_API_KEY` not set or invalid in `.env` |
| Audio doesn't play | Chrome blocks autoplay — click the speaker icon in address bar. Check `ELEVENLABS_API_KEY` |
| "Address already in use" | `lsof -ti:8000 \| xargs kill -9` |
| Translation says "(mock)" | API key is missing — check `.env` |
| WebSocket disconnects immediately | Backend crashed — check the Django terminal for errors |
| VAD not detecting speech | Speak clearly, at least 300ms. Check mic permissions in browser settings |
| Electron overlay not appearing | Press Cmd+Shift+M or click the tray icon |

---

## 10. Demo Script (3-Minute Pitch)

**[0:00 — 0:30] Problem statement**
> "37 million Americans have limited English. In a medical visit, miscommunication can be life-threatening. Interpreters cost $150/hour and aren't always available."

**[0:30 — 1:00] Show the landing page**
> Open `localhost:5173`. Walk through the hero, the "How it works" section, and the tech stack logos.

**[1:00 — 2:00] Live demo on Solo demo (dashboard → Solo demo)**
> Start a session in Spanish. Type a complex doctor message. Show the simplification + translation + audio. Then speak into the patient mic in Spanish. Show the grammar recovery + medical flags.

**[2:00 — 2:30] Show the Insights sidebar**
> Point out how symptoms accumulate, urgency flags auto-update, and follow-up suggestions are clickable.

**[2:30 — 3:00] Architecture + what's next**
> "Backend is Django + Channels. Gemini handles the cognitive translation — not just word-for-word, but jargon simplification and grammar recovery. ElevenLabs does STT and TTS. Snowflake Cortex validates medical terms against real ICD-10 codes."

---

## Supported Languages

| Code | Language |
|---|---|
| `es` | Spanish |
| `zh` | Mandarin Chinese |
| `vi` | Vietnamese |
| `fr` | French |
| `pt` | Portuguese |
| `ar` | Arabic |
| `hi` | Hindi |
| `ne` | Nepali |
