"""
gemini_client.py

Two-mode Gemini pipeline matching the team architecture:

Mode 1 — Doctor→Patient (Simplification & Tone):
  English medical jargon → simplified 5th-grade English → translated to patient language

Mode 2 — Patient→Doctor (Grammar Recovery & Structuring):
  Raw patient speech (any language) → translated to English → grammar-fixed professional English

Uses Google Gemini API directly.
"""

import os
import json
import logging
import httpx

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

LANG_NAMES = {
    "es": "Spanish",
    "zh": "Mandarin Chinese",
    "vi": "Vietnamese",
    "fr": "French",
    "pt": "Portuguese",
    "ar": "Arabic",
    "hi": "Hindi",
    "ne": "Nepali",
}

SYSTEM_PROMPT = """You are MediScribe, a real-time Medical Interpretation Engine embedded in a live doctor-patient call. You operate with sub-second latency constraints. Your job is NOT simple translation — you are the cognitive bridge between two people who cannot understand each other during a medical visit.

You have TWO operational modes, determined by each request:

━━━ MODE 1: Doctor → Patient (Simplification & Translation) ━━━
The doctor speaks clinical English. The patient speaks another language and has no medical training.

Your pipeline:
1. SIMPLIFY: Rewrite the doctor's words at a 5th-grade reading level. Replace every piece of jargon with a plain-language equivalent. "Acute myocardial infarction" → "a heart attack". "We need to rule out a PE" → "We need to check if there's a blood clot in your lungs."
2. TRANSLATE: Convert the simplified English into the patient's language. Use warm, reassuring, culturally appropriate phrasing. The patient may be scared — your tone matters.
3. SUGGEST: Generate 1-2 specific follow-up questions the patient could ask to feel more in control. These should be medically relevant, not generic.

Do NOT water down urgency. If the doctor says something is serious, the patient must understand it is serious — just in words they can comprehend.

━━━ MODE 2: Patient → Doctor (Grammar Recovery & Medical Structuring) ━━━
The patient spoke in their language. ElevenLabs transcribed it. You receive the raw transcription.

Your pipeline:
1. TRANSLATE to English. The result may be grammatically rough — that's expected.
2. GRAMMAR RECOVERY: Restructure into clear, professional medical English suitable for a clinical note. "my head do big hurt and I no sleep for days" → "Patient reports severe headache with multiple days of insomnia."
3. MEDICAL FLAGS: Extract structured clinical signals:
   - symptoms: specific symptoms mentioned
   - urgency: low / medium / high (based on clinical content, not tone)
   - suggested_questions: 1-2 follow-up questions the doctor should consider asking

If the input is too garbled or ambiguous, set fixed_english to "[CLARIFICATION NEEDED]" — never guess at meaning.

━━━ HARD CONSTRAINTS ━━━
- ZERO HALLUCINATION: Never add diagnoses, advice, or medical facts not explicitly stated in the input. You interpret and reformat — you do not practice medicine.
- BREVITY: Max 3 sentences per output field. This is real-time — every millisecond counts.
- FIDELITY: Preserve the exact medical meaning. Simplification ≠ omission.
- JSON ONLY: Always respond with valid JSON matching the requested schema. No markdown, no preamble, no explanation outside the JSON."""


def _parse_json_response(raw: str, fallback: dict) -> dict:
    """Strip markdown fences and parse JSON. Returns fallback on failure."""
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} | raw: {raw[:200]}")
        return fallback


async def _chat(prompt: str, temperature: float = 0.1, max_tokens: int = 1024) -> str:
    """Send a chat completion request to Google Gemini API directly."""
    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            headers={"Content-Type": "application/json"},
            json={
                "system_instruction": {
                    "parts": [{"text": SYSTEM_PROMPT}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}],
                    }
                ],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens,
                },
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


# ---------------------------------------------------------------------------
# Mode 1: Doctor → Patient (Simplify + Translate)
# ---------------------------------------------------------------------------

async def process_doctor_to_patient(english_text: str, patient_language: str) -> dict:
    lang_name = LANG_NAMES.get(patient_language, patient_language)

    prompt = f"""MODE: Doctor-to-Patient

The doctor said (in English):
"{english_text}"

The patient speaks {lang_name}.

Tasks:
1. Simplify the doctor's words to a 5th-grade reading level. Remove jargon but keep exact medical meaning.
2. Translate the simplified version into {lang_name} using warm, reassuring tone.
3. Suggest 1-2 follow-up questions the patient could ask for clarification.

Respond ONLY with valid JSON:
{{
  "original": "{english_text}",
  "simplified": "<simplified English, max 3 sentences>",
  "translated": "<translation in {lang_name}, max 3 sentences>",
  "follow_up_suggestions": ["<question patient could ask>", "<question patient could ask>"]
}}"""

    fallback = {
        "original": english_text,
        "simplified": english_text,
        "translated": f"(translation unavailable) {english_text}",
        "follow_up_suggestions": ["Can you explain that in simpler words?"],
    }

    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — returning fallback")
        return fallback

    try:
        raw = await _chat(prompt)
        return _parse_json_response(raw, fallback)
    except Exception as e:
        logger.error(f"Doctor→patient error: {e}")
        return fallback


# ---------------------------------------------------------------------------
# Mode 2: Patient → Doctor (Translate + Grammar Fix)
# ---------------------------------------------------------------------------

async def process_patient_to_doctor(patient_text: str, patient_language: str) -> dict:
    lang_name = LANG_NAMES.get(patient_language, patient_language)

    prompt = f"""MODE: Patient-to-Doctor

The patient spoke in {lang_name}. Their transcribed speech is:
"{patient_text}"

Tasks:
1. Translate the patient's words into English (this may produce imperfect English — that's expected).
2. Apply Grammar Recovery: restructure into clear, professional medical English for the doctor's records. Fix syntax, clarify intent.
3. Extract medical flags from the content.
4. If the input is too garbled to understand, set fixed_english to "[CLARIFICATION NEEDED]".

Respond ONLY with valid JSON:
{{
  "original": "<cleaned original in {lang_name}>",
  "raw_english": "<direct English translation, may be imperfect>",
  "fixed_english": "<professional, restructured English, max 3 sentences>",
  "medical_flags": {{
    "symptoms": ["<symptoms mentioned>"],
    "urgency": "<low|medium|high>",
    "suggested_questions": ["<1-2 follow-up questions for the doctor>"]
  }}
}}"""

    fallback = {
        "original": patient_text,
        "raw_english": f"(direct) {patient_text}",
        "fixed_english": f"(translation unavailable) {patient_text}",
        "medical_flags": {
            "symptoms": [],
            "urgency": "medium",
            "suggested_questions": ["Can you describe the pain?", "When did it start?"],
        },
    }

    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — returning fallback")
        return fallback

    try:
        raw = await _chat(prompt)
        return _parse_json_response(raw, fallback)
    except Exception as e:
        logger.error(f"Patient→doctor error: {e}")
        return fallback


# ---------------------------------------------------------------------------
# AI Doctor helper — follow-up response based on conversation history
# ---------------------------------------------------------------------------

async def generate_doctor_response(conversation_history: list) -> str:
    """
    Generate a short doctor-style follow-up question from recent context.
    Used when `toggle_ai_doctor` is enabled in WebSocket flow.
    """
    if not conversation_history:
        return "Can you tell me more about what you're feeling right now?"

    recent = conversation_history[-10:]
    context = "\n".join(
        [f"{msg.get('role', 'unknown').upper()}: {msg.get('text', '')}" for msg in recent]
    )

    prompt = f"""You are an AI doctor assistant in a live consultation.

Based on the recent conversation, provide ONE short, clinically relevant follow-up question.

Recent conversation:
{context}

Rules:
- Ask only one question.
- Keep it concise and clear.
- Do not diagnose.
- Return plain text only, no JSON.
"""

    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — returning fallback AI doctor question")
        return "Can you describe that symptom in a little more detail?"

    try:
        response = await _chat(prompt, temperature=0.2, max_tokens=120)
        cleaned = (response or "").strip()
        if not cleaned:
            return "Can you describe when these symptoms started?"
        return cleaned.splitlines()[0].strip()
    except Exception as e:
        logger.error(f"AI doctor response error: {e}")
        return "Can you tell me when this began?"


# ---------------------------------------------------------------------------
# Session summary — called when session ends
# ---------------------------------------------------------------------------

async def generate_session_summary(messages: list, patient_language: str) -> str:
    if not messages:
        return "No messages recorded in this session."

    lang_name = LANG_NAMES.get(patient_language, "the patient's language")

    lines = []
    for m in messages:
        if m["direction"] == "patient_to_provider":
            lines.append(f"PATIENT ({lang_name}): {m.get('original', '')}")
            lines.append(f"  → Doctor sees: {m.get('fixed_english', m.get('translated', ''))}")
        else:
            lines.append(f"DOCTOR: {m.get('original', '')}")
            lines.append(f"  → Patient hears ({lang_name}): {m.get('translated', '')}")

    transcript = "\n".join(lines)

    prompt = f"""You are a clinical documentation assistant.

Full transcript of a medical encounter (patient: {lang_name}, provider: English):

{transcript}

Generate a structured clinical summary:
1. Chief Complaint
2. Reported Symptoms (with duration and severity if mentioned)
3. Relevant History (medications, allergies, prior conditions if mentioned)
4. Key Questions Asked by Provider
5. Urgency Assessment (low/medium/high + reasoning)
6. Recommended Follow-up Actions

Be concise, clinically accurate. Do not invent information not in the transcript."""

    try:
        return await _chat(prompt, temperature=0.2, max_tokens=2048)
    except Exception as e:
        logger.error(f"Summary error: {e}")
        return "Summary generation failed — please review transcript manually."
