import os
from pydantic import ConfigDict
from pydantic_settings import BaseSettings

default_recordings = os.getenv(
    "RECORDINGS_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "recordings")),
)

class Settings(BaseSettings):
    model_config = ConfigDict(extra="ignore", env_file=".env")

    service_name: str = "spectra-ai-service"
    port: int = 8000
    whisper_model: str = os.getenv("WHISPER_MODEL", "base.en")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "whisper-large-v3-turbo")
    recordings_path: str = default_recordings
    max_upload_size_mb: int = 500

settings = Settings()
