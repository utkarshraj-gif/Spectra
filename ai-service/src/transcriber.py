import os
import io
import re
import wave
import json
import logging
import urllib.request
from typing import Optional, List
from .config import settings
from .schemas import TranscriptionResponse, SegmentResponse

logger = logging.getLogger("spectra.transcriber")

# Common Whisper phantom hallucination phrases triggered by low noise/silence
SILENCE_HALLUCINATIONS = {
    "thank you", "thank you sir", "thank you very much", "thanks", "thanks for watching",
    "bye", "goodbye", "you", "so", "subscribe", "subtitles by", "translated by",
    "close shot in", "mute mute mute", "mute, mute, mute, hello, are you", "hey what up john",
    "hey, what up, john", "pinker than",
}

def remove_repetitive_loops(text: str) -> str:
    """Collapses runaway word or phrase repetitions like 'pinker than pinker than...'"""
    if not text:
        return ""
    # Look for repeating phrase patterns (1 to 4 words repeated 3+ times)
    pattern = r'\b([a-zA-Z0-9_\'-]+(?:\s+[a-zA-Z0-9_\'-]+){0,3})(?:\s+\1){2,}\b'
    cleaned = re.sub(pattern, r'\1', text, flags=re.IGNORECASE)
    # Strip degenerate long repeating sequences (3+ repeats of single word)
    single_word_rep = r'\b(\w+)(?:\s+\1){2,}\b'
    cleaned = re.sub(single_word_rep, r'\1', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()

class WhisperTranscriber:
    _instance: Optional["WhisperTranscriber"] = None

    def __init__(self):
        self.model = None
        self.model_name = settings.whisper_model
        self.device = settings.whisper_device
        self.compute_type = settings.whisper_compute_type

    @classmethod
    def get_instance(cls) -> "WhisperTranscriber":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_model(self):
        if self.model is not None:
            return self.model

        try:
            from faster_whisper import WhisperModel
        except ImportError:
            logger.warning("faster-whisper not installed; running in fallback test mode")
            return None

        # Allocate all available CPU cores for maximum CTranslate2 INT8 throughput
        threads = max(1, os.cpu_count() or 8)

        logger.info(
            "Loading Faster-Whisper model '%s' (device: %s, compute: %s, threads: %d)...",
            self.model_name,
            self.device,
            self.compute_type,
            threads,
        )

        try:
            self.model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type,
                cpu_threads=threads,
            )
            logger.info("Faster-Whisper model '%s' successfully loaded.", self.model_name)
        except Exception as exc:
            logger.warning(
                "Failed to initialize model '%s' on device '%s' (%s). Falling back to 'base' on CPU int8.",
                self.model_name,
                self.device,
                exc,
            )
            self.model_name = "base"
            self.device = "cpu"
            self.compute_type = "int8"
            try:
                self.model = WhisperModel(
                    "base",
                    device="cpu",
                    compute_type="int8",
                    cpu_threads=threads,
                )
                logger.info("Faster-Whisper model loaded on CPU 'base' fallback.")
            except Exception as fallback_exc:
                logger.error("Failed to load fallback model: %s", fallback_exc)
                return None

        return self.model

    def transcribe_file(self, audio_path: str, meeting_id: str) -> TranscriptionResponse:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        model = self.load_model()
        if model is None:
            return TranscriptionResponse(
                meeting_id=meeting_id,
                duration_seconds=1.0,
                language="en",
                total_segments=1,
                segments=[
                    SegmentResponse(
                        id=0,
                        start_time_ms=0,
                        end_time_ms=1000,
                        speaker="Speaker 1",
                        text="[Mock transcription: faster-whisper not initialized]",
                    )
                ],
            )

        segments_gen, info = model.transcribe(
            audio_path,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400),
        )

        segments: List[SegmentResponse] = []
        max_end_time = 0.0

        for idx, s in enumerate(segments_gen):
            raw_text = s.text.strip()
            text = remove_repetitive_loops(raw_text)
            if not text:
                continue
            start_ms = int(s.start * 1000)
            end_ms = int(s.end * 1000)
            if s.end > max_end_time:
                max_end_time = s.end

            segments.append(
                SegmentResponse(
                    id=idx,
                    start_time_ms=start_ms,
                    end_time_ms=end_ms,
                    speaker=f"Speaker {getattr(s, 'speaker_id', 1)}",
                    text=text,
                )
            )

        duration = getattr(info, "duration", max_end_time) or max_end_time

        return TranscriptionResponse(
            meeting_id=meeting_id,
            duration_seconds=round(duration, 2),
            language=getattr(info, "language", "en"),
            total_segments=len(segments),
            segments=segments,
        )

    def transcribe_pcm_stream(
        self,
        pcm_bytes: bytes,
        meeting_id: str,
        sample_rate: int = 16000,
        speaker: str = "Speaker 1",
        initial_prompt: Optional[str] = None,
    ) -> List[SegmentResponse]:
        """Transcribes raw 16kHz mono Linear PCM bytes into timestamped segments in real-time."""
        if not pcm_bytes or len(pcm_bytes) < 3200:
            return []

        # 1. Check Root Mean Square (RMS) energy silence gate
        try:
            import numpy as np
            audio_data = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            rms = float(np.sqrt(np.mean(audio_data ** 2)))
            if rms < 0.0012:
                # Ambient silence or background line noise - skip transcription to prevent hallucination
                return []
        except Exception:
            rms = 0.01

        # 2. Cloud STT Fast-Path: Groq API if configured (from Bolo architecture)
        if settings.groq_api_key:
            try:
                wav_io = io.BytesIO()
                with wave.open(wav_io, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(sample_rate)
                    wf.writeframes(pcm_bytes)
                wav_bytes = wav_io.getvalue()

                boundary = "----SpectraBoundarySTT"
                body = bytearray()
                body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{settings.groq_model}\r\n".encode())
                body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nen\r\n".encode())
                body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"temperature\"\r\n\r\n0.0\r\n".encode())
                if initial_prompt:
                    body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"prompt\"\r\n\r\n{initial_prompt}\r\n".encode())
                body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"stream.wav\"\r\nContent-Type: audio/wav\r\n\r\n".encode())
                body.extend(wav_bytes)
                body.extend(f"\r\n--{boundary}--\r\n".encode())

                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    data=bytes(body),
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": f"multipart/form-data; boundary={boundary}",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    resp_data = json.loads(resp.read().decode())
                    text = resp_data.get("text", "").strip()
                    text = remove_repetitive_loops(text)
                    if text:
                        cleaned = text.lower().strip(" .,!?;:")
                        if cleaned not in SILENCE_HALLUCINATIONS:
                            dur_ms = int(len(pcm_bytes) / (sample_rate * 2) * 1000)
                            return [
                                SegmentResponse(
                                    id=0,
                                    start_time_ms=0,
                                    end_time_ms=dur_ms,
                                    speaker=speaker,
                                    text=text,
                                )
                            ]
            except Exception as e:
                logger.debug("Groq STT failed, falling back to local Faster-Whisper: %s", e)

        # 3. Local Faster-Whisper STT (CTranslate2 INT8)
        model = self.load_model()
        if model is None:
            return [
                SegmentResponse(
                    id=0,
                    start_time_ms=0,
                    end_time_ms=int(len(pcm_bytes) / (sample_rate * 2) * 1000),
                    speaker=speaker,
                    text="[Streaming transcription mock: audio chunk processed]",
                )
            ]

        try:
            # beam_size=1 (greedy decoding) provides 2.5x-3x speedup with INT8, matching Bolo's real-time latency
            # repetition_penalty, no_repeat_ngram_size, and compression_ratio_threshold prevent looping hallucinations
            segments_gen, _ = model.transcribe(
                audio_data,
                beam_size=1,
                temperature=0.0,
                condition_on_previous_text=False,
                initial_prompt=initial_prompt,
                repetition_penalty=1.15,
                no_repeat_ngram_size=3,
                compression_ratio_threshold=2.2,
                hallucination_silence_threshold=2.0,
                no_speech_threshold=0.6,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=300),
                language="en",
            )

            segments: List[SegmentResponse] = []
            for idx, s in enumerate(segments_gen):
                raw_text = s.text.strip()
                if not raw_text:
                    continue

                no_speech_prob = getattr(s, "no_speech_prob", 0.0)
                if no_speech_prob > 0.65:
                    continue

                avg_logprob = getattr(s, "avg_logprob", 0.0)
                if avg_logprob < -1.8:
                    continue

                text = remove_repetitive_loops(raw_text)
                if not text:
                    continue

                cleaned = text.lower().strip(" .,!?;:")
                if cleaned in SILENCE_HALLUCINATIONS and (no_speech_prob > 0.25 or rms < 0.012):
                    continue

                segments.append(
                    SegmentResponse(
                        id=idx,
                        start_time_ms=int(s.start * 1000),
                        end_time_ms=int(s.end * 1000),
                        speaker=speaker,
                        text=text,
                    )
                )
            return segments
        except Exception as exc:
            logger.error("Error transcribing PCM stream for %s: %s", meeting_id, exc)
            return []
