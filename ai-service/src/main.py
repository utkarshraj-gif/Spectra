import os
import shutil
import tempfile
import logging
import asyncio
import collections
import json
import numpy as np
from contextlib import asynccontextmanager
from typing import Optional, Set

# Patch PyAV 14+ compatibility for faster-whisper
try:
    import av
    _orig_av_open = av.open
    def _safe_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _safe_av_open
except Exception:
    pass

from fastapi import (
    FastAPI,
    File,
    Form,
    UploadFile,
    HTTPException,
    status,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .schemas import HealthResponse, TranscriptionResponse, TranscriptionRequest
from .transcriber import WhisperTranscriber

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("spectra.ai-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Spectra AI Service on port %d...", settings.port)
    os.makedirs(settings.recordings_path, exist_ok=True)
    # Pre-warm Faster-Whisper model at startup for 0ms initial latency
    WhisperTranscriber.get_instance().load_model()
    yield

app = FastAPI(
    title="Spectra AI Transcription Service",
    description="Internal High-Performance Speech-to-Text Microservice using Faster-Whisper",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

transcriber = WhisperTranscriber.get_instance()


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint reporting service status, hardware device, and loaded model."""
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        device=transcriber.device,
        model=transcriber.model_name,
        compute_type=transcriber.compute_type,
    )


def _validate_safe_audio_path(audio_path: str) -> str:
    """Prevents directory traversal attacks by verifying that audio_path resides
    within the allowed recordings directory.
    """
    abs_audio = os.path.normcase(os.path.abspath(audio_path))
    abs_recordings = os.path.normcase(os.path.abspath(settings.recordings_path))
    proj_recordings = os.path.normcase(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "recordings")))

    # Check path containment
    if not (abs_audio.startswith(abs_recordings) or abs_audio.startswith(proj_recordings)):
        logger.warning("Directory traversal attempt blocked: %s", audio_path)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access outside designated recordings storage directory is prohibited",
        )

    if not os.path.exists(abs_audio):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file does not exist: {os.path.basename(abs_audio)}",
        )

    return abs_audio


@app.post("/v1/transcriptions", response_model=TranscriptionResponse)
async def create_transcription(
    request: Request,
    meeting_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Transcribes meeting audio into timestamped segments with speaker attribution.
    Supports both multipart/form-data upload AND internal JSON path references.
    """
    content_type = request.headers.get("content-type", "")

    # 1. Handle JSON request body: { "meeting_id": "...", "audio_path": "..." }
    if "application/json" in content_type:
        try:
            body = await request.json()
            req_data = TranscriptionRequest(**body)
        except Exception as err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid JSON request body: {err}",
            )

        if not req_data.audio_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="audio_path is required when submitting application/json",
            )

        safe_path = _validate_safe_audio_path(req_data.audio_path)
        try:
            result = transcriber.transcribe_file(safe_path, req_data.meeting_id)
            return result
        except Exception as exc:
            logger.error("Transcription failed for meeting %s: %s", req_data.meeting_id, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Transcription processing error: {exc}",
            )

    # 2. Handle Multipart file upload
    if not meeting_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="meeting_id form parameter is required",
        )

    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio file upload is required",
        )

    # Write uploaded stream to temporary file for safe processing
    temp_dir = tempfile.mkdtemp(prefix="spectra_audio_")
    temp_file_path = os.path.join(temp_dir, file.filename or "upload.wav")

    try:
        with open(temp_file_path, "wb") as out_file:
            shutil.copyfileobj(file.file, out_file)

        # Check non-empty
        if os.path.getsize(temp_file_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty (0 bytes)",
            )

        result = transcriber.transcribe_file(temp_file_path, meeting_id)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Transcription error on uploaded file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription processing error: {exc}",
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def pcm_frame_rms(pcm_bytes: bytes) -> float:
    """Calculates RMS audio energy from raw 16-bit mono PCM."""
    if not pcm_bytes:
        return 0.0
    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    return float(np.sqrt(np.mean(samples ** 2)))


@app.websocket("/ws/transcribe/{meeting_id}")
async def websocket_transcribe(websocket: WebSocket, meeting_id: str):
    """Real-time bi-directional streaming endpoint with VAD Utterance Segmentation.
    Accepts 16kHz 16-bit mono PCM binary frames from worker.
    Segments speech using energy-based Voice Activity Detection and natural pause endpointing (1.2s),
    auto-flushes on speaker changes, and returns conversational timestamped segments in real time.
    """
    await websocket.accept()
    logger.info("WebSocket connected for real-time transcription of meeting %s", meeting_id)

    chunk_sample_rate = 16000
    bytes_per_sample = 2
    bytes_per_ms = 32  # 16000 * 2 / 1000 = 32 bytes per millisecond
    FRAME_BYTES = 3200  # 100ms per audio evaluation frame
    SILENCE_RMS_THRESHOLD = 0.0018  # speech vs background noise energy threshold
    PAUSE_FRAMES_ENDPOINT = 7  # 700ms silence pause endpoints natural speech for real-time responsiveness
    MIN_SPEECH_FRAMES = 4  # 400ms min active speech to eliminate clicks and taps
    MAX_UTTERANCE_BYTES = chunk_sample_rate * bytes_per_sample * 15  # 15s max utterance chunk

    raw_queue = bytearray()
    preroll_frames = collections.deque(maxlen=3)  # 300ms pre-roll to preserve leading consonants
    utterance_buffer = bytearray()
    speech_started = False
    consecutive_silence_frames = 0
    active_speech_frames = 0
    utterance_start_ms = 0
    total_stream_bytes = 0
    session_start_time = asyncio.get_event_loop().time()

    active_speaker = "Speaker 1"
    known_speakers: Set[str] = set()
    initial_prompt: Optional[str] = None

    async def flush_active_utterance():
        nonlocal speech_started, consecutive_silence_frames, active_speech_frames, utterance_start_ms
        if len(utterance_buffer) == 0:
            return
        pcm_to_process = bytes(utterance_buffer)
        utterance_buffer.clear()
        speech_started = False
        consecutive_silence_frames = 0
        speech_frames_snapshot = active_speech_frames
        active_speech_frames = 0

        # Discard if active speech duration is less than min threshold (e.g. mic click or tap)
        if speech_frames_snapshot < MIN_SPEECH_FRAMES:
            return

        start_ms = utterance_start_ms
        duration_ms = int(len(pcm_to_process) / bytes_per_ms)
        end_ms = start_ms + duration_ms

        try:
            # Run faster-whisper in background thread pool to prevent blocking asyncio loop
            segments = await asyncio.to_thread(
                transcriber.transcribe_pcm_stream,
                pcm_to_process,
                meeting_id,
                chunk_sample_rate,
                speaker=active_speaker,
                initial_prompt=initial_prompt,
            )
            for seg in segments:
                text = seg.text.strip()
                if not text:
                    continue
                seg_start = start_ms + seg.start_time_ms
                seg_end = min(end_ms, start_ms + seg.end_time_ms)
                if seg_end <= seg_start:
                    seg_end = seg_start + 1000
                event = {
                    "event": "TRANSCRIPT_SEGMENT",
                    "meeting_id": meeting_id,
                    "speaker": seg.speaker or active_speaker,
                    "text": text,
                    "start_time_ms": seg_start,
                    "end_time_ms": seg_end,
                    "is_final": True,
                }
                await websocket.send_json(event)
        except Exception as err:
            logger.error("Error transcribing utterance for meeting %s: %s", meeting_id, err)

    try:
        while True:
            try:
                # Wait for next websocket message (max 0.2s so natural silence pause triggers promptly)
                message = await asyncio.wait_for(websocket.receive(), timeout=0.2)
            except asyncio.TimeoutError:
                # If currently in speech, advance silence frame count (0.2s timeout = two 100ms silence frames)
                if speech_started:
                    consecutive_silence_frames += 2
                    if consecutive_silence_frames >= PAUSE_FRAMES_ENDPOINT:
                        await flush_active_utterance()
                continue

            if "bytes" in message and message["bytes"]:
                raw_queue.extend(message["bytes"])

                while len(raw_queue) >= FRAME_BYTES:
                    frame = bytes(raw_queue[:FRAME_BYTES])
                    del raw_queue[:FRAME_BYTES]

                    # Calculate wall-clock timestamp relative to meeting session start
                    wall_ms = int((asyncio.get_event_loop().time() - session_start_time) * 1000)
                    stream_ms = int(total_stream_bytes / bytes_per_ms)
                    frame_time_ms = max(wall_ms, stream_ms)
                    total_stream_bytes += FRAME_BYTES
                    rms = pcm_frame_rms(frame)

                    if rms >= SILENCE_RMS_THRESHOLD:
                        if not speech_started:
                            speech_started = True
                            active_speech_frames = 0
                            consecutive_silence_frames = 0
                            preroll_bytes = b"".join(preroll_frames)
                            utterance_buffer.extend(preroll_bytes)
                            utterance_start_ms = max(0, frame_time_ms - int(len(preroll_bytes) / bytes_per_ms))
                            preroll_frames.clear()

                        utterance_buffer.extend(frame)
                        active_speech_frames += 1
                        consecutive_silence_frames = 0

                        if len(utterance_buffer) >= MAX_UTTERANCE_BYTES:
                            await flush_active_utterance()
                    else:
                        if speech_started:
                            utterance_buffer.extend(frame)
                            consecutive_silence_frames += 1
                            if consecutive_silence_frames >= PAUSE_FRAMES_ENDPOINT:
                                await flush_active_utterance()
                        else:
                            preroll_frames.append(frame)

            elif "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                    msg_type = payload.get("type")
                    if msg_type == "SPEAKER_ACTIVE":
                        candidate = payload.get("speaker")
                        if candidate and isinstance(candidate, str):
                            candidate = candidate.strip()
                            if candidate and candidate != active_speaker:
                                if speech_started and active_speech_frames >= MIN_SPEECH_FRAMES:
                                    await flush_active_utterance()
                                active_speaker = candidate
                                known_speakers.add(active_speaker)
                                initial_prompt = f"Speakers: {', '.join(sorted(known_speakers))}. Spectra meeting transcription."
                                logger.info("Meeting %s active speaker changed to '%s'", meeting_id, active_speaker)
                    elif msg_type == "PING":
                        await websocket.send_json({"event": "PONG", "timestamp": payload.get("timestamp")})
                    elif msg_type == "FLUSH":
                        if speech_started and active_speech_frames >= MIN_SPEECH_FRAMES:
                            await flush_active_utterance()
                except Exception as e:
                    logger.warning("Error parsing websocket JSON message: %s", e)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for meeting %s", meeting_id)
        if speech_started and active_speech_frames >= MIN_SPEECH_FRAMES:
            try:
                await flush_active_utterance()
            except Exception:
                pass
    except Exception as exc:
        if "disconnect message has been received" not in str(exc):
            logger.error("WebSocket error for meeting %s: %s", meeting_id, exc)
