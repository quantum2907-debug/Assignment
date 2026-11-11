export interface TranscriptMessage {
  type: "transcript";
  text: string;
  chunk: number;
}

export interface SocketMessage {
  type: string;
  text?: string;
  chunk?: number;
  message?: string;
}

export class AudioSocket {
  private socket: WebSocket;

  constructor(
    onMessage: (message: SocketMessage) => void,
    onDisconnect: () => void
  ) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.socket = new WebSocket(`${protocol}//${window.location.hostname}:8000/ws/audio`);
    this.socket.binaryType = "arraybuffer";
    this.socket.onmessage = (event: MessageEvent<string>) => {
      try {
        onMessage(JSON.parse(event.data) as SocketMessage);
      } catch {
        onMessage({
          type: "error",
          message: "The transcription server sent an unreadable response."
        });
      }
    };
    this.socket.onclose = onDisconnect;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.onopen = () => {
        this.socket.send("start");
        resolve();
      };
      this.socket.onerror = () => reject(new Error("Could not connect to the transcription server."));
    });
  }

  sendAudio(frame: ArrayBuffer): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(frame);
    }
  }

  stop(): Promise<void> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      this.socket.close();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const finish = (): void => {
        window.clearTimeout(timeout);
        this.socket.removeEventListener("message", handleMessage);
        this.socket.close();
        resolve();
      };

      const handleMessage = (event: MessageEvent<string>): void => {
        try {
          const message = JSON.parse(event.data) as SocketMessage;
          if (message.type === "stopped") {
            finish();
          }
        } catch {
          finish();
        }
      };

      const timeout = window.setTimeout(finish, 3000);
      this.socket.addEventListener("message", handleMessage);
      this.socket.send("stop");
    });
  }

  close(): void {
    this.socket.close();
  }
}
