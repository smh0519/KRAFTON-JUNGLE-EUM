'use client';

import { useMemo } from 'react';
import { Track } from 'livekit-client';
import {
  useParticipants,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react';
import { Users, UserPlus } from 'lucide-react';
import ParticipantVideoTile from './ParticipantVideoTile';

interface VideoSidebarProps {
  currentUser?: {
    nickname: string;
    profileImg?: string;
  };
  onInvite?: () => void;
}

export default function VideoSidebar({ currentUser, onInvite }: VideoSidebarProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  
  // Get all camera tracks
  const cameraTracks = useTracks([Track.Source.Camera]);
  const audioTracks = useTracks([Track.Source.Microphone]);

  // Create a map of participant to their tracks
  const participantTracks = useMemo(() => {
    const trackMap = new Map<string, { video?: MediaStreamTrack; audio?: MediaStreamTrack }>();
    
    cameraTracks.forEach(track => {
      const participantId = track.participant.identity;
      if (!trackMap.has(participantId)) {
        trackMap.set(participantId, {});
      }
      const entry = trackMap.get(participantId)!;
      entry.video = track.publication?.track?.mediaStreamTrack || undefined;
    });

    audioTracks.forEach(track => {
      const participantId = track.participant.identity;
      if (!trackMap.has(participantId)) {
        trackMap.set(participantId, {});
      }
      const entry = trackMap.get(participantId)!;
      entry.audio = track.publication?.track?.mediaStreamTrack || undefined;
    });

    return trackMap;
  }, [cameraTracks, audioTracks]);

  // Sort participants: local first, then by join time
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return (a.joinedAt?.getTime() || 0) - (b.joinedAt?.getTime() || 0);
    });
  }, [participants]);

  return (
    <div className="h-full bg-white border-l border-black/[0.06] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-black/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-black/40" />
            <span className="text-sm font-medium text-black">참가자</span>
            <span className="text-xs text-black/40 bg-black/[0.04] px-1.5 py-0.5 rounded">
              {participants.length}
            </span>
          </div>
          {onInvite && (
            <button
              onClick={onInvite}
              className="p-1.5 rounded-md text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors"
              title="초대하기"
            >
              <UserPlus size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedParticipants.map(participant => {
          const tracks = participantTracks.get(participant.identity);
          
          return (
            <ParticipantVideoTile
              key={participant.identity}
              participant={participant}
              videoTrack={tracks?.video}
              audioTrack={tracks?.audio}
              isLocal={participant.isLocal}
              currentUser={currentUser}
              size="md"
              aspectRatio="video"
            />
          );
        })}

        {/* Empty state */}
        {participants.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-black/[0.04] flex items-center justify-center mb-3">
              <Users size={20} className="text-black/30" />
            </div>
            <p className="text-sm text-black/40">아직 참가자가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
