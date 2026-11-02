import os
import shutil
import tempfile
import logging
from contextlib import asynccontextmanager
from typing import Optional

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
    abs_audio = os.path.abspath(audio_path)
    abs_recordings = os.path.abspath(settings.recordings_path)

    # Check path containment
    if not abs_audio.startswith(abs_recordings):
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


@app.websocket("/ws/transcribe/{meeting_id}")
async def websocket_transcribe(websocket: WebSocket, meeting_id: str):
    """Real-time bi-directional streaming endpoint.
    Accepts 16kHz 16-bit mono PCM binary frames from worker.
    Accumulates audio into an utterance buffer, transcribes upon speech boundaries,
    and returns timestamped segments in real-time.
    """
    await websocket.accept()
    logger.info("WebSocket connected for real-time transcription of meeting %s", meeting_id)

    buffer = bytearray()
    chunk_sample_rate = 16000
    bytes_per_sample = 2
    # 2.5 second window for streaming transcription chunks
    window_bytes = int(chunk_sample_rate * bytes_per_sample * 2.5)
    last_emitted_ms = 0
    active_speaker = "Speaker 1"

    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message and message["bytes"]:
                chunk = message["bytes"]
                buffer.extend(chunk)

                if len(buffer) >= window_bytes:
                    pcm_to_process = bytes(buffer)
                    buffer.clear()

                    segments = transcriber.transcribe_pcm_stream(pcm_to_process, meeting_id, chunk_sample_rate)
                    for seg in segments:
                        start_ms = last_emitted_ms + seg.start_time_ms
                        end_ms = last_emitted_ms + seg.end_time_ms
                        event = {
                            "event": "TRANSCRIPT_SEGMENT",
                            "meeting_id": meeting_id,
                            "speaker": active_speaker,
                            "text": seg.text,
                            "start_time_ms": start_ms,
                            "end_time_ms": end_ms,
                            "is_final": True,
                        }
                        await websocket.send_json(event)
                    last_emitted_ms += int(len(pcm_to_process) / (chunk_sample_rate * bytes_per_sample) * 1000)

            elif "text" in message and message["text"]:
                import json
                try:
                    payload = json.loads(message["text"])
                    msg_type = payload.get("type")
                    if msg_type == "SPEAKER_ACTIVE":
                        active_speaker = payload.get("speaker") or active_speaker
                    elif msg_type == "FLUSH" and len(buffer) > 3200:
                        pcm_to_process = bytes(buffer)
                        buffer.clear()
                        segments = transcriber.transcribe_pcm_stream(pcm_to_process, meeting_id, chunk_sample_rate)
                        for seg in segments:
                            start_ms = last_emitted_ms + seg.start_time_ms
                            end_ms = last_emitted_ms + seg.end_time_ms
                            event = {
                                "event": "TRANSCRIPT_SEGMENT",
                                "meeting_id": meeting_id,
                                "speaker": active_speaker,
                                "text": seg.text,
                                "start_time_ms": start_ms,
                                "end_time_ms": end_ms,
                                "is_final": True,
                            }
                            await websocket.send_json(event)
                except Exception as e:
                    logger.warning("Error parsing websocket JSON message: %s", e)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for meeting %s", meeting_id)
    except Exception as exc:
        logger.error("WebSocket error for meeting %s: %s", meeting_id, exc)
