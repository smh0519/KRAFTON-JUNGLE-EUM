"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient, Meeting } from "../../../lib/api";

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
      }
    } catch (error) {
      console.error("Failed to load meetings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, channelId]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim() || isCreating) return;

    try {
      setIsCreating(true);
      const meeting = await apiClient.createMeeting(workspaceId, {
        title: newMeetingTitle.trim(),
        type: "VIDEO",
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Meeting List */}
      <div className="w-80 border-r border-black/5 flex flex-col">
        <div className="px-6 py-5 border-b border-black/5">
          <h1 className="text-xl font-semibold text-black">통화방</h1>
          <p className="text-sm text-black/40 mt-0.5">{meetings.length}개의 통화방</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {meetings.map((meeting) => (
              <button
                key={meeting.id}
                onClick={() => setSelectedMeeting(meeting)}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  selectedMeeting?.id === meeting.id
                    ? "bg-black text-white"
                    : "bg-black/[0.02] hover:bg-black/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-5 h-5 ${
                        selectedMeeting?.id === meeting.id ? "text-white/70" : "text-black/40"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                    <span className="font-medium truncate">{meeting.title}</span>
                  </div>
                  {meeting.status === "IN_PROGRESS" && (
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    selectedMeeting?.id === meeting.id
                      ? "bg-white/20 text-white/80"
                      : `${getStatusColor(meeting.status)} text-white`
                  }`}>
                    {getStatusLabel(meeting.status)}
                  </span>
                  {meeting.participants && meeting.participants.length > 0 && (
                    <span className={`text-xs ${
                      selectedMeeting?.id === meeting.id ? "text-white/60" : "text-black/40"
                    }`}>
                      {meeting.participants.length}명 참여
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Create New Room */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full mt-4 p-4 border-2 border-dashed border-black/10 rounded-xl text-black/40 hover:border-black/20 hover:text-black/60 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">새 통화방 만들기</span>
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
                  <button
                    onClick={() => handleEndMeeting(selectedMeeting)}
                    className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                  >
                    종료하기
                  </button>
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
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-24 h-24 rounded-full bg-black/5 flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-black/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-black/60 mb-2">
              통화방을 선택하세요
            </h3>
            <p className="text-sm text-black/40 max-w-sm">
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
              className="w-full px-4 py-3 border border-black/10 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-black/10"
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
