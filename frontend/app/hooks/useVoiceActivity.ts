"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMicVAD } from "@ricky0123/vad-react";
import { VAD_DEFAULT_OPTIONS, SPEECH_LOG_MAX_ENTRIES, WS_AUDIO_URL } from "@/app/constants";
import { audioPlayer } from "@/app/services";
import { audioSocket, ConnectionState, TranscriptMessage } from "@/app/services/audioSocket";
import { int16ToFloat32, arrayBufferToInt16 } from "@/app/utils/audioEncoder";
import type { SpeechLogEntry } from "@/app/types";

interface UseVoiceActivityOptions {
  autoPlayback?: boolean;
  useEchoServer?: boolean;
}

export function useVoiceActivity(options: UseVoiceActivityOptions = {}) {
  const { autoPlayback = true, useEchoServer = true } = options;

  const [speechLog, setSpeechLog] = useState<SpeechLogEntry[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [subtitle, setSubtitle] = useState<string>("");
  const isConnectedRef = useRef(false);
  const subtitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addLogEntry = useCallback(
    (type: SpeechLogEntry["type"], message: string) => {
      const entry: SpeechLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
      };
      setSpeechLog((prev) =>
        [...prev, entry].slice(-SPEECH_LOG_MAX_ENTRIES)
      );
    },
    []
  );

  // WebSocket 연결 관리
  useEffect(() => {
    if (!useEchoServer) return;

    audioSocket.connect(WS_AUDIO_URL, {
      onConnectionChange: (state) => {
        setConnectionState(state);
        isConnectedRef.current = state === "connected";
        if (state === "connected") {
          addLogEntry("info", "서버 연결됨");
        } else if (state === "disconnected") {
          addLogEntry("info", "서버 연결 끊김");
        } else if (state === "error") {
          addLogEntry("error", "서버 연결 오류");
        }
      },
      onMessage: (data) => {
        // 바이너리 데이터 수신 (에코된 오디오)
        if (data instanceof ArrayBuffer) {
          const int16Data = arrayBufferToInt16(data);
          const float32Data = int16ToFloat32(int16Data);
          addLogEntry("end", "에코 오디오 재생 중...");
          audioPlayer.play(float32Data);
        } else if (typeof data === "string") {
          // JSON 응답 처리
          try {
            const response = JSON.parse(data);
            if (response.status === "ready") {
              addLogEntry("info", `세션 ID: ${response.session_id?.slice(0, 8)}...`);
            }
          } catch {
            console.log("Server message:", data);
          }
        }
      },
      onTranscript: (transcript: TranscriptMessage) => {
        // 자막 업데이트
        setSubtitle(transcript.text);
        addLogEntry("info", `📝 ${transcript.text}`);

        // 5초 후 자막 자동 제거
        if (subtitleTimeoutRef.current) {
          clearTimeout(subtitleTimeoutRef.current);
        }
        subtitleTimeoutRef.current = setTimeout(() => {
          setSubtitle("");
        }, 5000);
      },
      onError: (error) => {
        console.error("WebSocket error:", error);
      },
    });

    return () => {
      audioSocket.disconnect();
    };
  }, [useEchoServer, addLogEntry]);

  const vad = useMicVAD({
    ...VAD_DEFAULT_OPTIONS,
    onSpeechStart: () => {
      addLogEntry("start", "음성 감지 시작");
    },
    onSpeechEnd: (audio) => {
      if (useEchoServer && isConnectedRef.current) {
        // 서버로 오디오 전송
        addLogEntry("info", "서버로 전송 중...");
        audioSocket.sendAudio(audio);
      } else if (autoPlayback) {
        // 로컬 재생
        addLogEntry("end", "음성 재생 중...");
        audioPlayer.play(audio);
      }
    },
    onFrameProcessed: (probs) => {
      setAudioLevel(probs.isSpeech);
    },
  });

  const clearLog = useCallback(() => {
    setSpeechLog([]);
  }, []);

  // 클린업
  useEffect(() => {
    return () => {
      if (subtitleTimeoutRef.current) {
        clearTimeout(subtitleTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...vad,
    audioLevel,
    speechLog,
    clearLog,
    connectionState,
    subtitle,
  };
}
