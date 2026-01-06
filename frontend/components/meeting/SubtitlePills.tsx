'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Languages } from 'lucide-react';

interface Speaker {
    name: string;
    profileImg?: string;
    isLocal?: boolean;
}

interface SubtitleEntry {
    id: string;
    speaker: Speaker;
    text: string;
    originalText?: string;
    timestamp: number;
    displayText: string;
    isTyping: boolean;
    isExiting: boolean;
}

interface SubtitlePillsProps {
    text: string | null;
    originalText?: string | null;
    speaker?: Speaker;
    isActive?: boolean;
    showTranslation?: boolean;
}

// Global store for multiple speakers
const subtitleStore = {
    entries: new Map<string, SubtitleEntry>(),
    listeners: new Set<() => void>(),

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    },

    notify() {
        this.listeners.forEach(l => l());
    },

    addOrUpdate(speaker: Speaker, text: string, originalText?: string) {
        const id = speaker.name || 'unknown';
        const existing = this.entries.get(id);

        if (existing && existing.text === text) {
            return;
        }

        const entry: SubtitleEntry = {
            id,
            speaker,
            text,
            originalText,
            timestamp: Date.now(),
            displayText: '',
            isTyping: true,
            isExiting: false,
        };

        this.entries.set(id, entry);
        this.notify();
    },

    remove(id: string) {
        const entry = this.entries.get(id);
        if (entry) {
            entry.isExiting = true;
            this.notify();
            setTimeout(() => {
                this.entries.delete(id);
                this.notify();
            }, 300);
        }
    },

    getAll(): SubtitleEntry[] {
        return Array.from(this.entries.values())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-3);
    },
};

// Individual subtitle pill component with Notion styling
function SubtitlePill({
    entry,
    showTranslation,
    onComplete,
}: {
    entry: SubtitleEntry;
    showTranslation: boolean;
    onComplete: () => void;
}) {
    const [displayText, setDisplayText] = useState(entry.text);
    const [isTyping, setIsTyping] = useState(false);
    const exitRef = useRef<NodeJS.Timeout | null>(null);
    const animationRef = useRef<number | null>(null);
    const targetTextRef = useRef(entry.text);
    const currentIndexRef = useRef(0);

    useEffect(() => {
        const newText = entry.text;
        const prevDisplayed = displayText;
        targetTextRef.current = newText;

        if (exitRef.current) clearTimeout(exitRef.current);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);

        if (newText.startsWith(prevDisplayed) && prevDisplayed.length > 0) {
            currentIndexRef.current = prevDisplayed.length;
        } else {
            currentIndexRef.current = 0;
            setDisplayText('');
        }

        setIsTyping(true);

        let lastTime = 0;
        const CHARS_PER_FRAME = 2;
        const MIN_INTERVAL = 16;

        const animate = (timestamp: number) => {
            if (timestamp - lastTime >= MIN_INTERVAL) {
                lastTime = timestamp;
                const target = targetTextRef.current;

                if (currentIndexRef.current < target.length) {
                    currentIndexRef.current = Math.min(
                        currentIndexRef.current + CHARS_PER_FRAME,
                        target.length
                    );
                    setDisplayText(target.slice(0, currentIndexRef.current));
                    animationRef.current = requestAnimationFrame(animate);
                } else {
                    setIsTyping(false);
                }
            } else {
                animationRef.current = requestAnimationFrame(animate);
            }
        };

        animationRef.current = requestAnimationFrame(animate);
        exitRef.current = setTimeout(onComplete, 3000);

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (exitRef.current) clearTimeout(exitRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entry.text, onComplete]);

    return (
        <div
            className={`
                flex items-center gap-3 px-4 py-3
                bg-black/75 backdrop-blur-md
                rounded-2xl
                shadow-lg shadow-black/10
                border border-white/[0.08]
                transition-all duration-300 ease-out
                ${entry.isExiting
                    ? 'opacity-0 translate-y-2 scale-95'
                    : 'opacity-100 translate-y-0 scale-100'
                }
            `}
            style={{
                animation: entry.isExiting ? undefined : 'pill-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
        >
            {/* Profile Image */}
            <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center ring-1 ring-white/10">
                    {entry.speaker.profileImg ? (
                        <Image
                            src={entry.speaker.profileImg}
                            alt={entry.speaker.name}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-white/70 text-sm font-medium">
                            {entry.speaker.name.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
            </div>

            {/* Name + Text */}
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-white/50 text-sm font-medium flex-shrink-0">
                    {entry.speaker.name}
                </span>
                
                {showTranslation && entry.originalText && entry.originalText !== entry.text ? (
                    <div className="flex items-center gap-2">
                        <span className="text-white/30 text-xs truncate max-w-[100px]">
                            {entry.originalText}
                        </span>
                        <Languages size={12} className="text-white/30 flex-shrink-0" />
                        <span className="text-white text-sm font-medium">
                            {displayText}
                            {isTyping && <span className="ml-0.5 text-white/50 animate-pulse">|</span>}
                        </span>
                    </div>
                ) : (
                    <span className="text-white text-sm font-medium">
                        {displayText}
                        {isTyping && <span className="ml-0.5 text-white/50 animate-pulse">|</span>}
                    </span>
                )}
            </div>
        </div>
    );
}

export default function SubtitlePills({
    text,
    originalText,
    speaker,
    showTranslation = false,
}: SubtitlePillsProps) {
    const [entries, setEntries] = useState<SubtitleEntry[]>([]);
    const processedRef = useRef<Map<string, string>>(new Map());

    // Subscribe to store and cleanup on unmount
    useEffect(() => {
        const unsubscribe = subtitleStore.subscribe(() => {
            setEntries(subtitleStore.getAll());
        });
        return () => { 
            unsubscribe(); 
            // Clear all entries when component unmounts (leaving room)
            const allIds = Array.from(subtitleStore.entries.keys());
            allIds.forEach(id => {
                subtitleStore.entries.delete(id);
            });
        };
    }, []);

    // Add new subtitle
    useEffect(() => {
        if (text && speaker) {
            const key = `${speaker.name}-${text}`;
            if (!processedRef.current.has(key)) {
                processedRef.current.set(key, text);
                subtitleStore.addOrUpdate(speaker, text, originalText || undefined);

                setTimeout(() => {
                    processedRef.current.delete(key);
                }, 5000);
            }
        }
    }, [text, originalText, speaker]);

    const handleComplete = useCallback((id: string) => {
        subtitleStore.remove(id);
    }, []);

    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
                {entries.map((entry) => (
                    <SubtitlePill
                        key={`${entry.id}-${entry.timestamp}`}
                        entry={entry}
                        showTranslation={showTranslation}
                        onComplete={() => handleComplete(entry.id)}
                    />
                ))}
            </div>

            <style jsx global>{`
                @keyframes pill-enter {
                    0% {
                        opacity: 0;
                        transform: translateY(10px) scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}
