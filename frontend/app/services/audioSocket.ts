/**
 * WebSocket 기반 오디오 전송 서비스
 *
 * 프로토콜:
 * 1. 연결 시 메타데이터 헤더 전송 (12 bytes)
 * 2. 음성 감지 시 Int16 PCM 청크 전송
 * 3. 서버 응답 수신 (텍스트 또는 바이너리)
 */

import { AUDIO_SAMPLE_RATE } from "@/app/constants";
import {
  float32ToInt16,
  int16ToArrayBuffer,
  createMetadataHeader,
} from "@/app/utils/audioEncoder";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface TranscriptMessage {
  type: "transcript";
  text: string;
  isFinal: boolean;
}

export interface AudioSocketCallbacks {
  onConnectionChange?: (state: ConnectionState) => void;
  onMessage?: (data: string | ArrayBuffer) => void;
  onTranscript?: (transcript: TranscriptMessage) => void;
  onError?: (error: Event) => void;
}

class AudioSocketService {
  private socket: WebSocket | null = null;
  private url: string = "";
  private callbacks: AudioSocketCallbacks = {};
  private connectionState: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private metadataSent = false;

  /**
   * WebSocket 연결
   */
  connect(url: string, callbacks: AudioSocketCallbacks = {}): void {
    this.url = url;
    this.callbacks = callbacks;
    this.reconnectAttempts = 0;
    this._connect();
  }

  private _connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setConnectionState("connecting");

    try {
      this.socket = new WebSocket(this.url);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        this.setConnectionState("connected");
        this.reconnectAttempts = 0;
        this.metadataSent = false;
        this.sendMetadata();
      };

      this.socket.onclose = () => {
        this.setConnectionState("disconnected");
        this.tryReconnect();
      };

      this.socket.onerror = (error) => {
        this.setConnectionState("error");
        this.callbacks.onError?.(error);
      };

      this.socket.onmessage = (event) => {
        const data = event.data;

        // 바이너리 데이터는 그대로 전달
        if (data instanceof ArrayBuffer) {
          this.callbacks.onMessage?.(data);
          return;
        }

        // 텍스트 메시지 (JSON) 파싱
        if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);

            // 자막(Transcript) 메시지 처리
            if (parsed.type === "transcript") {
              this.callbacks.onTranscript?.({
                type: "transcript",
                text: parsed.text,
                isFinal: parsed.isFinal,
              });
              return;
            }

            // 기타 JSON 메시지는 onMessage로 전달
            this.callbacks.onMessage?.(data);
          } catch {
            // JSON 파싱 실패 시 문자열 그대로 전달
            this.callbacks.onMessage?.(data);
          }
        }
      };
    } catch (error) {
      this.setConnectionState("error");
      console.error("WebSocket connection failed:", error);
    }
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.callbacks.onConnectionChange?.(state);
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      setTimeout(() => this._connect(), delay);
    }
  }

  /**
   * 오디오 메타데이터 전송 (연결 시 1회)
   */
  private sendMetadata(): void {
    if (this.metadataSent || !this.isConnected()) return;

    const metadata = createMetadataHeader({
      sampleRate: AUDIO_SAMPLE_RATE,
      channels: 1,
      bitsPerSample: 16,
    });

    this.socket?.send(metadata);
    this.metadataSent = true;
  }

  /**
   * 음성 데이터 전송 (Float32Array → Int16 → ArrayBuffer)
   */
  sendAudio(audioData: Float32Array): boolean {
    if (!this.isConnected()) {
      console.warn("WebSocket not connected");
      return false;
    }

    // Float32 → Int16 변환 (용량 50% 절감)
    const int16Data = float32ToInt16(audioData);
    const buffer = int16ToArrayBuffer(int16Data);

    this.socket?.send(buffer);
    return true;
  }

  /**
   * 텍스트 메시지 전송
   */
  sendText(message: string): boolean {
    if (!this.isConnected()) return false;
    this.socket?.send(message);
    return true;
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * 연결 종료
   */
  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // 재연결 방지
    this.socket?.close();
    this.socket = null;
    this.metadataSent = false;
    this.setConnectionState("disconnected");
  }
}

export const audioSocket = new AudioSocketService();
