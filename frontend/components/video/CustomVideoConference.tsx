'use client';

import {
    GridLayout,
    ParticipantTile,
    useTracks,
    useParticipants,
    useLocalParticipant,
    useConnectionState,
    TrackToggle,
    DisconnectButton,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useMemo } from 'react';

interface CustomVideoConferenceProps {
    customRoomName?: string;
    isChatOpen?: boolean;
    isWhiteboardOpen?: boolean;
    unreadCount?: number;
    onToggleChat?: () => void;
    onToggleWhiteboard?: () => void;
    onLeave?: () => void;
}

export default function CustomVideoConference({
    customRoomName,
    isChatOpen = false,
    unreadCount = 0,
    onToggleChat,
    onToggleWhiteboard,
    onLeave,
}: CustomVideoConferenceProps) {
    const connectionState = useConnectionState();
    const participants = useParticipants();
    const { localParticipant } = useLocalParticipant();

    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    const activeTracks = useMemo(() => {
        return tracks.filter((trackRef) => {
            const participant = trackRef.participant;
            return participant.videoTrackPublications.size > 0 || participant.audioTrackPublications.size > 0;
        });
    }, [tracks]);

    // 연결 중
    if (connectionState === 'connecting') {
        return (
            <div className="h-full flex items-center justify-center bg-white">
                <div className="text-center">
                    <div className="w-10 h-10 border-2 border-black/10 border-t-black rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-black/40 text-sm">연결 중...</p>
                </div>
            </div>
        );
    }

    // 활성 참가자 없음
    if (activeTracks.length === 0) {
        return (
            <div className="h-full flex flex-col bg-white">
                {/* 대기 화면 */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-black text-lg font-medium mb-1">{customRoomName || '통화방'}</p>
                        <p className="text-black/40 text-sm">{participants.length}명 대기 중</p>
                    </div>
                </div>

                {/* 컨트롤바 */}
                <ControlBarComponent
                    isChatOpen={isChatOpen}
                    unreadCount={unreadCount}
                    onToggleChat={onToggleChat}
                    onToggleWhiteboard={onToggleWhiteboard}
                    onLeave={onLeave}
                />
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-white">
            {/* 비디오 그리드 */}
            <div className="flex-1 min-h-0 p-4">
                <GridLayout
                    tracks={activeTracks}
                    style={{ height: '100%', width: '100%', gap: '12px' }}
                >
                    <ParticipantTile />
                </GridLayout>
            </div>

            {/* 컨트롤바 */}
            <ControlBarComponent
                isChatOpen={isChatOpen}
                unreadCount={unreadCount}
                onToggleChat={onToggleChat}
                onToggleWhiteboard={onToggleWhiteboard}
                onLeave={onLeave}
            />
        </div>
    );
}

// 통합 컨트롤바 컴포넌트
function ControlBarComponent({
    isChatOpen,
    unreadCount,
    onToggleChat,
    onToggleWhiteboard,
    onLeave,
}: {
    isChatOpen?: boolean;
    unreadCount?: number;
    onToggleChat?: () => void;
    onToggleWhiteboard?: () => void;
    onLeave?: () => void;
}) {
    return (
        <div className="flex-shrink-0 px-6 py-5 border-t border-black/5">
            <div className="flex items-center justify-center gap-2">
                {/* 마이크 */}
                <TrackToggle
                    source={Track.Source.Microphone}
                    className="p-3.5 rounded-xl bg-black/5 hover:bg-black/10 text-black transition-colors data-[lk-muted=true]:bg-black data-[lk-muted=true]:text-white"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </TrackToggle>

                {/* 카메라 */}
                <TrackToggle
                    source={Track.Source.Camera}
                    className="p-3.5 rounded-xl bg-black/5 hover:bg-black/10 text-black transition-colors data-[lk-muted=true]:bg-black data-[lk-muted=true]:text-white"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </TrackToggle>

                {/* 화면 공유 */}
                <TrackToggle
                    source={Track.Source.ScreenShare}
                    className="p-3.5 rounded-xl bg-black/5 hover:bg-black/10 text-black transition-colors data-[lk-enabled=true]:bg-black data-[lk-enabled=true]:text-white"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </TrackToggle>

                <div className="w-px h-8 bg-black/10 mx-2" />

                {/* 채팅 */}
                <button
                    onClick={onToggleChat}
                    className={`relative p-3.5 rounded-xl transition-colors ${
                        isChatOpen ? 'bg-black text-white' : 'bg-black/5 hover:bg-black/10 text-black'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {unreadCount && unreadCount > 0 && !isChatOpen && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* 화이트보드 */}
                <button
                    onClick={onToggleWhiteboard}
                    className="p-3.5 rounded-xl bg-black/5 hover:bg-black/10 text-black transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </button>

                <div className="w-px h-8 bg-black/10 mx-2" />

                {/* 나가기 */}
                <DisconnectButton
                    onClick={onLeave}
                    className="px-5 py-3 rounded-xl border border-black/10 hover:bg-black hover:text-white hover:border-black text-black transition-colors font-medium text-sm flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    나가기
                </DisconnectButton>
            </div>
        </div>
    );
}
