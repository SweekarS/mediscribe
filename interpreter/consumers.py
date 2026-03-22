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
from channels.generic.websocket import AsyncWebsocketConsumer

from .gemini_client import process_doctor_to_patient, process_patient_to_doctor, generate_doctor_response
from .elevenlabs_client import synthesize_speech

logger = logging.getLogger(__name__)


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
        self.ai_doctor_enabled = False
        self._conversation_history = []

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

    async def receive(self, text_data=None, bytes_data=None):
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

            elif msg_type == "toggle_ai_doctor":
                self.ai_doctor_enabled = payload.get("enabled", False)
                logger.info(f"AI Doctor {'enabled' if self.ai_doctor_enabled else 'disabled'} for session {self.session_id}")
                await self.send(json.dumps({
                    "type": "ai_doctor_status",
                    "enabled": self.ai_doctor_enabled,
                }))

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
        logger.info(f"Patient audio received: {len(audio_bytes)} bytes, lang={patient_language}")
        await self.send(json.dumps({"type": "processing", "step": "transcribing", "message": "Listening..."}))

        try:
            original_text = await self._transcribe_audio(audio_bytes, patient_language)
        except Exception as e:
            logger.error(f"STT crashed: {e}", exc_info=True)
            await self._send_error(f"Transcription failed: {e}")
            return

        if not original_text or len(original_text.strip()) < 2:
            logger.warning(f"STT returned empty/short: '{original_text}'")
            await self._send_error("Could not understand the audio. Please speak again.")
            return

        logger.info(f"STT result: '{original_text}'")
        await self.send(json.dumps({"type": "processing", "step": "gemini", "message": "Processing..."}))

        try:
            result = await process_patient_to_doctor(original_text, patient_language)
            logger.info(f"Gemini result: fixed_english='{result.get('fixed_english', '')[:80]}'")
        except Exception as e:
            logger.error(f"Gemini patient→doctor crashed: {e}", exc_info=True)
            await self._send_error(f"Translation failed: {e}")
            return

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

        # Track conversation for AI Doctor context
        self._conversation_history.append({
            "role": "patient",
            "text": result.get("fixed_english", original_text),
        })

        # AI Doctor auto-response
        if self.ai_doctor_enabled:
            logger.info("AI Doctor enabled — generating response...")
            try:
                await self.send(json.dumps({"type": "processing", "step": "gemini", "message": "AI Doctor is thinking..."}))
                doctor_response = await generate_doctor_response(self._conversation_history)
                logger.info(f"AI Doctor response: '{doctor_response[:80]}'")
                if doctor_response:
                    await self._handle_doctor_message(doctor_response, patient_language)
                    logger.info("AI Doctor response sent through pipeline successfully")
            except Exception as e:
                logger.error(f"AI Doctor auto-response error: {e}", exc_info=True)
                await self._send_error(f"AI Doctor failed: {e}")
        else:
            logger.info(f"AI Doctor disabled (ai_doctor_enabled={self.ai_doctor_enabled})")

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

        logger.info(f"Doctor message pipeline: '{text[:60]}' → {patient_language}")
        await self.send(json.dumps({"type": "processing", "step": "gemini", "message": "Simplifying & translating..."}))

        try:
            result = await process_doctor_to_patient(text, patient_language)
        except Exception as e:
            logger.error(f"Gemini doctor→patient crashed: {e}", exc_info=True)
            await self._send_error(f"Translation failed: {e}")
            return

        translated = result.get("translated", "")
        simplified = result.get("simplified", text)
        logger.info(f"Gemini done: translated='{translated[:60]}'")

        await self.send(json.dumps({"type": "processing", "step": "tts", "message": "Generating speech..."}))

        try:
            audio_b64, _ = await asyncio.gather(
                synthesize_speech(translated, patient_language),
                self._save_message(
                    direction="provider_to_patient",
                    original_text=text,
                    translated_text=translated,
                    medical_flags={"simplified": simplified},
                ),
            )
            logger.info(f"TTS done: audio length={len(audio_b64)} chars")
        except Exception as e:
            logger.error(f"TTS/save crashed: {e}", exc_info=True)
            await self._send_error(f"Speech generation failed: {e}")
            return

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

        # Track for AI Doctor conversation context
        self._conversation_history.append({"role": "doctor", "text": text})

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
