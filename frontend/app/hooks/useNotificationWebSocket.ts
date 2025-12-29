"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Notification } from "../lib/api";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

interface NotificationWSMessage {
    type: "notification" | "ping" | "pong" | "error";
    payload?: Notification;
    message?: string;
}

interface UseNotificationWebSocketOptions {
    onNotification?: (notification: Notification) => void;
    enabled?: boolean;
}

export function useNotificationWebSocket({
    onNotification,
    enabled = true,
}: UseNotificationWebSocketOptions = {}) {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const connect = useCallback(() => {
        if (!enabled) return;

        // 이미 연결중이거나 연결된 상태면 무시
        if (wsRef.current?.readyState === WebSocket.CONNECTING ||
            wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        const ws = new WebSocket(`${WS_BASE_URL}/ws/notifications`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Notification WebSocket connected");
            setIsConnected(true);

            // 30초마다 ping 전송 (연결 유지)
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 30000);
        };

        ws.onmessage = (event) => {
            try {
                const data: NotificationWSMessage = JSON.parse(event.data);

                if (data.type === "notification" && data.payload && onNotification) {
                    onNotification(data.payload);
                }
            } catch (e) {
                console.error("Failed to parse notification WebSocket message:", e);
            }
        };

        ws.onclose = () => {
            console.log("Notification WebSocket disconnected");
            setIsConnected(false);

            // ping interval 정리
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }

            // 재연결 시도 (5초 후)
            if (enabled) {
                reconnectTimeoutRef.current = setTimeout(connect, 5000);
            }
        };

        ws.onerror = (error) => {
            console.error("Notification WebSocket error:", error);
        };
    }, [enabled, onNotification]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setIsConnected(false);
    }, []);

    useEffect(() => {
        if (enabled) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [enabled, connect, disconnect]);

    return { isConnected, reconnect: connect };
}
