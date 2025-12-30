'use client';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);

  const currentCategory = channelId?.replace("call-", "").toUpperCase() || "GENERAL";

  const categoryTitle = {
    GENERAL: "일반 통화",
    STANDUP: "스탠드업",
    BRAINSTORMING: "브레인스토밍",
  }[currentCategory] || "통화";

  const loadMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getWorkspaceMeetings(workspaceId);
      const filteredMeetings = response.meetings.filter(meeting => {
        const type = meeting.type || "GENERAL";
        const normalizedType = type === "VIDEO" ? "GENERAL" : type;
        return normalizedType === currentCategory;
      });
      setMeetings(filteredMeetings);
    } catch (error) {
      console.error("Failed to load meetings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, currentCategory]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings, currentCategory]);

  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim() || isCreating) return;
    try {
      setIsCreating(true);
      const meeting = await apiClient.createMeeting(workspaceId, {
        title: newMeetingTitle.trim(),
        type: currentCategory,
      });
      setMeetings((prev) => [meeting, ...prev]);
      setNewMeetingTitle("");
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to create meeting:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartAndJoin = async (meeting: Meeting) => {
    try {
      if (meeting.status === "SCHEDULED") {
        const updated = await apiClient.startMeeting(workspaceId, meeting.id);
        setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setActiveMeeting(updated);
      } else {
        setActiveMeeting(meeting);
      }
    } catch (error) {
      console.error("Failed to start meeting:", error);
    }
  };

  const handleEndMeeting = async (e: React.MouseEvent, meeting: Meeting) => {
    e.stopPropagation();
    try {
      await apiClient.endMeeting(workspaceId, meeting.id);
      await loadMeetings();
    } catch (error) {
      console.error("Failed to end meeting:", error);
    }
  };

  // 통화 중인 상태
  if (activeMeeting) {
    return (
      <div className="h-full bg-white">
        <VideoCallFeature
          roomId={`meeting-${activeMeeting.id}`}
          roomTitle={activeMeeting.title}
          onLeave={() => {
            setActiveMeeting(null);
            loadMeetings();
          }}
        />
      </div>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full bg-white overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-black/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-black">{categoryTitle}</h1>
            <p className="text-sm text-black/40 mt-0.5">{meetings.length}개의 통화방</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-black/80 transition-colors"
          >
            새 통화방
          </button>
        </div>
      </div>

      {/* Card Grid */}
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Meeting Cards */}
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              onClick={() => meeting.status !== "ENDED" && handleStartAndJoin(meeting)}
              className={`group relative border rounded-xl transition-all overflow-hidden ${
                meeting.status === "ENDED"
                  ? "border-black/5 bg-black/[0.02] cursor-not-allowed opacity-50"
                  : "border-black/10 bg-white hover:border-black/20 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] cursor-pointer"
              }`}
            >
              {/* Card Content */}
              <div className="p-5">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    meeting.status === "IN_PROGRESS" ? "bg-black" : "bg-black/5"
                  }`}>
                    <svg
                      className={`w-5 h-5 ${meeting.status === "IN_PROGRESS" ? "text-white" : "text-black/40"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  {meeting.status === "IN_PROGRESS" && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                      <span className="text-xs font-medium text-black">LIVE</span>
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-medium text-black truncate mb-1">{meeting.title}</h3>

                {/* Meta */}
                <div className="flex items-center gap-2 text-sm text-black/40">
                  <span>{meeting.host?.nickname || "호스트 없음"}</span>
                  {meeting.participants && meeting.participants.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{meeting.participants.length}명</span>
                    </>
                  )}
                </div>

                {/* Status */}
                <div className="mt-4 pt-4 border-t border-black/5">
                  <span className={`text-xs font-medium ${
                    meeting.status === "IN_PROGRESS"
                      ? "text-black"
                      : meeting.status === "SCHEDULED"
                      ? "text-black/60"
                      : "text-black/30"
                  }`}>
                    {meeting.status === "IN_PROGRESS" ? "진행 중" : meeting.status === "SCHEDULED" ? "대기 중" : "종료됨"}
                  </span>
                </div>
              </div>

              {/* Hover Action */}
              {meeting.status !== "ENDED" && (
                <div className="absolute inset-0 bg-white/95 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3">
                  <button className="px-5 py-2.5 bg-black text-white rounded-lg font-medium text-sm hover:bg-black/80 transition-colors">
                    {meeting.status === "IN_PROGRESS" ? "참여하기" : "시작하기"}
                  </button>
                  {meeting.status === "IN_PROGRESS" && (
                    <button
                      onClick={(e) => handleEndMeeting(e, meeting)}
                      className="px-4 py-2.5 border border-black/20 text-black rounded-lg font-medium text-sm hover:bg-black/5 transition-colors"
                    >
                      종료
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {meetings.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-black/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-black/40 text-sm mb-4">아직 통화방이 없습니다</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-sm font-medium text-black hover:underline"
            >
              첫 통화방 만들기
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-black mb-6">새 통화방</h2>
            <input
              type="text"
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateMeeting()}
              placeholder="통화방 이름"
              className="w-full px-4 py-3 border border-black/10 rounded-lg mb-6 focus:outline-none focus:border-black/30 text-black placeholder-black/30"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 border border-black/10 text-black rounded-lg hover:bg-black/5 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={!newMeetingTitle.trim() || isCreating}
                className="flex-1 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors disabled:opacity-30 font-medium"
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
