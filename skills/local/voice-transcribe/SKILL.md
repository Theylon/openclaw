---
name: voice-transcribe
description: Transcribe Telegram voice notes and other audio files (e.g., .ogg Opus) to text using a local CLI (ffmpeg + faster-whisper). Use when you need to turn an inbound voice message into a text transcript, or when setting up/maintaining OpenClaw audio transcription via tools.media.audio CLI models.
---

# Voice Transcribe (local)

## What this skill provides

- A deterministic local transcription script: `scripts/transcribe.py`
- A recommended OpenClaw config snippet to enable automatic transcription of inbound audio/voice notes via `tools.media.audio.models`.

## Quick use

Transcribe a file:

```bash
python3 scripts/transcribe.py /path/to/audio.ogg
```

Notes:
- Input can be Telegram `.ogg` (Opus) voice notes.
- The script converts audio to 16kHz mono WAV via `ffmpeg`, then runs `faster-whisper`.

## OpenClaw config (recommended)

Configure audio understanding to run the local CLI first:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [
          {
            type: "cli",
            command: "python3",
            args: ["/ABS/PATH/TO/skills/local/voice-transcribe/scripts/transcribe.py", "{{MediaPath}}"],
            timeoutSeconds: 60
          }
        ]
      }
    }
  }
}
```

## Dependencies

Required:
- `ffmpeg` on PATH
- Python package `faster-whisper`

If you change the transcription model/parameters, update `scripts/transcribe.py`.
