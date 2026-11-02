from typing import List, Optional
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "spectra-ai-service"
    device: str
    model: str
    compute_type: str

class SegmentResponse(BaseModel):
    id: int
    start_time_ms: int
    end_time_ms: int
    speaker: Optional[str] = "Speaker"
    text: str

class TranscriptionRequest(BaseModel):
    meeting_id: str = Field(..., description="Unique meeting UUID")
    audio_path: Optional[str] = Field(None, description="Path to audio file inside shared volume")

class TranscriptionResponse(BaseModel):
    meeting_id: str
    duration_seconds: float
    language: str
    total_segments: int
    segments: List[SegmentResponse]

