import numpy as np
from faster_whisper import WhisperModel

from config import WHISPER_COMPUTE_TYPE, WHISPER_DEVICE, WHISPER_MODEL


class LocalTranscriber:
    def __init__(self) -> None:
        self.model = WhisperModel(
            WHISPER_MODEL,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
        )

    def transcribe(self, audio: bytes) -> str:
        samples = np.frombuffer(audio, dtype=np.int16).astype(np.float32) / 32768.0
        segments, _ = self.model.transcribe(samples, vad_filter=False)
        return " ".join(segment.text.strip() for segment in segments).strip()
