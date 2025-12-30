'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

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

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

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
                // Ignore non-chat messages
            }
        };

        room.on(RoomEvent.DataReceived, handleData);
        return () => {
            room.off(RoomEvent.DataReceived, handleData);
        };
    }, [room, localParticipant?.identity, onNewMessage]);

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
            await localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify(message)),
                { reliable: true }
            );

            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, message }),
            });

            setMessages((prev) => [...prev, { ...message, isOwn: true }]);
            setInput('');
        } catch (e) {
            console.error('Failed to send message:', e);
        }
    }, [input, room, localParticipant, roomId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="h-full flex flex-col bg-white border-l border-black/5">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-black/5">
                <span className="text-black font-medium">채팅</span>
                <button
                    onClick={onClose}
                    className="p-2 text-black/40 hover:text-black hover:bg-black/5 rounded-lg transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-6 h-6 border-2 border-black/10 border-t-black rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-black/30 text-sm">메시지가 없습니다</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}
                        >
                            {!msg.isOwn && (
                                <span className="text-xs text-black/40 mb-1 ml-1">{msg.sender}</span>
                            )}
                            <div
                                className={`max-w-[85%] px-4 py-2.5 ${
                                    msg.isOwn
                                        ? 'bg-black text-white rounded-2xl rounded-br-md'
                                        : 'bg-black/5 text-black rounded-2xl rounded-bl-md'
                                }`}
                            >
                                <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                            </div>
                            <span className="text-[10px] text-black/30 mt-1 mx-1">
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 border-t border-black/5">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지 입력..."
                        className="flex-1 px-4 py-3 bg-black/5 border-0 rounded-xl text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/10 text-sm"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim()}
                        className="p-3 bg-black hover:bg-black/80 disabled:bg-black/10 disabled:text-black/20 text-white rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
