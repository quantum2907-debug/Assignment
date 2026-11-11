import "./style.css";
import { createWavBlob, startAudioCapture, type AudioCapture } from "./audio";
import { AudioSocket, type SocketMessage } from "./socket";
import {
  appendTranscriptChunk,
  clearTranscript,
  getTranscriptText,
  getPrescriptionText,
  renderEmptySummary,
  renderSummary,
  setConnectionLabel,
  setStatus
} from "./ui";

renderEmptySummary();

const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const stopButton = document.querySelector<HTMLButtonElement>("#stop-button");
const processButton = document.querySelector<HTMLButtonElement>("#process-button");
const clearTranscriptButton = document.querySelector<HTMLButtonElement>("#clear-transcript-button");
const saveButton = document.querySelector<HTMLButtonElement>("#save-button");
const clearSummaryButton = document.querySelector<HTMLButtonElement>("#clear-summary-button");
const copyButton = document.querySelector<HTMLButtonElement>("#copy-button");
if (
  !startButton ||
  !stopButton ||
  !processButton ||
  !clearTranscriptButton ||
  !saveButton ||
  !clearSummaryButton ||
  !copyButton
) {
  throw new Error("A required application control is missing.");
}
const analyzeButton = processButton;
const clearTranscriptControl = clearTranscriptButton;

let audioCapture: AudioCapture | undefined;
let audioSocket: AudioSocket | undefined;
let stoppingSession = false;
let sessionActive = false;
let recordingFrames: Uint8Array[] = [];
let hasSummary = false;

function handleSocketMessage(message: SocketMessage): void {
  if (message.type === "transcript" && message.text && message.chunk) {
    appendTranscriptChunk(message.text);
    analyzeButton.disabled = false;
    clearTranscriptControl.disabled = false;
  } else if (message.type === "error") {
    setStatus(message.message ?? "The transcription server reported an error.", true);
  }
}

function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

analyzeButton.disabled = true;
analyzeButton.addEventListener("click", async () => {
  const transcript = getTranscriptText();
  if (!transcript) {
    setStatus("Record speech before requesting an AI summary.");
    return;
  }

  analyzeButton.disabled = true;
  setStatus("Sending transcript to Gemini for structured analysis...");

  try {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const response = await fetch(`${protocol}//${window.location.hostname}:8000/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    if (!response.ok) {
      const problem = (await response.json()) as { detail?: string };
      throw new Error(problem.detail ?? `Analysis failed (${response.status}).`);
    }

    renderSummary(await response.json());
    hasSummary = true;
    clearSummaryButton.disabled = false;
    copyButton.disabled = false;
    setStatus("AI summary is ready. Review it for accuracy.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not analyze the transcript.";
    setStatus(message, true);
  } finally {
    analyzeButton.disabled = false;
  }
});

clearTranscriptButton.addEventListener("click", () => {
  clearTranscript();
  recordingFrames = [];
  clearTranscriptButton.disabled = true;
  saveButton.disabled = true;
  analyzeButton.disabled = true;
  setStatus(sessionActive ? "Transcript and recording cleared. Listening continues." : "Transcript and recording cleared.");
});

saveButton.addEventListener("click", () => {
  if (recordingFrames.length === 0) {
    setStatus("There is no recorded audio to save.");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadFile(createWavBlob(recordingFrames), `medical-recording-${timestamp}.wav`);
  const transcript = getTranscriptText();
  downloadFile(
    new Blob([transcript], { type: "text/plain;charset=utf-8" }),
    `medical-transcript-${timestamp}.txt`
  );
  setStatus("WAV recording and transcript downloads started.");
});

clearSummaryButton.addEventListener("click", () => {
  renderEmptySummary();
  hasSummary = false;
  copyButton.disabled = true;
  clearSummaryButton.disabled = true;
  setStatus("AI summary cleared.");
});

copyButton.disabled = true;
copyButton.addEventListener("click", async () => {
  if (!hasSummary) {
    setStatus("Process a transcript before copying a prescription.");
    return;
  }

  try {
    await navigator.clipboard.writeText(getPrescriptionText());
    setStatus("Formatted summary copied to the clipboard.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clipboard access was denied.";
    setStatus(`Could not copy the summary: ${message}`, true);
  }
});

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  setStatus("Connecting to the transcription server...");

  const socket = new AudioSocket(handleSocketMessage, () => {
    setConnectionLabel("Server disconnected");
    if (sessionActive && !stoppingSession) {
      sessionActive = false;
      void audioCapture?.stop().catch((error: unknown) => {
        console.error("Could not stop microphone after server disconnect.", error);
      });
      audioCapture = undefined;
      stopButton.disabled = true;
      startButton.disabled = false;
      setStatus("Connection to the transcription server was lost.", true);
    }
  });
  audioSocket = socket;

  try {
    await socket.connect();
    setConnectionLabel("Connected");
    audioCapture = await startAudioCapture((frame) => {
      recordingFrames.push(new Uint8Array(frame.slice(0)));
      saveButton.disabled = false;
      clearTranscriptControl.disabled = false;
      socket.sendAudio(frame);
    });
    sessionActive = true;
    stoppingSession = false;
    stopButton.disabled = false;
    setStatus("Listening - speak naturally. VAD will send recognized speech as it arrives.");
  } catch (error) {
    socket.close();
    audioSocket = undefined;
    startButton.disabled = false;
    setConnectionLabel("Server disconnected");
    const message = error instanceof Error ? error.message : "Could not start microphone capture.";
    setStatus(`Could not start transcription: ${message}`, true);
  }
});

stopButton.addEventListener("click", async () => {
  stoppingSession = true;
  sessionActive = false;
  stopButton.disabled = true;
  setStatus("Stopping microphone and finishing the last speech chunk...");

  try {
    await audioCapture?.stop();
    audioCapture = undefined;
    await audioSocket?.stop();
    audioSocket = undefined;
    setStatus("Session stopped.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected stop error occurred.";
    setStatus(`Could not stop cleanly: ${message}`, true);
  } finally {
    audioCapture = undefined;
    audioSocket = undefined;
    stoppingSession = false;
    startButton.disabled = false;
    setConnectionLabel("Server disconnected");
  }
});
