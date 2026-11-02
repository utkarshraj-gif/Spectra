import os
import logging
from typing import Optional, List
from .config import settings
from .schemas import TranscriptionResponse, SegmentResponse

logger = logging.getLogger("spectra.transcriber")

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

        logger.info(
            "Loading Faster-Whisper model '%s' (device: %s, compute: %s)...",
            self.model_name,
            self.device,
            self.compute_type,
        )

        try:
            self.model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type,
            )
            logger.info("Faster-Whisper model '%s' successfully loaded.", self.model_name)
        except Exception as exc:
            logger.warning(
                "Failed to initialize model on device '%s' (%s). Falling back to CPU int8.",
                self.device,
                exc,
            )
            self.device = "cpu"
            self.compute_type = "int8"
            self.model = WhisperModel(
                self.model_name,
                device="cpu",
                compute_type="int8",
            )
            logger.info("Faster-Whisper model loaded on CPU fallback.")

        return self.model

    def transcribe_file(self, audio_path: str, meeting_id: str) -> TranscriptionResponse:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        model = self.load_model()
        if model is None:
            # Synthetic response for mock environments without faster-whisper compiled
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

        # Run transcription with Voice Activity Detection (VAD) filter
        segments_gen, info = model.transcribe(
            audio_path,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400),
        )

        segments: List[SegmentResponse] = []
        max_end_time = 0.0

        for idx, s in enumerate(segments_gen):
            text = s.text.strip()
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

    def transcribe_pcm_stream(self, pcm_bytes: bytes, meeting_id: str, sample_rate: int = 16000) -> List[SegmentResponse]:
        """Transcribes raw 16kHz mono Linear PCM bytes into timestamped segments in real-time."""
        if not pcm_bytes or len(pcm_bytes) < 3200:
            return []

        model = self.load_model()
        if model is None:
            return [
                SegmentResponse(
                    id=0,
                    start_time_ms=0,
                    end_time_ms=int(len(pcm_bytes) / (sample_rate * 2) * 1000),
                    speaker="Speaker 1",
                    text="[Streaming transcription mock: audio chunk processed]",
                )
            ]

        try:
            import numpy as np
            audio_data = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            segments_gen, _ = model.transcribe(
                audio_data,
                beam_size=3,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=300),
                language="en",
            )
            segments: List[SegmentResponse] = []
            for idx, s in enumerate(segments_gen):
                text = s.text.strip()
                if not text:
                    continue
                segments.append(
                    SegmentResponse(
                        id=idx,
                        start_time_ms=int(s.start * 1000),
                        end_time_ms=int(s.end * 1000),
                        speaker="Speaker 1",
                        text=text,
                    )
                )
            return segments
        except Exception as exc:
            logger.error("Error transcribing PCM stream for %s: %s", meeting_id, exc)
            return []
