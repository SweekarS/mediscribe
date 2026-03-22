# MediScribe

**Real-time AI medical interpreter.** Patient speaks their language, doctor sees English + medical flags. Doctor responds, patient hears their language — simplified, translated, and spoken aloud.

Built at **HooHacks 2026**.

---

## The Problem

37 million Americans have limited English proficiency. In medical settings, miscommunication leads to misdiagnosis, medication errors, and worse outcomes. Professional interpreters cost $150+/hour and are frequently unavailable.

## The Solution

MediScribe sits between doctor and patient during a live visit. It does more than translate — it simplifies medical jargon to a 5th-grade reading level, translates to the patient's language, speaks it aloud, and flags clinical signals for the doctor.

---

## Architecture

```
DOCTOR → PATIENT (Mode 1: Simplify + Translate)
  Doctor speaks/types English
  → ElevenLabs STT (if audio)
  → Gemini: simplify jargon to 5th-grade level + translate to patient language
  → ElevenLabs TTS: speak translated text to patient
  → Frontend: shows original → simplified → translated + audio

PATIENT → DOCTOR (Mode 2: Translate + Grammar Recovery)
  Patient speaks their language
  → ElevenLabs STT (transcribe in source language)
  → Gemini: translate to English + grammar recovery → professional medical English
  → Frontend: shows original → fixed English + medical flags + urgency
```

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, React Router 7 |
| **Desktop** | Electron 35 (overlay, system audio capture, tray) |
| **Backend** | Django 4, Django REST Framework, Django Channels, Daphne (ASGI) |
| **AI — Translation** | Google Gemini 2.5 Flash (jargon simplification, translation, grammar recovery, session summaries) |
| **AI — Speech** | ElevenLabs Scribe v1 (STT), ElevenLabs Multilingual v2 (TTS) |
| **AI — Validation** | Snowflake Cortex (RAG-powered medical term validation, ICD-10 lookup) |
| **Real-time** | WebSockets via Django Channels, Voice Activity Detection (Silero VAD) |
| **Database** | SQLite (dev) / PostgreSQL (prod), Redis for channel layers |

---

## Quick Start

You need **two terminal windows**.

### Terminal 1 — Backend (Django)

```bash
cd HOOHACKS
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in your API keys
python manage.py migrate
python manage.py runserver 8000
```

Backend runs at **http://localhost:8000**

### Terminal 2 — Frontend (React)

```bash
cd HOOHACKS
npm install
npm run dev
```

Frontend runs at **http://localhost:5173** (use the exact URL Vite prints if the port changes).

### That's it.

Open **http://localhost:5173** in Chrome.

**Before hacking:** run `pip install -r requirements.txt` whenever `requirements.txt` changes (otherwise Django may crash on import). Vite **proxies** `/api` and `/ws` to `http://127.0.0.1:8000`, so the UI talks to Django on the **same origin** as the dev server — no manual CORS dance. If port `5173` is busy, kill old `vite` processes or you’ll get a random port **without** noticing.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Key | Required | Source |
|---|---|---|
| `GEMINI_API_KEY` | Yes | [Google AI Studio](https://aistudio.google.com) |
| `ELEVENLABS_API_KEY` | Yes | [ElevenLabs Dashboard](https://elevenlabs.io) |
| `SNOWFLAKE_ACCOUNT` | No | Snowflake console |
| `SNOWFLAKE_USER` | No | Snowflake console |
| `SNOWFLAKE_PASSWORD` | No | Snowflake console |

Everything works without Snowflake — it gracefully skips RAG validation.

---

## Features

### Two-Mode Gemini Pipeline

- **Mode 1 (Doctor → Patient)**: Simplifies medical jargon to a 5th-grade reading level, translates to the patient's language, generates follow-up suggestions the patient could ask
- **Mode 2 (Patient → Doctor)**: Translates patient speech to English, applies grammar recovery to produce professional medical English, extracts symptoms/urgency/follow-up flags

### Voice Activity Detection (VAD)

Silero VAD runs in the browser via ONNX Runtime. Auto-detects when someone starts and stops talking (800ms silence threshold). No button required — just speak.

### Electron Desktop Overlay

- Floating always-on-top overlay for use during any video call (Zoom, Meet, FaceTime)
- Captures system audio via `getDisplayMedia` loopback (auto-granted in Electron)
- Compact mode, adjustable opacity, content-protected from screen sharing
- Global shortcut: `Cmd+Shift+M`
- System tray with badge notifications

### Live Consultation (Two-Client Mode)

Both doctor and patient open MediScribe on separate devices. One creates a session, shares the code, the other joins. Both mics are captured and tagged with the correct direction.

### Session History & AI Summaries

When a session ends, Gemini generates a structured clinical summary: chief complaint, reported symptoms, relevant history, urgency assessment, and recommended follow-up actions.

### Ask a Question (RAG)

In the Electron overlay, the patient can type questions like "What does troponin mean?" and get plain-language answers powered by Snowflake Cortex (with mock fallback).

---

## Backend API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health/` | Health check |
| `POST` | `/api/sessions/` | Create a new session |
| `GET` | `/api/sessions/?provider_id=xxx` | List sessions for a provider |
| `GET` | `/api/sessions/<id>/` | Get session detail + full transcript |
| `POST` | `/api/sessions/<id>/end/` | End session, generate AI summary |
| `GET` | `/api/sessions/<id>/summary/` | Get the AI-generated clinical summary |
| `GET` | `/api/sessions/<id>/messages/` | Get all messages for a session |
| `DELETE` | `/api/sessions/<id>/` | Delete a session |

### WebSocket

```
ws://localhost:8000/ws/session/<session_id>/
```

**Client → Server:**
- `{ "type": "provider_text", "text": "...", "patient_language": "es" }` — doctor types a message
- `{ "type": "audio_metadata", "direction": "patient_to_provider", "patient_language": "es" }` followed by binary audio frame — patient speaks
- `{ "type": "audio_metadata", "direction": "provider_to_patient", "patient_language": "es" }` followed by binary audio frame — doctor speaks

**Server → Client:**
- `{ "type": "provider_message", "original", "simplified", "translated", "audio_base64", "follow_up_suggestions" }`
- `{ "type": "patient_message", "original", "raw_english", "fixed_english", "medical_flags" }`
- `{ "type": "processing", "step": "transcribing|gemini|tts", "message": "..." }`

---

## Project Structure

```
HOOHACKS/
├── core/                        # Django project config
│   ├── settings.py              # DB, channels, CORS, logging
│   ├── asgi.py                  # ASGI + WebSocket routing
│   └── urls.py                  # /admin + /api/
├── interpreter/                 # Backend app — all AI logic
│   ├── consumers.py             # WebSocket consumer (Mode 1 + Mode 2 pipelines)
│   ├── views.py                 # REST endpoints (sessions, health, summary)
│   ├── gemini_client.py         # Gemini translation, simplification, summaries
│   ├── elevenlabs_client.py     # ElevenLabs TTS (multilingual_v2)
│   ├── snowflake_client.py      # Snowflake Cortex RAG validation
│   ├── models.py                # Session + Message models (UUID PKs)
│   ├── serializers.py           # DRF serializers
│   ├── auth.py                  # Auth0 JWT middleware (skip in dev)
│   └── routing.py               # WebSocket URL routing
├── src/                         # React frontend
│   ├── pages/
│   │   ├── LandingPage.jsx      # Marketing landing page
│   │   ├── LoginPage.jsx        # Auth page (demo mode)
│   │   └── dashboard/
│   │       ├── LiveConsultation.jsx  # Remote visit (create/join) + Solo demo (dual VAD / PTT)
│   │       ├── HistoryPage.jsx       # Past sessions + AI summaries
│   │       ├── PatientsPage.jsx      # Patient profile
│   │       └── SettingsPage.jsx      # Preferences (language, mic, display)
│   ├── services/
│   │   ├── api.js               # REST + WebSocket client (with mock fallback)
│   │   ├── audioStream.js       # Mic → WebSocket streaming (250ms chunks)
│   │   └── callCapture.js       # Dual-stream capture (system audio + mic)
│   ├── hooks/useVAD.js          # Silero Voice Activity Detection hook
│   ├── overlay/
│   │   ├── OverlayApp.jsx       # Electron overlay UI
│   │   └── overlay-entry.jsx    # Overlay mount point
│   ├── components/              # Navbar, Footer, Sidebar, BrandMark, Modal
│   ├── context/                 # DashboardSession + Toast contexts
│   └── layouts/DashboardLayout.jsx
├── electron/
│   ├── main.js                  # Electron main process (tray, overlay, IPC)
│   └── preload.js               # Context bridge API
├── manage.py
├── package.json
├── requirements.txt
├── vite.config.js
├── docker-compose.yml           # Postgres + Redis for production
├── demo-guide.md                # Full demo walkthrough
└── .env.example
```

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

---

## Brand assets (logo & favicon)

Single source file: `public/logo-source.png`. Replace it with your mark, then run:

```bash
npm run make:favicon
```

This regenerates `public/favicon.png`, copies the source to `public/mediscribe-logo.png` for the UI, writes `electron/assets/icon.png`, and all tray PNGs under `electron/assets/`. The favicon and app icon are the same square letterboxed render of the full logo (not a circular crop), matching what you see in the UI.

---

## Running the Electron App

```bash
npm run electron:dev
```

This starts Vite and Electron simultaneously. The main window loads the dashboard. Toggle the overlay with `Cmd+Shift+M` or the system tray icon.

To build a distributable:

```bash
npm run electron:build
```

Outputs to `/release` — DMG/ZIP for macOS, NSIS for Windows, AppImage for Linux.

---

## Running Tests

```bash
# Backend end-to-end test (requires running backend)
source .venv/bin/activate
python test_ws.py

# Quick smoke test
curl -s http://localhost:8000/api/health/ | python3 -m json.tool
```

See [demo-guide.md](demo-guide.md) for the full demo walkthrough and troubleshooting.

---

## Team

- **Sabal** — Architecture, Backend, Electron, AI Pipeline
- **Hung** — Co-Architect, Snowflake RAG Integration
- **Teammate 3** — Frontend Pages (Landing, Login, Dashboard)
- **Teammate 4** — Live Consultation UI, Overlay
