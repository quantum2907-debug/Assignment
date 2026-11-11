const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

const processorCode = `
class Pcm16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 320;
    this.frame = new Int16Array(this.frameSize);
    this.framePosition = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (output) {
      for (const channel of output) channel.fill(0);
    }

    if (!input || !input[0]) return true;

    for (const sample of input[0]) {
      const clipped = Math.max(-1, Math.min(1, sample));
      this.frame[this.framePosition] = clipped < 0
        ? clipped * 32768
        : clipped * 32767;
      this.framePosition += 1;

      if (this.framePosition === this.frameSize) {
        const completeFrame = this.frame;
        this.frame = new Int16Array(this.frameSize);
        this.framePosition = 0;
        this.port.postMessage(completeFrame.buffer, [completeFrame.buffer]);
      }
    }

    return true;
  }
}

registerProcessor("pcm16-processor", Pcm16Processor);
`;

export interface AudioCapture {
  stop: () => Promise<void>;
}

export function createWavBlob(frames: Uint8Array[]): Blob {
  const audioLength = frames.reduce((total, frame) => total + frame.byteLength, 0);
  const headerLength = 44;
  const wav = new ArrayBuffer(headerLength + audioLength);
  const view = new DataView(wav);
  const bytes = new Uint8Array(wav);

  function writeText(offset: number, text: string): void {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  }

  writeText(0, "RIFF");
  view.setUint32(4, headerLength - 8 + audioLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8, true);
  view.setUint16(32, CHANNELS * BITS_PER_SAMPLE / 8, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeText(36, "data");
  view.setUint32(40, audioLength, true);

  let position = headerLength;
  for (const frame of frames) {
    bytes.set(frame, position);
    position += frame.byteLength;
  }

  return new Blob([wav], { type: "audio/wav" });
}

export async function startAudioCapture(
  onAudioFrame: (frame: ArrayBuffer) => void
): Promise<AudioCapture> {
  const microphone = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  let audioContext: AudioContext | undefined;
  let workletUrl: string | undefined;

  try {
    const context = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContext = context;
    if (context.sampleRate !== SAMPLE_RATE) {
      throw new Error("This browser could not provide 16 kHz audio.");
    }

    const worklet = new Blob([processorCode], { type: "text/javascript" });
    workletUrl = URL.createObjectURL(worklet);
    await context.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);
    workletUrl = undefined;

    const source = context.createMediaStreamSource(microphone);
    const processor = new AudioWorkletNode(context, "pcm16-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });

    processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      onAudioFrame(event.data);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    return {
      stop: async () => {
        processor.port.onmessage = null;
        source.disconnect();
        processor.disconnect();
        microphone.getTracks().forEach((track) => track.stop());
        await context.close();
      }
    };
  } catch (error) {
    microphone.getTracks().forEach((track) => track.stop());
    if (workletUrl) URL.revokeObjectURL(workletUrl);
    await audioContext?.close();
    throw error;
  }
}
