"use client";

import { useVoiceActivity } from "@/app/hooks";
import { Button, StatusIndicator, AudioLevelBar } from "@/app/components/ui";
import { SpeechLog } from "./SpeechLog";
import type { ConnectionState } from "@/app/services/audioSocket";

type VADStatus = "idle" | "listening" | "speaking" | "loading" | "error";

function getVADStatus(vad: {
  loading: boolean;
  errored: string | false;
  listening: boolean;
  userSpeaking: boolean;
}): VADStatus {
  if (vad.loading) return "loading";
  if (vad.errored) return "error";
  if (!vad.listening) return "idle";
  if (vad.userSpeaking) return "speaking";
  return "listening";
}

function getConnectionBadge(state: ConnectionState) {
  const styles: Record<ConnectionState, string> = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-gray-400",
    error: "bg-red-500",
  };
  const labels: Record<ConnectionState, string> = {
    connected: "서버 연결됨",
    connecting: "연결 중...",
    disconnected: "연결 안됨",
    error: "연결 오류",
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full ${styles[state]}`} />
      <span className="text-zinc-600 dark:text-zinc-400">{labels[state]}</span>
    </div>
  );
}

export function VoiceMonitor() {
  const vad = useVoiceActivity({ autoPlayback: true, useEchoServer: true });
  const status = getVADStatus(vad);

  return (
    <div className="relative flex flex-col items-center gap-6 p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        STT Test
      </h2>

      {getConnectionBadge(vad.connectionState)}

      <StatusIndicator status={status} />

      <AudioLevelBar level={vad.audioLevel} />

      <div className="flex gap-4">
        <Button
          variant="primary"
          onClick={() => vad.start()}
          disabled={vad.listening || vad.loading}
        >
          시작
        </Button>
        <Button
          variant="danger"
          onClick={() => vad.pause()}
          disabled={!vad.listening}
        >
          중지
        </Button>
      </div>

      {vad.errored && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg w-full text-sm">
          {vad.errored.toString()}
        </div>
      )}

      <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center space-y-1">
        <p>음성 감지 → 서버 전송 → STT 변환</p>
        <p>RNNoise + DSP + faster-whisper</p>
      </div>

      <SpeechLog entries={vad.speechLog} />

      {/* 자막 오버레이 */}
      {vad.subtitle && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[90%]">
          <div className="bg-black/80 backdrop-blur-sm text-white text-center px-6 py-4 rounded-lg shadow-2xl">
            <p className="text-lg font-medium leading-relaxed">
              {vad.subtitle}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
