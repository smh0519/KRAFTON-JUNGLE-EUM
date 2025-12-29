'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { RoomEvent, DataPacket_Kind } from 'livekit-client';

interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
    isOwn: boolean;
}

interface ChatPanelProps {
    roomId: string;
    onClose: () => void;
    onNewMessage?: () => void;
}

export default function ChatPanel({ roomId, onClose, onNewMessage }: ChatPanelProps) {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Load existing messages from Redis on mount
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const res = await fetch(`/api/chat?roomId=${encodeURIComponent(roomId)}`);
                if (res.ok) {
                    const data = await res.json();
                    const loadedMessages = data.messages.map((msg: any) => ({
                        ...msg,
                        isOwn: msg.sender === (localParticipant?.name || localParticipant?.identity),
                    }));
                    setMessages(loadedMessages);
                }
            } catch (e) {
                console.error('Failed to load messages:', e);
            } finally {
                setIsLoading(false);
            }
        };

        if (roomId && localParticipant) {
            loadMessages();
        }
    }, [roomId, localParticipant]);

    // Listen for incoming messages
    useEffect(() => {
        if (!room) return;

        const handleData = (payload: Uint8Array, participant: any) => {
            try {
                const data = JSON.parse(new TextDecoder().decode(payload));
                if (data.type === 'chat') {
                    const newMessage: ChatMessage = {
                        id: data.id,
                        sender: data.sender,
                        content: data.content,
                        timestamp: data.timestamp,
                        isOwn: participant?.identity === localParticipant?.identity,
                    };
                    setMessages((prev) => [...prev, newMessage]);
                    onNewMessage?.();
                }
            } catch (e) {
                // Ignore non-chat messages (e.g., whiteboard data)
            }
        };

        room.on(RoomEvent.DataReceived, handleData);
        return () => {
            room.off(RoomEvent.DataReceived, handleData);
        };
    }, [room, localParticipant?.identity, onNewMessage]);

    // Send message
    const sendMessage = useCallback(async () => {
        if (!input.trim() || !room || !localParticipant) return;

        const message = {
            type: 'chat',
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sender: localParticipant.name || localParticipant.identity,
            content: input.trim(),
            timestamp: Date.now(),
        };

        try {
            // Publish via LiveKit for real-time
            await localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify(message)),
                { reliable: true }
            );

            // Save to Redis for persistence
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, message }),
            });

            // Add own message to list
            setMessages((prev) => [...prev, { ...message, isOwn: true }]);
            setInput('');
        } catch (e) {
            console.error('Failed to send message:', e);
        }
    }, [input, room, localParticipant, roomId]);

    // Handle Enter key
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Format timestamp
    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="h-full flex flex-col bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-black/5 shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white/50 border-b border-black/5">
                <div className="flex items-center gap-2">
                    <span className="text-xl">💬</span>
                    <span className="text-stone-900 font-bold">채팅</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-stone-400 hover:text-stone-900 transition-colors p-1"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-stone-400 text-sm">
                        메시지가 없습니다
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}
                        >
                            {!msg.isOwn && (
                                <span className="text-xs text-stone-500 mb-1">{msg.sender}</span>
                            )}
                            <div
                                className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${msg.isOwn
                                    ? 'bg-black text-white rounded-br-md'
                                    : 'bg-white border border-stone-200 text-stone-900 rounded-bl-md'
                                    }`}
                            >
                                <p className="text-sm break-words">{msg.content}</p>
                            </div>
                            <span className="text-xs text-stone-400 mt-1">
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-3 border-t border-black/5 bg-white/50">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지 입력..."
                        className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black/20 text-sm transition-all"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim()}
                        className="px-4 py-2 bg-black hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

