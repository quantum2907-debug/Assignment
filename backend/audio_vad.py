import webrtcvad

from config import (
    FRAME_MS,
    MIN_SPEECH_MS,
    PADDING_MS,
    SAMPLE_RATE,
    SILENCE_MS,
    VAD_MODE,
)


class SpeechSegmenter:
    def __init__(self) -> None:
        self.vad = webrtcvad.Vad(VAD_MODE)
        self.frame_bytes = SAMPLE_RATE * FRAME_MS // 1000 * 2
        self.minimum_frames = (MIN_SPEECH_MS + FRAME_MS - 1) // FRAME_MS
        self.end_silence_ms = SILENCE_MS + PADDING_MS
        self.pending_audio = bytearray()
        self.speech_frames: list[bytes] = []
        self.speech_ms = 0
        self.silence_ms = 0

    def add_audio(self, audio: bytes) -> list[bytes]:
        self.pending_audio.extend(audio)
        utterances = []

        while len(self.pending_audio) >= self.frame_bytes:
            frame = bytes(self.pending_audio[: self.frame_bytes])
            del self.pending_audio[: self.frame_bytes]

            if self.vad.is_speech(frame, SAMPLE_RATE):
                self.speech_frames.append(frame)
                self.speech_ms += FRAME_MS
                self.silence_ms = 0
            elif self.speech_frames:
                # Count the pause, but never send its audio samples to Whisper.
                self.silence_ms += FRAME_MS
                if self.silence_ms >= self.end_silence_ms:
                    utterance = self._finish_utterance()
                    if utterance is not None:
                        utterances.append(utterance)

        return utterances

    def flush(self) -> bytes | None:
        return self._finish_utterance()

    def _finish_utterance(self) -> bytes | None:
        audio = b"".join(self.speech_frames)
        is_long_enough = self.speech_ms >= self.minimum_frames * FRAME_MS

        self.speech_frames.clear()
        self.speech_ms = 0
        self.silence_ms = 0

        return audio if is_long_enough else None
