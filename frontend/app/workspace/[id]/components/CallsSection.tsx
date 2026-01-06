'use client';

import NotionMeetingWorkspace from "@/components/meeting/NotionMeetingWorkspace";
import { Phone, PhoneOff, Users, Lock } from "lucide-react";

interface CallParticipant {
  id: number;
  nickname: string;
  profileImg?: string;
}

interface ActiveCall {
  channelId: string;
  channelName: string;
  participants: CallParticipant[];
}

interface CallsSectionProps {
  workspaceId: number;
  channelId?: string;
  activeCall?: ActiveCall | null;
  onJoinCall?: (channelId: string, channelName: string) => void;
  onLeaveCall?: () => void;
  // 현재 채널에 있는 다른 참여자들 (나중에 실제 데이터로 교체)
  channelParticipants?: CallParticipant[];
  canConnectMedia?: boolean;
}

// 채널 ID로 이름 가져오기
const getChannelName = (channelId: string): string => {
  const channelNames: Record<string, string> = {
    "call-general": "일반 통화",
    "call-standup": "스탠드업 미팅",
    "call-brainstorm": "브레인스토밍",
  };
  return channelNames[channelId] || channelId.replace("call-", "");
};

export default function CallsSection({
  workspaceId,
  channelId,
  activeCall,
  onJoinCall,
  onLeaveCall,
  channelParticipants = [],
  canConnectMedia = true,
}: CallsSectionProps) {
  const channelName = channelId ? getChannelName(channelId) : "통화";
  const hasParticipants = channelParticipants.length > 0;

  // 통화에 연결된 경우 → Notion 스타일 통화 화면 표시
  if (activeCall && activeCall.channelId === channelId) {
    return (
      <div className="h-full bg-white">
        <NotionMeetingWorkspace
          roomId={`workspace-${workspaceId}-${channelId}`}
          roomTitle={activeCall.channelName}
          onLeave={() => {
            onLeaveCall?.();
          }}
        />
      </div>
    );
  }

  // 통화에 연결되지 않은 경우 → Notion 스타일 대기 화면
  return (
    <div className="h-full bg-white flex flex-col items-center justify-center">
      {/* 아이콘 */}
      <div className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center mb-6">
        <Phone className="w-10 h-10 text-black/20" />
      </div>

      {/* 채널 이름 */}
      <h2 className="text-xl font-semibold text-black mb-2">{channelName}</h2>
      <p className="text-sm text-black/40 mb-6">음성 회의에 참여하세요</p>

      {/* 참여자 목록 또는 빈 상태 */}
      {hasParticipants ? (
        <div className="mb-8">
          {/* 참여자 아바타들 */}
          <div className="flex items-center justify-center -space-x-2 mb-3">
            {channelParticipants.slice(0, 5).map((participant) => (
              participant.profileImg ? (
                <img
                  key={participant.id}
                  src={participant.profileImg}
                  alt={participant.nickname}
                  className="w-10 h-10 rounded-full border-2 border-white object-cover"
                />
              ) : (
                <div
                  key={participant.id}
                  className="w-10 h-10 rounded-full border-2 border-white bg-black/10 flex items-center justify-center"
                >
                  <span className="text-sm font-medium text-black/60">
                    {participant.nickname.charAt(0).toUpperCase()}
                  </span>
                </div>
              )
            ))}
            {channelParticipants.length > 5 && (
              <div className="w-10 h-10 rounded-full border-2 border-white bg-black/5 flex items-center justify-center">
                <span className="text-xs font-medium text-black/50">
                  +{channelParticipants.length - 5}
                </span>
              </div>
            )}
          </div>
          {/* 참여자 이름들 */}
          <div className="flex items-center justify-center gap-1 text-black/40 text-sm">
            <Users size={14} />
            <span>
              {channelParticipants.slice(0, 3).map(p => p.nickname).join(", ")}
              {channelParticipants.length > 3 && ` 외 ${channelParticipants.length - 3}명`}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-black/30 text-sm mb-8">
          <Users size={16} />
          <span>아직 참여자가 없습니다</span>
        </div>
      )}

      {/* 참여하기 버튼 */}
      {canConnectMedia ? (
        <button
          onClick={() => channelId && onJoinCall?.(channelId, channelName)}
          className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-black/80 text-white font-medium rounded-xl transition-colors"
        >
          <Phone size={18} />
          참여하기
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            disabled
            className="flex items-center gap-2 px-6 py-3 bg-black/10 text-black/30 font-medium rounded-xl cursor-not-allowed"
          >
            <Lock size={18} />
            접근 제한
          </button>
          <p className="text-black/30 text-xs">음성 채널 참여 권한이 없습니다</p>
        </div>
      )}
    </div>
  );
}
