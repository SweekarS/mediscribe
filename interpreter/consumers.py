"""
consumers.py — Django Channels WebSocket consumer.

Architecture (matches team spec):

DOCTOR → PATIENT flow:
  Doctor speaks/types English
  → 11 Labs STT (if audio)
  → Gemini Mode 1: simplify jargon to 5th-grade level + translate to patient language
  → 11 Labs TTS: speak translated text to patient
  → Frontend shows text for patient to confirm

PATIENT → DOCTOR flow:
  Patient speaks in their language
  → 11 Labs STT (transcribe in source language)
  → Gemini Mode 2: translate to English + grammar recovery → professional English
  → Frontend shows cleaned English to doctor + medical flags

10-15 second buffer is handled by the frontend.
"""

import json
import logging
import asyncio
import time
from channels.generic.websocket import AsyncWebsocketConsumer

from .gemini_client import process_doctor_to_patient, process_patient_to_doctor
from .elevenlabs_client import synthesize_speech

logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB per audio chunk
WS_MSG_RATE_LIMIT = 30  # max messages per window
WS_MSG_RATE_WINDOW = 10  # seconds


def _multipart_audio_part(audio_bytes: bytes):
    """VAD sends WAV; browser may send webm elsewhere — label multipart correctly for STT."""
    if len(audio_bytes) >= 12 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        return ("audio.wav", audio_bytes, "audio/wav")
    return ("audio.webm", audio_bytes, "audio/webm")


class InterpreterConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self._pending_direction = None
        self._pending_language = None
        self._msg_timestamps = []

        # Load actual patient language from the session in DB
        from asgiref.sync import sync_to_async
        from .models import Session
        try:
            session = await sync_to_async(Session.objects.get)(id=self.session_id)
            self.patient_language = session.patient_language or "es"
        except Session.DoesNotExist:
            self.patient_language = "es"

        self.group_name = f"session_{self.session_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"WebSocket connected: session={self.session_id}, lang={self.patient_language}")

        await self.send(json.dumps({
            "type": "connection_established",
            "session_id": self.session_id,
            "message": "VoiceBridge connected. Ready to interpret.",
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f"WebSocket disconnected: session={self.session_id}, code={close_code}")

    def _is_rate_limited(self) -> bool:
        now = time.monotonic()
        self._msg_timestamps = [t for t in self._msg_timestamps if now - t < WS_MSG_RATE_WINDOW]
        if len(self._msg_timestamps) >= WS_MSG_RATE_LIMIT:
            return True
        self._msg_timestamps.append(now)
        return False

    async def receive(self, text_data=None, bytes_data=None):
        if self._is_rate_limited():
            await self._send_error("Rate limit exceeded — slow down.")
            return

        if bytes_data and len(bytes_data) > MAX_AUDIO_BYTES:
            await self._send_error("Audio chunk too large.")
            return

        if text_data:
            try:
                payload = json.loads(text_data)
            except json.JSONDecodeError:
                await self._send_error("Invalid JSON in text frame")
                return

            msg_type = payload.get("type")

            if msg_type == "audio_metadata":
                self._pending_direction = payload.get("direction", "patient_to_provider")
                self._pending_language = payload.get("patient_language", "es")
                self.patient_language = self._pending_language

            elif msg_type == "provider_text":
                await self._handle_doctor_message(payload.get("text", ""), payload.get("patient_language", self.patient_language))

            elif msg_type == "provider_audio_transcript":
                text = payload.get("text", "").strip()
                if text:
                    await self._handle_doctor_message(text, payload.get("patient_language", self.patient_language))

            elif msg_type == "ping":
                await self.send(json.dumps({"type": "pong"}))

            else:
                logger.warning(f"Unknown message type: {msg_type}")

        elif bytes_data:
            direction = self._pending_direction or "patient_to_provider"
            language = self._pending_language or self.patient_language

            if direction == "provider_to_patient":
                await self._handle_doctor_audio(bytes_data, language)
            else:
                await self._handle_patient_audio(bytes_data, language)

    # -----------------------------------------------------------------------
    # PATIENT → DOCTOR pipeline (Mode 2)
    # -----------------------------------------------------------------------

    async def _handle_patient_audio(self, audio_bytes: bytes, patient_language: str):
        """
        Patient spoke in their language.
        1. 11 Labs STT → transcription in patient's language
        2. Gemini Mode 2 → translate + grammar fix → professional English
        3. Broadcast to doctor
        """
        await self.send(json.dumps({"type": "processing", "step": "transcribing", "message": "Listening..."}))

        original_text = await self._transcribe_audio(audio_bytes, patient_language)
        if not original_text or len(original_text.strip()) < 2:
            await self._send_error("Could not understand the audio. Please speak again.")
            return

        await self.send(json.dumps({"type": "processing", "step": "gemini", "message": "Processing..."}))

        result = await process_patient_to_doctor(original_text, patient_language)

        await self._save_message(
            direction="patient_to_provider",
            original_text=result.get("original", original_text),
            translated_text=result.get("fixed_english", ""),
            medical_flags=result.get("medical_flags", {}),
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_patient_message",
                "original": result.get("original", original_text),
                "raw_english": result.get("raw_english", ""),
                "fixed_english": result.get("fixed_english", ""),
                "medical_flags": result.get("medical_flags", {}),
                "patient_language": patient_language,
            },
        )

    async def broadcast_patient_message(self, event):
        await self.send(json.dumps({
            "type": "patient_message",
            "original": event["original"],
            "raw_english": event["raw_english"],
            "fixed_english": event["fixed_english"],
            "medical_flags": event["medical_flags"],
            "patient_language": event["patient_language"],
        }))

    # -----------------------------------------------------------------------
    # DOCTOR → PATIENT pipeline (Mode 1)
    # -----------------------------------------------------------------------

    async def _handle_doctor_audio(self, audio_bytes: bytes, patient_language: str):
        """Doctor spoke into mic. STT first, then same as text path."""
        await self.send(json.dumps({"type": "processing", "step": "transcribing", "message": "Listening to doctor..."}))

        english_text = await self._transcribe_audio(audio_bytes, "en")
        if not english_text or len(english_text.strip()) < 2:
            await self._send_error("Could not transcribe audio. Try again or type your message.")
            return

        await self._handle_doctor_message(english_text, patient_language)

    async def _handle_doctor_message(self, english_text: str, patient_language: str):
        """
        Doctor said something in English (typed or transcribed).
        1. Gemini Mode 1 → simplify jargon + translate to patient language
        2. 11 Labs TTS → speak translated text
        3. Broadcast to patient
        """
        text = english_text.strip()
        if not text:
            return

        await self.send(json.dumps({"type": "processing", "step": "gemini", "message": "Simplifying & translating..."}))

        result = await process_doctor_to_patient(text, patient_language)
        translated = result.get("translated", "")
        simplified = result.get("simplified", text)

        await self.send(json.dumps({"type": "processing", "step": "tts", "message": "Generating speech..."}))

        audio_b64, _ = await asyncio.gather(
            synthesize_speech(translated, patient_language),
            self._save_message(
                direction="provider_to_patient",
                original_text=text,
                translated_text=translated,
                medical_flags={"simplified": simplified},
            ),
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_provider_message",
                "original": text,
                "simplified": simplified,
                "translated": translated,
                "audio_base64": audio_b64,
                "follow_up_suggestions": result.get("follow_up_suggestions", []),
                "patient_language": patient_language,
            },
        )

    async def broadcast_provider_message(self, event):
        await self.send(json.dumps({
            "type": "provider_message",
            "original": event["original"],
            "simplified": event["simplified"],
            "translated": event["translated"],
            "audio_base64": event["audio_base64"],
            "follow_up_suggestions": event["follow_up_suggestions"],
            "patient_language": event["patient_language"],
        }))

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    async def _transcribe_audio(self, audio_bytes: bytes, language: str) -> str:
        import httpx, os
        api_key = os.getenv("ELEVENLABS_API_KEY", "")
        if not api_key:
            logger.warning("ELEVENLABS_API_KEY not set — cannot transcribe")
            return ""

        try:
            lang_map = {
                "es": "es", "zh": "zh", "vi": "vi", "ne": "ne",
                "fr": "fr", "pt": "pt", "ar": "ar", "hi": "hi", "en": "en",
            }
            audio_part = _multipart_audio_part(audio_bytes)
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    "https://api.elevenlabs.io/v1/speech-to-text",
                    headers={"xi-api-key": api_key},
                    files={"file": audio_part},
                    data={
                        "model_id": "scribe_v1",
                        "language_code": lang_map.get(language, language),
                    },
                )
                response.raise_for_status()
                return response.json().get("text", "")
        except Exception as e:
            logger.error(f"ElevenLabs STT error: {e}")
            return ""

    async def _save_message(self, direction: str, original_text: str, translated_text: str, medical_flags: dict):
        from asgiref.sync import sync_to_async
        from .models import Session, Message

        @sync_to_async
        def _write():
            try:
                session = Session.objects.get(id=self.session_id)
                Message.objects.create(
                    session=session,
                    direction=direction,
                    original_text=original_text,
                    translated_text=translated_text,
                    medical_flags=medical_flags,
                    rag_validated=False,
                )
            except Session.DoesNotExist:
                logger.error(f"Session {self.session_id} not found")
            except Exception as e:
                logger.error(f"DB save error: {e}")

        await _write()

    async def _send_error(self, message: str):
        await self.send(json.dumps({"type": "error", "message": message}))
