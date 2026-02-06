#!/usr/bin/env bash
set -euo pipefail

# Transcribe audio using whisper.cpp (whisper-cli) with an ffmpeg decode step.
# Usage: transcribe_whispercpp.sh /path/to/audio.ogg

IN="${1:-}"
if [ -z "$IN" ] || [ "$IN" = "-h" ] || [ "$IN" = "--help" ]; then
  echo "Usage: $0 /path/to/audio.{ogg,mp3,wav,...}" >&2
  exit 2
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Missing dependency: ffmpeg" >&2
  exit 3
fi

WHISPER_CLI="/usr/local/bin/whisper-cli"
if [ ! -x "$WHISPER_CLI" ]; then
  echo "Missing dependency: whisper-cli ($WHISPER_CLI)" >&2
  exit 3
fi

MODEL="/Users/eylonaviv/.openclaw/workspaces/demrezel/models/whisper-cpp/ggml-tiny.bin"
if [ ! -f "$MODEL" ]; then
  echo "Missing model: $MODEL" >&2
  exit 3
fi

TMP_WAV="$(mktemp -t openclaw-whisper.XXXXXX).wav"
cleanup() { rm -f "$TMP_WAV"; }
trap cleanup EXIT

# Convert to 16kHz mono WAV
ffmpeg -y -nostdin -hide_banner -loglevel error -i "$IN" -vn -ac 1 -ar 16000 "$TMP_WAV"

# whisper-cli expects a file path; print transcript to stdout.
"$WHISPER_CLI" -m "$MODEL" -f "$TMP_WAV" -nt -l auto
