"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const WS_BASE_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL || 'ws://localhost:8080/ws/audio';
const SAMPLE_RATE = Number(process.env.NEXT_PUBLIC_AUDIO_SAMPLE_RATE) || 16000;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'handshaking' | 'ready' | 'error';

interface HandshakeResponse {
    status: 'ready' | 'error';
    session_id: string;
    mode: 'ai' | 'echo';
    message?: string;
}

interface TranscriptMessage {
    type: 'transcript';
    text: string;
    original: string;
    translated: string;
    isFinal: boolean;
}

export interface TranscriptData {
    original: string;
    translated: string;
    isFinal: boolean;
}

interface UseAudioWebSocketConfig {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    onTranscript?: (data: TranscriptData) => void;
    onAudio?: (audioData: ArrayBuffer) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
    onError?: (error: Error) => void;
    enabled?: boolean;
}

// 12바이트 메타데이터 헤더 생성 (Little Endian)
function createMetadataHeader(sampleRate: number, channels: number, bitsPerSample: number): ArrayBuffer {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setUint32(0, sampleRate, true);    // Little Endian
    view.setUint16(4, channels, true);
    view.setUint16(6, bitsPerSample, true);
    view.setUint32(8, 0, true);             // Reserved
    return buffer;
}

export function useAudioWebSocket({
    sampleRate = SAMPLE_RATE,
    channels = 1,
    bitsPerSample = 16,
    onTranscript,
    onAudio,
    onStatusChange,
    onError,
    enabled = false,
}: UseAudioWebSocketConfig = {}) {
    const wsRef = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [mode, setMode] = useState<'ai' | 'echo' | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isHandshakeCompleteRef = useRef(false);
    const isMountedRef = useRef(false);
    const enabledRef = useRef(enabled);

    // 콜백 refs (최신 콜백 유지 - 매 렌더마다 업데이트)
    const onTranscriptRef = useRef(onTranscript);
    const onAudioRef = useRef(onAudio);
    const onErrorRef = useRef(onError);
    onTranscriptRef.current = onTranscript;
    onAudioRef.current = onAudio;
    onErrorRef.current = onError;

    // enabled 값을 ref에 동기화
    useEffect(() => {
        enabledRef.current = enabled;
    }, [enabled]);

    const updateStatus = useCallback((newStatus: ConnectionStatus) => {
        if (!isMountedRef.current) return;
        setStatus(newStatus);
        onStatusChange?.(newStatus);
    }, [onStatusChange]);

    const connect = useCallback(() => {
        console.log("[AudioWS] connect() called, enabled:", enabledRef.current);
        if (!enabledRef.current) return;

        // 이미 연결중이거나 연결된 상태면 무시
        if (wsRef.current?.readyState === WebSocket.CONNECTING ||
            wsRef.current?.readyState === WebSocket.OPEN) {
            console.log("[AudioWS] Already connecting/connected, skipping");
            return;
        }

        console.log("[AudioWS] Connecting to:", WS_BASE_URL);
        updateStatus('connecting');
        isHandshakeCompleteRef.current = false;

        const ws = new WebSocket(WS_BASE_URL);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
            if (!isMountedRef.current) {
                ws.close();
                return;
            }
            console.log("[AudioWS] WebSocket opened, sending handshake...");
            updateStatus('handshaking');

            // 핸드셰이크: 12바이트 메타데이터 전송
            const metadata = createMetadataHeader(sampleRate, channels, bitsPerSample);
            ws.send(metadata);
        };

        ws.onmessage = (event) => {
            if (!isMountedRef.current) return;

            // 핸드셰이크 응답 (JSON)
            if (!isHandshakeCompleteRef.current && typeof event.data === 'string') {
                try {
                    const response: HandshakeResponse = JSON.parse(event.data);
                    if (response.status === 'ready') {
                        console.log("[AudioWS] Handshake complete:", response);
                        isHandshakeCompleteRef.current = true;
                        setSessionId(response.session_id);
                        setMode(response.mode);
                        updateStatus('ready');
                    } else {
                        console.error("[AudioWS] Handshake failed:", response.message);
                        updateStatus('error');
                        onErrorRef.current?.(new Error(response.message || 'Handshake failed'));
                    }
                } catch (e) {
                    console.error("[AudioWS] Failed to parse handshake response:", e);
                }
                return;
            }

            // 데이터 응답
            if (typeof event.data === 'string') {
                // JSON 응답 (transcript)
                try {
                    console.log("[AudioWS] Received text message:", event.data);
                    const data: TranscriptMessage = JSON.parse(event.data);
                    console.log("[AudioWS] Parsed JSON:", {
                        type: data.type,
                        typeCheck: data.type === 'transcript',
                        original: data.original,
                        translated: data.translated,
                        text: data.text,
                        isFinal: data.isFinal,
                    });
                    if (data.type === 'transcript') {
                        console.log("[AudioWS] Type check passed! Calling onTranscriptRef.current");
                        console.log("[AudioWS] onTranscriptRef.current exists:", !!onTranscriptRef.current);
                        const transcriptData = {
                            original: data.original || data.text,
                            translated: data.translated || data.text,
                            isFinal: data.isFinal,
                        };
                        console.log("[AudioWS] Calling callback with:", transcriptData);
                        onTranscriptRef.current?.(transcriptData);
                        console.log("[AudioWS] Callback invoked");
                    } else {
                        console.log("[AudioWS] Type check failed! data.type =", data.type);
                    }
                } catch (e) {
                    console.error("[AudioWS] Failed to parse transcript message:", e);
                }
            } else if (event.data instanceof ArrayBuffer) {
                // Binary 응답 (TTS audio)
                console.log("[AudioWS] Received audio data:", event.data.byteLength, "bytes");
                onAudioRef.current?.(event.data);
            }
        };

        ws.onclose = (event) => {
            console.log("[AudioWS] Disconnected, code:", event.code, "reason:", event.reason);
            if (!isMountedRef.current) return;

            updateStatus('disconnected');
            isHandshakeCompleteRef.current = false;
            setSessionId(null);
            setMode(null);

            // 재연결 시도 (3초 후) - mounted 상태이고 enabled일 때만
            if (isMountedRef.current && enabledRef.current) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current && enabledRef.current) {
                        connect();
                    }
                }, 3000);
            }
        };

        ws.onerror = (event) => {
            console.error("[AudioWS] Error:", event);
            if (isMountedRef.current) {
                onErrorRef.current?.(new Error('WebSocket connection error'));
            }
        };
    }, [sampleRate, channels, bitsPerSample, updateStatus]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        isHandshakeCompleteRef.current = false;
        setSessionId(null);
        setMode(null);
        updateStatus('disconnected');
    }, [updateStatus]);

    const sendAudio = useCallback((audioData: ArrayBuffer | Int16Array) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN || !isHandshakeCompleteRef.current) {
            return false;
        }

        try {
            if (audioData instanceof Int16Array) {
                wsRef.current.send(audioData.buffer);
            } else {
                wsRef.current.send(audioData);
            }
            return true;
        } catch (e) {
            console.error("[AudioWS] Failed to send audio:", e);
            return false;
        }
    }, []);

    // Mount/Unmount 추적
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // enabled 변경 시 연결/해제
    useEffect(() => {
        if (enabled) {
            // 약간의 지연을 두어 React strict mode의 이중 마운트 처리
            const timer = setTimeout(() => {
                if (isMountedRef.current && enabledRef.current) {
                    connect();
                }
            }, 100);
            return () => clearTimeout(timer);
        } else {
            disconnect();
        }
    }, [enabled]); // connect, disconnect를 의존성에서 제외 (안정적인 참조)

    // 최종 클린업
    useEffect(() => {
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    return {
        status,
        sessionId,
        mode,
        isConnected: status === 'ready',
        sendAudio,
        reconnect: connect,
        disconnect,
    };
}
