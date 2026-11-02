import io
import wave
import struct
import math
import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.config import settings

client = TestClient(app)

def create_synthetic_wav(duration_seconds: float = 1.0, freq_hz: float = 440.0) -> bytes:
    """Generates an in-memory 16kHz Mono 16-bit PCM WAV file."""
    buf = io.BytesIO()
    sample_rate = 16000
    total_samples = int(sample_rate * duration_seconds)

    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for i in range(total_samples):
            val = int(32767 * 0.3 * math.sin(2 * math.pi * freq_hz * i / sample_rate))
            wf.writeframes(struct.pack("<h", val))

    return buf.getvalue()


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "spectra-ai-service"
    assert "device" in data
    assert "model" in data


def test_transcription_missing_fields():
    response = client.post("/v1/transcriptions")
    assert response.status_code == 400


def test_transcription_directory_traversal_blocked(tmp_path):
    settings.recordings_path = str(tmp_path / "recordings")
    payload = {
        "meeting_id": "test-uuid-1234",
        "audio_path": "/etc/passwd",
    }
    response = client.post("/v1/transcriptions", json=payload)
    assert response.status_code == 403


def test_transcription_nonexistent_file(tmp_path):
    rec_dir = tmp_path / "recordings"
    rec_dir.mkdir(parents=True, exist_ok=True)
    settings.recordings_path = str(rec_dir)

    payload = {
        "meeting_id": "test-uuid-1234",
        "audio_path": str(rec_dir / "does_not_exist.wav"),
    }
    response = client.post("/v1/transcriptions", json=payload)
    assert response.status_code == 404


def test_transcription_multipart_upload():
    wav_bytes = create_synthetic_wav(duration_seconds=1.0)
    files = {"file": ("test_call.wav", wav_bytes, "audio/wav")}
    data = {"meeting_id": "test-meeting-999"}

    response = client.post("/v1/transcriptions", data=data, files=files)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["meeting_id"] == "test-meeting-999"
    assert "duration_seconds" in res_json
    assert "segments" in res_json
    assert isinstance(res_json["segments"], list)

