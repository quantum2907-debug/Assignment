# Live Medical Transcription

A local demo that streams microphone audio to a FastAPI server, filters speech with WebRTC VAD, transcribes speech with faster-whisper, and sends the finished transcript to Gemini for a structured summary.

This is a student demo, not a medical device or a substitute for clinical judgment. AI output can be incomplete or wrong. Review every result. Audio streams to the local backend for transcription and is not saved by the app unless you download it. Transcript text is sent to Google Gemini when you choose **Process Transcript with AI**. Do not use real patient information unless your organization has approved that use.

## Requirements

- Windows, macOS, or Linux
- Python 3.11 or newer
- Node.js 20 or newer and npm
- A Gemini API key for the analysis phase
- A microphone and a browser that supports AudioWorklet

## Setup

Open a terminal in the project folder.

1. Create a virtual environment and install the backend packages:

   ```powershell
   cd backend
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   cd ..
   ```

   On macOS or Linux, replace the activation command with:

   ```sh
   source backend/.venv/bin/activate
   ```

2. Copy `.env.example` to `.env` in the project root and set `GEMINI_API_KEY`. Keep this key private; `.env` is ignored by Git.

3. In a terminal with the virtual environment active, start the backend:

   ```powershell
   cd backend
   python -m uvicorn main:app --reload --port 8000
   ```

4. In a second terminal, start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. Open the local Vite address (normally `http://localhost:5173`). Allow microphone access, click **Start Mic**, speak, and click **Stop**. When the transcript is ready, click **Process Transcript with AI**.

The first transcription may take longer: faster-whisper downloads its `base` model on first use. Transcription runs locally on CPU using int8. Keep both servers running while using the app. Use the same hostname (`localhost` or `127.0.0.1`) for the frontend and backend.

## Using the controls

- **Start Mic / Stop:** start and finish a live transcription session.
- **Clear:** clears the on-screen transcript and the audio currently held for download. It does not stop an active microphone session.
- **Save Recording:** downloads the captured microphone audio as a mono 16 kHz PCM WAV and the current transcript as a text file.
- **Process Transcript with AI:** sends only the transcript to the backend for Gemini analysis.
- **Clear** on the summary card: resets the summary fields.
- **Copy to Prescription:** copies the patient details and visible summary to the clipboard. Review and edit the clinical summary before using it.

The downloaded WAV contains microphone audio, including silence. VAD excludes nonspeech frames only from the audio sent to Whisper.

## VAD settings

Speech detection settings are in `backend/config.py`:

- `MIN_SPEECH_MS` drops utterances shorter than the configured duration.
- `SILENCE_MS` sets how much silence ends an utterance.
- `PADDING_MS` extends that end-of-speech wait. It does not add silence samples to the audio sent to Whisper.

## Demo script

Use the fictional read-aloud visit in [demo-script.txt](./demo-script.txt). It is designed to take about five minutes at a steady conversational pace, with pauses between turns. The patient and clinician lines can be read by one person.

## Troubleshooting

- **Microphone permission denied:** allow microphone access for the local Vite page, then reload.
- **Server disconnected:** confirm the backend is running on port 8000 and that you opened the frontend with the same hostname.
- **Browser cannot provide 16 kHz audio:** try a current desktop browser with AudioWorklet support.
- **No transcript appears:** speak clearly for at least a short phrase; VAD ignores very short sounds and waits for a pause before sending a phrase to Whisper.
- **AI analysis fails:** check that the root `.env` contains a valid `GEMINI_API_KEY` and that the backend can reach Gemini.

## Project layout

```text
backend/        FastAPI, WebRTC VAD, faster-whisper, Gemini analysis
frontend/       Vite, TypeScript, HTML, and CSS
.env.example   Gemini key template
demo-script.txt Fictional read-aloud demo conversation
```
