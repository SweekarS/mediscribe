# Testing Guide — MediScribe Live session

## Architecture Overview

```
DOCTOR → PATIENT (Mode 1: Simplify + Translate)
  Doctor speaks English
  → 11 Labs STT (if mic)
  → Gemini: simplify jargon to 5th-grade level + translate to patient's language
  → 11 Labs TTS: speak translated text to patient
  → Frontend: shows original → simplified → translated + audio

PATIENT → DOCTOR (Mode 2: Translate + Grammar Recovery)
  Patient speaks their language
  → 11 Labs STT (transcribe in source language)
  → Gemini: translate to English + fix grammar → professional medical English
  → Frontend: shows original → fixed English + medical flags
```

The mic uses a **12-second auto-buffer** — press once to start, audio is automatically
sent every 12 seconds. No manual stopping between sentences.

---

## Quick Start

### Terminal 1 — Backend

```bash
cd HOOHACKS
source .venv/bin/activate
python manage.py runserver 8000
```

You should see: `Listening on TCP address 127.0.0.1:8000`

### Terminal 2 — Frontend

```bash
cd HOOHACKS
npm run dev
```

You should see: `Local: http://localhost:5173/`

---

## Test 1: Health Check

```
http://localhost:8000/api/health/
```

Expected: `{"status": "ok", "service": "VoiceBridge API"}`

---

## Test 2: Open Solo demo

1. Open **http://localhost:5173/dashboard** in Chrome
2. Choose **Solo demo**, pick a patient language (Spanish, Hindi, Nepali, etc.)
3. Click **Start solo session**
4. Status should show "Ready"

---

## Test 3: Doctor Types a Complex Message (Mode 1)

This tests the **jargon simplification pipeline**.

1. In the text box, type:
   ```
   You have acute pleuritic chest pain consistent with pericarditis. We need to do an echocardiogram and start you on NSAIDs.
   ```
2. Press Enter

**What you should see:**

- A green doctor bubble with:
  - **Original**: the full medical jargon
  - **Simplified** (green box): "You have chest pain that feels sharp... swelling around your heart... special picture test..."
  - **Translated**: Spanish (or whichever language) version
  - **Audio player**: auto-plays the translated speech
- In the **sidebar**: follow-up suggestions like "Is this serious?"

This proves Gemini Mode 1 is working — it simplified "pericarditis" to "swelling around your heart" and "echocardiogram" to "special picture test."

---

## Test 4: Patient Speaks Into Mic (Mode 2)

This tests the **grammar recovery pipeline**.

1. Click **🎤 Patient Mic** to start continuous recording
2. Speak in the patient's language (e.g. Spanish: "Me duele mucho el pecho cuando respiro, y siento que mi corazón late muy rápido")
3. Wait 12 seconds for auto-send, OR click **⏹ Stop Patient** to send immediately
4. Watch the processing steps: "Listening..." → "Processing..."

**What you should see:**

- A blue patient bubble with:
  - **Original**: text in patient's language
  - **Raw English** (struck through): the imperfect direct translation
  - **Fixed English** (white, bold): professional medical English (e.g. "The patient reports significant chest pain on respiration with associated palpitations")
  - **Medical flags**: urgency level, symptoms, suggested follow-up questions

This proves Mode 2 is working — it translated AND restructured the grammar.

---

## Test 5: Doctor Speaks Into Mic (Mode 1 via audio)

1. Click **🩺 Doctor Mic**
2. Speak in English: "I need to run some blood tests and check your heart rhythm"
3. Wait 12 seconds or stop
4. The audio gets: STT → Mode 1 simplify → translate → TTS

Same output as Test 3, but starting from audio instead of text.

---

## Test 6: Follow-Up Suggestions

As the conversation progresses:
- **Right sidebar** fills with suggestions
- "Patient could ask" — questions Gemini suggests for the patient
- "Doctor follow-ups" — clickable questions that auto-send when clicked

Click a doctor follow-up to test the one-click send.

---

## Test 7: End Session

Click **End Session**. The message history stays visible.

---

## How the 12-Second Buffer Works

When you press a mic button:
1. Recording starts immediately (red indicator in header)
2. Every 12 seconds, the recorded chunk is sent to the backend
3. Backend processes it: STT → Gemini → (TTS if doctor)
4. Result appears as a message bubble
5. Recording continues until you press Stop

This is the "demo sweet spot" — long enough for coherent sentences, short enough
to feel real-time. No excess API calls.

---

## What Each API Call Costs

| Action | API Calls | Services Used |
|--------|-----------|---------------|
| Doctor types a message | 2 | Gemini (simplify+translate) + 11 Labs TTS |
| Doctor mic (12s chunk) | 3 | 11 Labs STT + Gemini + 11 Labs TTS |
| Patient mic (12s chunk) | 2 | 11 Labs STT + Gemini (translate+fix) |

A typical 3-minute demo = ~10-15 exchanges = ~25-40 API calls total.

---

## Troubleshooting

### Status stuck on "Connecting..."
- Backend must be running on port 8000
- Check backend terminal for errors

### "Mic error: NotAllowedError"
- Use Chrome, not Safari
- Must be on `localhost` (not `127.0.0.1`)

### No "Simplified" text appears
- Check that `GEMINI_API_KEY` is set in `.env`
- Without it, you get mock responses

### Audio doesn't play
- Chrome may block autoplay — click the speaker icon in address bar
- Check `ELEVENLABS_API_KEY` is set

### "Address already in use"
```bash
lsof -ti:8000 | xargs kill -9
```

---

## Command-Line Quick Test

```bash
source .venv/bin/activate

# Health check
curl -s http://localhost:8000/api/health/ | python -m json.tool

# Create session
curl -s -X POST http://localhost:8000/api/sessions/ \
  -H "Content-Type: application/json" \
  -d '{"provider_id":"test","patient_language":"es"}' | python -m json.tool
```

For a WebSocket test: `python test_ws.py`
