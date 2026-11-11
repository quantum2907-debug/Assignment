import asyncio
import logging
from functools import lru_cache

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from llm_analyzer import AnalysisError, analyze_transcript
from schemas import AnalysisRequest, MedicalSummary
from audio_vad import SpeechSegmenter
from config import CHANNELS, SAMPLE_RATE
from transcriber import LocalTranscriber

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Live Medical Transcription")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


@lru_cache(maxsize=1)
def get_transcriber() -> LocalTranscriber:
    # Loading the model only when needed keeps the server quick to start.
    return LocalTranscriber()


def transcribe_audio(audio: bytes) -> str:
    return get_transcriber().transcribe(audio)


@app.post("/analyze", response_model=MedicalSummary)
async def analyze(request: AnalysisRequest) -> MedicalSummary:
    transcript = request.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="Transcript cannot be blank.")

    try:
        return await asyncio.to_thread(analyze_transcript, transcript)
    except AnalysisError as error:
        logger.warning("Transcript analysis failed: %s", error)
        status_code = 503 if "GEMINI_API_KEY is missing" in str(error) else 502
        raise HTTPException(status_code=status_code, detail=str(error)) from error


@app.websocket("/ws/audio")
async def stream_audio(websocket: WebSocket) -> None:
    await websocket.accept()
    segmenter = SpeechSegmenter()
    chunk_number = 0

    try:
        while True:
            message = await websocket.receive()

            if message.get("bytes") is not None:
                utterances = segmenter.add_audio(message["bytes"])
                for utterance in utterances:
                    chunk_number = await transcribe_and_send(
                        websocket, utterance, chunk_number
                    )
                continue

            text = message.get("text")
            if text is None:
                continue

            if text == "start":
                await websocket.send_json(
                    {
                        "type": "ready",
                        "sample_rate": SAMPLE_RATE,
                        "channels": CHANNELS,
                    }
                )
            elif text == "stop":
                final_utterance = segmenter.flush()
                if final_utterance is not None:
                    chunk_number = await transcribe_and_send(
                        websocket, final_utterance, chunk_number
                    )
                await websocket.send_json({"type": "stopped"})
                return
            else:
                await websocket.send_json(
                    {"type": "error", "message": "Unsupported WebSocket message."}
                )
    except WebSocketDisconnect:
        logger.info("Audio WebSocket disconnected.")


async def transcribe_and_send(
    websocket: WebSocket, audio: bytes, chunk_number: int
) -> int:
    try:
        text = await asyncio.to_thread(transcribe_audio, audio)
    except Exception as error:
        logger.exception("Speech transcription failed.")
        await websocket.send_json(
            {"type": "error", "message": f"Speech transcription failed: {error}"}
        )
        return chunk_number

    if not text:
        return chunk_number

    chunk_number += 1
    await websocket.send_json(
        {"type": "transcript", "text": text, "chunk": chunk_number}
    )
    return chunk_number
