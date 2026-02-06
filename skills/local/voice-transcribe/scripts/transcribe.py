#!/usr/bin/env python3
"""Transcribe an audio file to text using faster-whisper.

- Accepts Telegram voice notes (.ogg Opus) and most audio formats ffmpeg can decode.
- Converts to 16kHz mono WAV before transcription.

Usage:
  python3 transcribe.py /path/to/audio.ogg

Exit codes:
  0 on success
  2 on usage error
  3 on missing dependency
  4 on transcription failure
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile


def _die(code: int, msg: str) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(code)


def _check_deps() -> None:
    if shutil.which("ffmpeg") is None:
        _die(3, "Missing dependency: ffmpeg (not found on PATH)")

    try:
        import faster_whisper  # noqa: F401
    except Exception:
        _die(3, "Missing dependency: faster-whisper (pip install faster-whisper)")


def _ffmpeg_to_wav(in_path: str, out_wav: str) -> None:
    # -vn: no video
    # -ac 1: mono
    # -ar 16000: 16kHz
    cmd = [
        "ffmpeg",
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        in_path,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        out_wav,
    ]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        _die(4, f"ffmpeg failed: {p.stderr.strip()}")


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] in ("-h", "--help"):
        sys.stderr.write(__doc__ + "\n")
        return 2

    in_path = argv[1]
    if not os.path.exists(in_path):
        _die(2, f"Input file not found: {in_path}")

    _check_deps()

    # Lazy import after dependency check for clearer errors.
    from faster_whisper import WhisperModel

    model_name = os.environ.get("FASTER_WHISPER_MODEL", "small")
    compute_type = os.environ.get("FASTER_WHISPER_COMPUTE_TYPE", "int8")

    # Prefer CPU by default (works everywhere). If you have GPU, set FASTER_WHISPER_DEVICE=cuda.
    device = os.environ.get("FASTER_WHISPER_DEVICE", "cpu")

    with tempfile.TemporaryDirectory(prefix="openclaw-transcribe-") as td:
        wav_path = os.path.join(td, "audio.wav")
        _ffmpeg_to_wav(in_path, wav_path)

        model = WhisperModel(model_name, device=device, compute_type=compute_type)

        segments, info = model.transcribe(
            wav_path,
            beam_size=int(os.environ.get("FASTER_WHISPER_BEAM_SIZE", "5")),
            vad_filter=True,
        )

        # Print plain text only (OpenClaw CLI transcription expects plain text).
        texts: list[str] = []
        for seg in segments:
            t = (seg.text or "").strip()
            if t:
                texts.append(t)

        transcript = " ".join(texts).strip()
        if not transcript:
            # Still return 0; empty transcript is valid (silence).
            return 0

        sys.stdout.write(transcript + "\n")
        return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
