"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient, Meeting } from "../../../lib/api";
import VideoCallFeature from "./VideoCallFeature";

interface CallsSectionProps {
  workspaceId: number;
  channelId?: string;
}

export default function CallsSection({ workspaceId, channelId }: CallsSectionProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const loadMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getWorkspaceMeetings(workspaceId);
      setMeetings(response.meetings);

      // channelId가 있으면 해당 미팅 선택
      if (channelId && channelId.startsWith("call-")) {
        const meetingId = parseInt(channelId.replace("call-", ""));
        const meeting = response.meetings.find((m) => m.id === meetingId);
        if (meeting) setSelectedMeeting(meeting);
      } else if (selectedMeeting) {
        // 현재 선택된 미팅이 존재하면, 최신 정보로 업데이트 하되 종료된 경우 해제
        const updated = response.meetings.find(m => m.id === selectedMeeting.id);
        if (!updated || updated.status === "ENDED") {
          setSelectedMeeting(null);
        } else {
          setSelectedMeeting(updated);
        }
      }
    } catch (error) {
      console.error("Failed to load meetings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, channelId, selectedMeeting?.id]); // selectedMeeting.id 의존성 추가

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim() || isCreating) return;

    try {
      setIsCreating(true);
      const meeting = await apiClient.createMeeting(workspaceId, {
        title: newMeetingTitle.trim(),
        type: category || "VIDEO",
      });
      setMeetings((prev) => [meeting, ...prev]);
      setNewMeetingTitle("");
      setShowCreateModal(false);
      setSelectedMeeting(meeting);
    } catch (error) {
      console.error("Failed to create meeting:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartMeeting = async (meeting: Meeting) => {
    try {
      const updated = await apiClient.startMeeting(workspaceId, meeting.id);
      setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSelectedMeeting(updated);
    } catch (error) {
      console.error("Failed to start meeting:", error);
    }
  };

  const handleEndMeeting = async (meeting: Meeting) => {
    try {
      await apiClient.endMeeting(workspaceId, meeting.id);
      setSelectedMeeting(null);
      await loadMeetings();
    } catch (error) {
      console.error("Failed to end meeting:", error);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "SCHEDULED": return "예정됨";
      case "IN_PROGRESS": return "진행 중";
      case "ENDED": return "종료됨";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SCHEDULED": return "bg-blue-500";
      case "IN_PROGRESS": return "bg-green-500";
      case "ENDED": return "bg-gray-400";
      default: return "bg-gray-400";
    }
  };

  // Filtering logic
  const category = channelId?.replace("call-", "").toUpperCase(); // GENERAL, STANDUP, etc.

  const filteredMeetings = meetings.filter((m) => {
    // 1. 종료된 방은 숨김
    if (m.status === "ENDED") return false;

    // 2. 현재 섹션에 맞는 방만 표시
    if (category === "GENERAL") {
      // 일반 통화 섹션에서는 'GENERAL' 타입이나 기본 'VIDEO' 타입을 표시
      return m.type === "GENERAL" || m.type === "VIDEO" || !m.type;
    }
    return m.type === category;
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-black/10 border-t-black/40 rounded-full animate-spin" />
      </div>
    );
  }

  if (isJoining && selectedMeeting) {
    return (
      <div className="h-full bg-white relative">
        <VideoCallFeature
          roomId={`meeting-${selectedMeeting.id}`}
          roomTitle={selectedMeeting.title}
          onLeave={() => {
            setIsJoining(false);
            loadMeetings();
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Meeting List */}
      <div className="w-80 border-r border-black/5 flex flex-col">
        <div className="px-6 py-5 border-b border-black/5">
          <h1 className="text-xl font-semibold text-black">
            {category === "GENERAL" ? "일반 통화" :
              category === "STANDUP" ? "스탠드업 미팅" :
                category === "BRAINSTORM" ? "브레인스토밍" : "통화방"}
          </h1>
          <p className="text-sm text-black/40 mt-0.5">{filteredMeetings.length}개의 활성 통화방</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredMeetings.map((meeting) => (
              <button
                key={meeting.id}
                onClick={() => setSelectedMeeting(meeting)}
                className={`w-full p-4 rounded-xl text-left transition-all group ${selectedMeeting?.id === meeting.id
                  ? "bg-stone-900 text-white shadow-lg shadow-black/10"
                  : "bg-white border border-stone-100 hover:border-stone-200 hover:bg-stone-50"
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className={`p-2 rounded-lg ${selectedMeeting?.id === meeting.id ? "bg-white/10" : "bg-stone-100 group-hover:bg-stone-200"
                      }`}>
                      <svg
                        className={`w-4 h-4 ${selectedMeeting?.id === meeting.id ? "text-white" : "text-stone-500"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <span className={`font-semibold text-sm truncate ${selectedMeeting?.id === meeting.id ? "text-white" : "text-black"
                      }`}>{meeting.title}</span>
                  </div>
                  {meeting.status === "IN_PROGRESS" && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedMeeting?.id === meeting.id
                    ? "bg-white/20 text-white/90"
                    : "bg-stone-100 text-stone-500"
                    }`}>
                    {getStatusLabel(meeting.status).toUpperCase()}
                  </span>
                  {meeting.participants && meeting.participants.length > 0 && (
                    <span className={`text-[11px] ${selectedMeeting?.id === meeting.id ? "text-white/60" : "text-stone-400"
                      }`}>
                      {meeting.participants.length}명 참여 중
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Create New Room Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full mt-4 p-5 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-600 transition-all flex items-center justify-center gap-2 group"
          >
            <svg
              className="w-5 h-5 transition-transform group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-semibold text-stone-600">새 통화방 만들기</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedMeeting ? (
          <>
            {/* Room Header */}
            <div className="px-8 py-5 border-b border-black/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-black">{selectedMeeting.title}</h2>
                <p className="text-sm text-black/40">
                  호스트: {selectedMeeting.host?.nickname || "알 수 없음"} · 코드: {selectedMeeting.code}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedMeeting.status === "SCHEDULED" && (
                  <button
                    onClick={() => handleStartMeeting(selectedMeeting)}
                    className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    시작하기
                  </button>
                )}
                {selectedMeeting.status === "IN_PROGRESS" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsJoining(true)}
                      className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-black/80 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      참가하기
                    </button>
                    <button
                      onClick={() => handleEndMeeting(selectedMeeting)}
                      className="px-4 py-2 border border-red-200 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                    >
                      종료하기
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Participants Grid */}
            <div className="flex-1 p-8 overflow-y-auto">
              {selectedMeeting.participants && selectedMeeting.participants.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedMeeting.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="aspect-video rounded-2xl p-6 flex flex-col items-center justify-center bg-black/[0.03]"
                    >
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-medium bg-black/10 text-black/50">
                        {participant.user?.profile_img ? (
                          <img
                            src={participant.user.profile_img}
                            alt={participant.user.nickname}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          participant.user?.nickname?.charAt(0) || "?"
                        )}
                      </div>
                      <p className="mt-3 font-medium text-black">
                        {participant.user?.nickname || "알 수 없음"}
                      </p>
                      <span className="text-xs text-black/40 mt-1">
                        {participant.role === "HOST" ? "호스트" : "참가자"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-black/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-black/60 mb-1">
                    아직 참가자가 없습니다
                  </h3>
                  <p className="text-sm text-black/40 mb-6">
                    미팅을 시작하여 참가자를 초대하세요
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-white">
            <div className="w-32 h-32 rounded-full bg-stone-100 flex items-center justify-center mb-8">
              <svg className="w-14 h-14 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-stone-800 mb-3">
              통화방을 선택하세요
            </h3>
            <p className="text-stone-400 max-w-sm leading-relaxed">
              왼쪽에서 통화방을 선택하거나 새로운 통화방을 만들어 팀원들과 소통하세요
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-black mb-4">새 통화방 만들기</h2>
            <input
              type="text"
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
              placeholder="통화방 이름"
              className="w-full px-4 py-3 border border-black/10 rounded-lg mb-4 text-black focus:outline-none focus:ring-2 focus:ring-black/10"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 text-black/60 hover:text-black transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={!newMeetingTitle.trim() || isCreating}
                className="flex-1 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50"
              >
                {isCreating ? "생성 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
