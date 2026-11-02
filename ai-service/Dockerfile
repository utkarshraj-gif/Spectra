FROM python:3.11-slim AS runner

WORKDIR /app

# Install FFmpeg and system dependencies for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Create shared recordings directory
RUN mkdir -p /app/recordings

COPY src/ ./src/

ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV RECORDINGS_PATH=/app/recordings
ENV WHISPER_MODEL=base
ENV WHISPER_DEVICE=cpu
ENV WHISPER_COMPUTE_TYPE=int8

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

