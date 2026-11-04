# Production Headless Meeting Worker Container (Task G-4)
# Ubuntu Jammy base with Playwright Chromium, Xvfb virtual display, and PulseAudio null sink
FROM mcr.microsoft.com/playwright:v1.45.0-jammy AS base

# Install Xvfb virtual display, PulseAudio dummy audio sink, and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    pulseaudio \
    pulseaudio-utils \
    alsa-utils \
    libasound2 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests and install dependencies
COPY package.json ./
RUN npm install

# Copy source code and build config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Copy container startup script
COPY entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh

# Expose internal worker daemon port
EXPOSE 5001

# Environment defaults
ENV PORT=5001
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV MAX_CONCURRENT_SESSIONS=5
ENV LONE_BOT_TIMEOUT_MS=90000
ENV MAX_SESSION_DURATION_MS=10800000

# Start via entrypoint script managing Xvfb and PulseAudio
ENTRYPOINT ["/app/entrypoint.sh"]
