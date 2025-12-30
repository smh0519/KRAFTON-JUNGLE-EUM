"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioPlaybackOptions {
    volume?: number;
    onPlayStart?: () => void;
    onPlayEnd?: () => void;
    onError?: (error: Error) => void;
}

interface UseAudioPlaybackReturn {
    isPlaying: boolean;
    volume: number;
    setVolume: (volume: number) => void;
    playAudio: (audioData: ArrayBuffer) => Promise<void>;
    stopAudio: () => void;
    queueAudio: (audioData: ArrayBuffer) => void;
}

export function useAudioPlayback({
    volume: initialVolume = 1.0,
    onPlayStart,
    onPlayEnd,
    onError,
}: UseAudioPlaybackOptions = {}): UseAudioPlaybackReturn {
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isProcessingRef = useRef(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolumeState] = useState(initialVolume);

    // AudioContext 초기화
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.value = volume;
            gainNodeRef.current.connect(audioContextRef.current.destination);
        }

        // suspended 상태면 resume
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        return audioContextRef.current;
    }, [volume]);

    // 볼륨 설정
    const setVolume = useCallback((newVolume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, newVolume));
        setVolumeState(clampedVolume);

        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = clampedVolume;
        }
    }, []);

    // 오디오 재생
    const playAudio = useCallback(async (audioData: ArrayBuffer): Promise<void> => {
        try {
            const audioContext = getAudioContext();

            // MP3 디코딩
            const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));

            // 이전 재생 중지
            if (sourceNodeRef.current) {
                sourceNodeRef.current.stop();
                sourceNodeRef.current.disconnect();
            }

            // 새 소스 노드 생성
            const sourceNode = audioContext.createBufferSource();
            sourceNode.buffer = audioBuffer;

            if (gainNodeRef.current) {
                sourceNode.connect(gainNodeRef.current);
            } else {
                sourceNode.connect(audioContext.destination);
            }

            sourceNodeRef.current = sourceNode;

            sourceNode.onended = () => {
                setIsPlaying(false);
                sourceNodeRef.current = null;
                onPlayEnd?.();

                // 큐에 다음 오디오가 있으면 재생
                processQueue();
            };

            setIsPlaying(true);
            onPlayStart?.();
            sourceNode.start(0);
        } catch (error) {
            console.error("[AudioPlayback] Failed to play audio:", error);
            setIsPlaying(false);
            onError?.(error instanceof Error ? error : new Error('Audio playback failed'));
        }
    }, [getAudioContext, onPlayStart, onPlayEnd, onError]);

    // 큐 처리
    const processQueue = useCallback(async () => {
        if (isProcessingRef.current || audioQueueRef.current.length === 0) {
            return;
        }

        isProcessingRef.current = true;

        while (audioQueueRef.current.length > 0) {
            const audioData = audioQueueRef.current.shift();
            if (audioData) {
                await playAudio(audioData);
                // 재생이 끝날 때까지 대기 (onended 콜백에서 처리)
                await new Promise<void>(resolve => {
                    const checkPlaying = setInterval(() => {
                        if (!sourceNodeRef.current) {
                            clearInterval(checkPlaying);
                            resolve();
                        }
                    }, 100);
                });
            }
        }

        isProcessingRef.current = false;
    }, [playAudio]);

    // 오디오 큐에 추가
    const queueAudio = useCallback((audioData: ArrayBuffer) => {
        audioQueueRef.current.push(audioData);

        // 재생 중이 아니면 큐 처리 시작
        if (!isPlaying && !isProcessingRef.current) {
            processQueue();
        }
    }, [isPlaying, processQueue]);

    // 오디오 중지
    const stopAudio = useCallback(() => {
        // 큐 클리어
        audioQueueRef.current = [];
        isProcessingRef.current = false;

        if (sourceNodeRef.current) {
            sourceNodeRef.current.stop();
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }

        setIsPlaying(false);
    }, []);

    // 클린업
    useEffect(() => {
        return () => {
            stopAudio();
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [stopAudio]);

    return {
        isPlaying,
        volume,
        setVolume,
        playAudio,
        stopAudio,
        queueAudio,
    };
}
