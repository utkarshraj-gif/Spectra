#!/bin/bash
set -e

# 1. Initialize virtual framebuffer for headless Chromium Web Audio execution
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp -ac &
XVFB_PID=$!

# Wait for Xvfb socket
for i in $(seq 1 15); do
  if [ -e /tmp/.X11-unix/X99 ]; then
    break
  fi
  sleep 0.1
done

# 2. Initialize PulseAudio with dummy null audio sink for headless recording
mkdir -p /root/.config/pulse
pulseaudio --start --exit-idle-time=-1 || true
pactl load-module module-null-sink sink_name=DummyOutput sink_properties=device.description="Dummy_Audio_Output" || true

# 3. Clean exit trap
cleanup() {
  echo "[WorkerContainer] Container shutting down. Terminating Xvfb ($XVFB_PID)..."
  kill -TERM "$XVFB_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

echo "[WorkerContainer] Headless virtual display :99 and dummy audio sink initialized."

# 4. Start meeting worker daemon
exec node dist/index.js

