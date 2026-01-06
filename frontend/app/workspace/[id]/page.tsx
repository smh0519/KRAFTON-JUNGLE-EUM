"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { usePresence } from "../../contexts/presence-context";
import { apiClient, Workspace } from "../../lib/api";
import Sidebar from "./components/Sidebar";
import MembersSection from "./components/MembersSection";
import ChatSection from "./components/ChatSection";
import CallsSection from "./components/CallsSection";
import CalendarSection from "./components/CalendarSection";
import StorageSection from "./components/StorageSection";
import NotificationDropdown from "../../components/NotificationDropdown";
import EditProfileModal from "../../../components/EditProfileModal";
import StatusIndicator from "../../../components/StatusIndicator";
import GlobalUserProfileMenu from "../../../components/GlobalUserProfileMenu";
import { useVoiceParticipantsWebSocket, VoiceParticipant } from "../../hooks/useVoiceParticipantsWebSocket";
import { usePermission } from "../../hooks/usePermission";
import { ChevronLeft, Hash, MessageSquare, Users, Calendar, FolderOpen, Phone } from "lucide-react";

export default function WorkspaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const [activeSection, setActiveSection] = useState("members");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentChatRoomTitle, setCurrentChatRoomTitle] = useState("");

  // 통화 상태 (디스코드 스타일)
  interface CallParticipant {
    id: number;
    nickname: string;
    profileImg?: string;
  }
  const [activeCall, setActiveCall] = useState<{
    channelId: string;
    channelName: string;
    participants: CallParticipant[];
  } | null>(null);

  const { presenceMap } = usePresence();
  // 워크스페이스 데이터
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  // 음성 참가자 상태 (채널별)
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, VoiceParticipant[]>>({});

  // 음성 참가자 WebSocket (입장/퇴장 알림용)
  const workspaceId = Number(params.id);
  const { sendJoin, sendLeave } = useVoiceParticipantsWebSocket({
    workspaceId: isNaN(workspaceId) ? 0 : workspaceId,
    enabled: isAuthenticated && !isNaN(workspaceId),
    onParticipantsInit: (participants) => {
      setVoiceParticipants(participants);
    },
    onParticipantJoin: (channelId, participant) => {
      setVoiceParticipants(prev => {
        const current = prev[channelId] || [];
        // 중복 제거
        if (current.some(p => p.identity === participant.identity)) return prev;
        return {
          ...prev,
          [channelId]: [...current, participant]
        };
      });
    },
    onParticipantLeave: (channelId, identity) => {
      setVoiceParticipants(prev => {
        const current = prev[channelId] || [];
        return {
          ...prev,
          [channelId]: current.filter(p => p.identity !== identity)
        };
      });
    }
  });

  // Permissions (Hoisted to avoid conditional hooks)
  const canConnectMedia = usePermission(workspace, "CONNECT_MEDIA");
  const canSendMessages = usePermission(workspace, "SEND_MESSAGES");

  // 통화 입장 핸들러
  const handleJoinCall = useCallback((channelId: string, channelName: string) => {
    setActiveCall({
      channelId,
      channelName,
      participants: user ? [{
        id: user.id,
        nickname: user.nickname,
        profileImg: user.profileImg
      }] : []
    });

    // WebSocket으로 입장 알림
    if (user) {
      const roomName = `workspace - ${workspaceId} -${channelId} `;
      // Identity를 User ID로 전송
      sendJoin(roomName, user.id.toString(), user.nickname, user.profileImg);
    }
  }, [user, workspaceId, sendJoin]);

  // 통화 퇴장 핸들러
  const handleLeaveCall = useCallback(() => {
    if (activeCall && user) {
      const roomName = `workspace - ${workspaceId} -${activeCall.channelId} `;
      sendLeave(roomName, user.id.toString());
    }
    setActiveCall(null);
  }, [activeCall, user, workspaceId, sendLeave]);

  // 로그아웃 핸들러
  const handleLogout = async () => {
    await useAuth().logout();
    router.push("/");
  };

  // 프로필 수정 핸들러
  const handleUpdateProfile = async () => {
    await refreshUser();
    setIsEditProfileModalOpen(false);
  };

  // 워크스페이스 조회
  const fetchWorkspace = useCallback(async () => {
    const workspaceId = Number(params.id);
    if (isNaN(workspaceId)) {
      setError("잘못된 워크스페이스 ID입니다.");
      setIsLoadingWorkspace(false);
      return;
    }

    try {
      setIsLoadingWorkspace(true);
      const data = await apiClient.getWorkspace(workspaceId);
      setWorkspace(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch workspace:", err);
      setError("워크스페이스를 불러올 수 없습니다.");
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, [params.id]);

  useEffect(() => {
    console.log("[WorkspaceDetailPage] Check Auth Effect. isLoading:", isLoading, "isAuthenticated:", isAuthenticated);
    if (!isLoading && !isAuthenticated) {
      console.log("[WorkspaceDetailPage] Redirecting to / because NOT authenticated");
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  // 워크스페이스 로드
  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspace();
    }
  }, [isAuthenticated, fetchWorkspace]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1a1a] gap-4">
        <img
          src="/logo_white.png"
          alt="Loading"
          className="w-12 h-12 animate-pulse opacity-50"
        />
        <p className="text-white/40 text-sm">Workspace Detail Auth Loading...</p>
      </div>
    );
  }

  // 인증되지 않았으면 리다이렉트 대기 (useEffect에서 처리)
  if (!isAuthenticated || !user) {
    return null;
  }

  // 인증은 되었으나 워크스페이스 로딩 중
  if (isLoadingWorkspace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1a1a] gap-4">
        <img
          src="/logo_white.png"
          alt="Loading"
          className="w-12 h-12 animate-pulse opacity-50"
        />
        <p className="text-white/40 text-sm">Workspace Detail Data Loading...</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1a1a] gap-4">
        <p className="text-white/50">{error || "워크스페이스를 찾을 수 없습니다."}</p>
        <button
          onClick={() => router.push("/workspace")}
          className="text-sm text-white/70 hover:text-white underline"
        >
          워크스페이스 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const renderContent = () => {
    // 통화방 채널 처리
    if (activeSection.startsWith("call-")) {
      // const canConnectMedia = usePermission(workspace, "CONNECT_MEDIA"); // Removed (Hoisted)

      // 현재 채널의 참가자 목록 변환 (Identity(string ID) -> ID(number))
      const currentParticipants = (voiceParticipants[activeSection] || []).map(p => ({
        id: parseInt(p.identity, 10) || 0, // Identity가 숫자가 아니면 0 (기존 닉네임 방식 호환성 고려 필요하면 처리)
        nickname: p.name,
        profileImg: p.profileImg,
      }));

      return (
        <CallsSection
          workspaceId={workspace.id}
          channelId={activeSection}
          activeCall={activeCall}
          onJoinCall={handleJoinCall}
          onLeaveCall={handleLeaveCall}
          canConnectMedia={canConnectMedia}
          channelParticipants={currentParticipants}
        />
      );
    }

    // 채팅방 처리
    if (activeSection.startsWith("chat-")) {
      const roomId = parseInt(activeSection.replace("chat-", ""), 10);

      // 채팅방은 멤버 권한 체크가 다를 수 있음 (일단 기본적으로 접근 허용하되, 메시지 전송 권한은 체크)
      return (
        <ChatSection
          workspaceId={workspace.id}
          roomId={roomId}
          onRoomTitleChange={setCurrentChatRoomTitle}
          onBack={() => setActiveSection("members")}
          canSendMessages={canSendMessages}
        />
      );
    }

    // DM 처리
    if (activeSection.startsWith("dm-")) {
      const roomId = parseInt(activeSection.replace("dm-", ""), 10);
      return (
        <ChatSection
          workspaceId={workspace.id}
          roomId={roomId}
          onRoomTitleChange={setCurrentChatRoomTitle}
          onBack={() => setActiveSection("members")}
          canSendMessages={canSendMessages}
        />
      );
    }

    switch (activeSection) {
      case "members":
        return <MembersSection workspace={workspace} onMembersUpdate={fetchWorkspace} onSectionChange={setActiveSection} />;
      case "chat":
        // 기본 채팅 섹션 - 채팅방을 선택하라는 메시지 표시
        return (
          <div className="h-full flex flex-col items-center justify-center text-white/40">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>사이드바에서 채팅방을 선택하세요</p>
          </div>
        );
      case "calls":
        // const canConnectMedia = usePermission(workspace, "CONNECT_MEDIA"); // Removed (Hoisted)
        // 전체 통화 채널의 참가자 합계? 아니면 CallsSection이 목록을 보여줄 때 사용?
        // activeSection이 "calls"일 때는 특정 채널이 아닌 대시보드일 수 있음.
        // 하지만 CallsSection은 channelId가 없으면 빈 화면을 보여줄 수 있음.
        // 여기서는 channelId prop이 필수인지 확인 필요.
        // CallsSection 정의: channelId?: string
        return <CallsSection workspaceId={workspace.id} canConnectMedia={canConnectMedia} />;
      case "calendar":
        return <CalendarSection workspaceId={workspace.id} />;
      case "storage":
        return <StorageSection workspaceId={workspace.id} />;
      default:
        return <MembersSection workspace={workspace} onMembersUpdate={fetchWorkspace} onSectionChange={setActiveSection} />;
    }
  };

  // Get section title and icon for breadcrumb
  const getSectionInfo = () => {
    if (activeSection.startsWith("chat-") && currentChatRoomTitle) {
      return { icon: <Hash size={16} />, title: currentChatRoomTitle };
    }
    if (activeSection.startsWith("call-")) {
      return { icon: <Phone size={16} />, title: "통화" };
    }
    if (activeSection.startsWith("dm-")) {
      return { icon: <MessageSquare size={16} />, title: "다이렉트 메시지" };
    }

    const sections: Record<string, { icon: React.ReactNode; title: string }> = {
      members: { icon: <Users size={16} />, title: "멤버" },
      chat: { icon: <MessageSquare size={16} />, title: "채팅" },
      calls: { icon: <Phone size={16} />, title: "통화" },
      calendar: { icon: <Calendar size={16} />, title: "캘린더" },
      storage: { icon: <FolderOpen size={16} />, title: "저장소" },
    };
    return sections[activeSection] || { icon: <Users size={16} />, title: "멤버" };
  };

  const sectionInfo = getSectionInfo();
  // 통화 중이면서 해당 채널을 보고 있는지 확인
  const isJoinedCallView = activeSection.startsWith("call-") &&
    activeCall?.channelId === activeSection;

  return (
    <div className="h-screen bg-[#1a1a1a] flex overflow-hidden">
      {/* Sidebar - Hide only when joined in the active call view */}
      {!isJoinedCallView && (
        <Sidebar
          workspace={workspace}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onUpdateWorkspace={(name) => setWorkspace((prev) => (prev ? { ...prev, name } : null))}
          activeCall={activeCall}
          onJoinCall={handleJoinCall}
          onLeaveCall={handleLeaveCall}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1a1a1a]">
        {/* Notion-style Top Bar */}
        {!isJoinedCallView && (
          <header className="h-11 border-b border-white/[0.06] flex items-center justify-between px-4 bg-[#1a1a1a]/80 backdrop-blur-sm sticky top-0 z-10">
            {/* Left: Breadcrumb */}
            <div className="flex items-center gap-1 text-sm">
              <button
                onClick={() => router.push("/workspace")}
                className="flex items-center gap-1 px-1.5 py-1 rounded text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
              >
                <ChevronLeft size={14} />
                <span className="text-xs">워크스페이스</span>
              </button>

              <span className="text-white/20">/</span>

              <div className="flex items-center gap-1.5 px-1.5 py-1 text-white/70">
                <span className="text-white/40">{sectionInfo.icon}</span>
                <span className="font-medium">{sectionInfo.title}</span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <NotificationDropdown onInvitationAccepted={() => router.push("/workspace")} />

              {/* Profile */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1 rounded-md hover:bg-white/[0.04] transition-all"
                >
                  <div className="relative">
                    {user.profileImg ? (
                      <img
                        src={user.profileImg}
                        alt={user.nickname}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-white/60">
                          {user.nickname.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <StatusIndicator
                      status={presenceMap[user.id]?.status || user.default_status || "online"}
                      size="sm"
                      className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white"
                    />
                  </div>
                </button>

                {showProfileMenu && (
                  <GlobalUserProfileMenu
                    onClose={() => setShowProfileMenu(false)}
                    onEditProfile={() => {
                      setShowProfileMenu(false);
                      setIsEditProfileModalOpen(true);
                    }}
                    onLogout={handleLogout}
                  />
                )}
              </div>
            </div>
          </header>
        )}
        {/* Content Area */}
        <main className="flex-1 overflow-hidden bg-[#1a1a1a]">
          {renderContent()}
        </main>
      </div>

      {/* Edit Profile Modal */}
      {
        isEditProfileModalOpen && user && (
          <EditProfileModal
            user={user}
            onClose={() => setIsEditProfileModalOpen(false)}
            onUpdate={handleUpdateProfile}
          />
        )
      }
    </div >
  );
}
