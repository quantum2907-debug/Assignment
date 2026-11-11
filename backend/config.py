import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SAMPLE_RATE = 16_000
CHANNELS = 1
FRAME_MS = 20
MIN_SPEECH_MS = 250
SILENCE_MS = 500
# Extends the end-of-speech wait without adding non-speech samples to Whisper.
PADDING_MS = 0
VAD_MODE = 2
WHISPER_MODEL = "base"
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
