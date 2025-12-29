'use client';

import {
    GridLayout,
    ParticipantTile,
    useTracks,
    useParticipants,
    TrackRefContext,
    ControlBar,
    RoomName,
    ConnectionState,
    useConnectionState,
    CarouselLayout,
    FocusLayout,
    FocusLayoutContainer,
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { useMemo } from 'react';

export default function CustomVideoConference({ customRoomName }: { customRoomName?: string }) {
    const connectionState = useConnectionState();
    const participants = useParticipants();

    // 鍮꾨뵒???먮뒗 ?ㅻ뵒???몃옓???덈뒗 李멸??먮쭔 ?꾪꽣留?
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        {
            onlySubscribed: false,
        }
    );

    // ?ㅼ젣濡??몃옓??publish??李멸??먮쭔 ?꾪꽣留?
    const activeTracks = useMemo(() => {
        return tracks.filter((trackRef) => {
            // ?몃옓???덇굅?? participant媛€ 移대찓??留덉씠?щ? publish 以묒씤 寃쎌슦留??쒖떆
            const participant = trackRef.participant;
            const hasPublishedTrack =
                participant.videoTrackPublications.size > 0 ||
                participant.audioTrackPublications.size > 0;

            return hasPublishedTrack;
        });
    }, [tracks]);



    // 연결 중일 때
    // 연결 중일 때
    if (connectionState === 'connecting') {
        return (
            <div className="h-full flex items-center justify-center bg-stone-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-stone-600 text-lg">연결 중... (Connecting)</p>
                </div>
            </div>
        );
    }

    // 활성 참가자가 없을 때
    if (activeTracks.length === 0) {
        return (
            <div className="h-full flex flex-col bg-stone-50">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 bg-white/50 backdrop-blur-sm border-b border-black/5">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-sm" />
                        <span className="text-stone-900 font-bold">
                            {customRoomName || <RoomName />}
                        </span>
                    </div>
                    <span className="text-stone-500 text-sm font-medium bg-white px-2 py-1 rounded-md border border-black/5 shadow-sm">
                        {participants.length}명 참가 중
                    </span>
                </div>

                {/* 대기 화면 */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-black/5 shadow-sm">
                            <svg className="w-12 h-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-stone-900 text-lg font-medium">카메라/마이크를 켜주세요</p>
                        <p className="text-stone-500 text-sm mt-2">다른 참가자가 권한을 설정 중일 수 있습니다</p>
                    </div>
                </div>

                {/* 컨트롤 바 */}
                <div className="p-4">
                    <ControlBar variation="minimal" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-stone-100 overflow-hidden">
            {/* 헤더 - 고정 높이 */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-black/5 z-10 shadow-sm transition-all hover:bg-white">
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse ring-4 ring-green-500/20" />
                    <span className="text-stone-900 font-bold tracking-tight">
                        {customRoomName || <RoomName />}
                    </span>
                </div>
                <span className="text-stone-500 text-xs font-semibold bg-stone-100 px-2.5 py-1 rounded-full border border-black/5">
                    {activeTracks.length}명 화면 공유 중
                </span>
            </div>

            {/* 비디오 그리드 - 여백 채우기 */}
            <div className="flex-1 min-h-0 p-4 overflow-hidden">
                <GridLayout
                    tracks={activeTracks}
                    style={{ height: '100%', width: '100%' }}
                >
                    <ParticipantTile />
                </GridLayout>
            </div>

            {/* 컨트롤 바 - 고정 높이, 항상 하단에 표시 */}
            <div className="flex-shrink-0 p-4 bg-white/80 backdrop-blur-md border-t border-black/5 z-10">
                <ControlBar variation="minimal" />
            </div>
        </div>
    );
}

