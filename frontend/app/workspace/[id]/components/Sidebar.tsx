"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ChatRoom, Workspace } from "../../../lib/api";
import { useVoiceParticipantsWebSocket } from "../../../hooks/useVoiceParticipantsWebSocket";
import { usePermission } from "../../../hooks/usePermission";
import {
  Users,
  MessageSquare,
  Video,
  Calendar,
  FolderOpen,
  Settings,
  ChevronRight,
  ChevronsLeft,
  Plus,
  Hash,
  Volume2,
  Mic,
  X,
  Pencil,
  Trash2,
} from "lucide-react";

interface VoiceParticipant {
  identity: string;
  name: string;
  joinedAt: number;
}

interface MemberInfo {
  nickname: string;
  profileImg?: string;
}

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

interface SidebarProps {
  workspace: Workspace;
  activeSection: string;
  onSectionChange: (section: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateWorkspace?: (name: string) => void;
  activeCall?: ActiveCall | null;
  onJoinCall?: (channelId: string, channelName: string) => void;
  onLeaveCall?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: { id: string; label: string }[];
  dynamicChildren?: boolean;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  room: ChatRoom | null;
}

export default function Sidebar({
  workspace,
  activeSection,
  onSectionChange,
  isCollapsed,
  onToggleCollapse,
  onUpdateWorkspace,
  activeCall,
  onJoinCall,
  onLeaveCall,
}: SidebarProps) {
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>(["chat", "calls"]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [newChatRoomTitle, setNewChatRoomTitle] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const canManageChannels = usePermission(workspace, "MANAGE_CHANNELS");
  const canManageRoles = usePermission(workspace, "MANAGE_ROLES");
  const workspaceId = workspace.id;
  const workspaceName = workspace.name;

  // 통화방 목록 상태
  interface CallChannel {
    id: string;
    label: string;
  }
  const [callChannels, setCallChannels] = useState<CallChannel[]>([
    { id: "call-general", label: "일반 통화" },
    { id: "call-standup", label: "스탠드업 미팅" },
    { id: "call-brainstorm", label: "브레인스토밍" },
  ]);
  const [showCreateCallModal, setShowCreateCallModal] = useState(false);
  const [newCallChannelName, setNewCallChannelName] = useState("");

  // 통화방 참가자 목록 (디스코드 스타일)
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, VoiceParticipant[]>>({});

  // 워크스페이스 멤버 프로필 맵 (nickname -> profileImg)
  const [memberProfiles, setMemberProfiles] = useState<Record<string, string>>({});

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    room: null,
  });

  // 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ChatRoom | null>(null);
  const [editRoomTitle, setEditRoomTitle] = useState("");
  const [isUpdatingRoom, setIsUpdatingRoom] = useState(false);

  // 삭제 확인 모달 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState<ChatRoom | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 채팅방 목록 로드
  const loadChatRooms = useCallback(async () => {
    try {
      const response = await apiClient.getChatRooms(workspaceId);
      setChatRooms(response.rooms);
    } catch (error) {
      console.error("Failed to load chat rooms:", error);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadChatRooms();
  }, [loadChatRooms]);

  // 워크스페이스 멤버 프로필 로드
  useEffect(() => {
    const loadMemberProfiles = async () => {
      try {
        const workspace = await apiClient.getWorkspace(workspaceId);
        if (workspace.members) {
          const profiles: Record<string, string> = {};
          workspace.members.forEach(member => {
            if (member.user?.nickname && member.user?.profile_img) {
              profiles[member.user.nickname] = member.user.profile_img;
            }
          });
          setMemberProfiles(profiles);
        }
      } catch (error) {
        console.error("Failed to load member profiles:", error);
      }
    };
    loadMemberProfiles();
  }, [workspaceId]);

  // 음성 참가자 WebSocket 핸들러
  const handleParticipantsInit = useCallback((participants: Record<string, { identity: string; name: string; profileImg?: string; joinedAt?: number }[]>) => {
    // roomName 형식을 channel-{id} 형식으로 변환
    const converted: Record<string, VoiceParticipant[]> = {};
    for (const [roomName, participantList] of Object.entries(participants)) {
      // workspace-{id}-call-xxx 형식에서 channel-call-xxx 형식으로 변환
      const parts = roomName.split('-');
      if (parts.length >= 3) {
        const channelKey = `channel-${parts.slice(2).join('-')}`;
        converted[channelKey] = participantList.map(p => ({
          identity: p.identity,
          name: p.name,
          joinedAt: p.joinedAt || Date.now(),
        }));
      }
    }
    setVoiceParticipants(converted);
  }, []);

  const handleParticipantJoin = useCallback((channelId: string, participant: { identity: string; name: string; profileImg?: string }) => {
    setVoiceParticipants(prev => {
      const roomName = channelId.startsWith('channel-') ? channelId : `channel-${channelId}`;
      const currentParticipants = prev[roomName] || [];

      // 중복 방지
      if (currentParticipants.some(p => p.identity === participant.identity)) {
        return prev;
      }

      return {
        ...prev,
        [roomName]: [...currentParticipants, {
          identity: participant.identity,
          name: participant.name,
          joinedAt: Date.now(),
        }],
      };
    });
  }, []);

  const handleParticipantLeave = useCallback((channelId: string, identity: string) => {
    setVoiceParticipants(prev => {
      const roomName = channelId.startsWith('channel-') ? channelId : `channel-${channelId}`;
      const currentParticipants = prev[roomName] || [];

      return {
        ...prev,
        [roomName]: currentParticipants.filter(p => p.identity !== identity),
      };
    });
  }, []);

  // WebSocket 훅 사용
  const { sendJoin, sendLeave } = useVoiceParticipantsWebSocket({
    workspaceId,
    onParticipantsInit: handleParticipantsInit,
    onParticipantJoin: handleParticipantJoin,
    onParticipantLeave: handleParticipantLeave,
    enabled: true,
  });

  // 채팅방 생성
  const handleCreateChatRoom = async () => {
    if (!newChatRoomTitle.trim() || isCreatingRoom) return;

    try {
      setIsCreatingRoom(true);
      const newRoom = await apiClient.createChatRoom(workspaceId, newChatRoomTitle.trim());
      setChatRooms(prev => [...prev, newRoom]);
      setNewChatRoomTitle("");
      setShowCreateChatModal(false);
      // 생성된 채팅방으로 이동
      onSectionChange(`chat-${newRoom.id}`);
    } catch (error) {
      console.error("Failed to create chat room:", error);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // 컨텍스트 메뉴 열기
  const handleContextMenu = (e: React.MouseEvent, room: ChatRoom) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      room,
    });
  };

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, x: 0, y: 0, room: null });
  }, []);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    if (contextMenu.isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu.isOpen, closeContextMenu]);

  // 수정 모달 열기
  const openEditModal = (room: ChatRoom) => {
    setEditingRoom(room);
    setEditRoomTitle(room.title);
    setShowEditModal(true);
    closeContextMenu();
  };

  // 채팅방 수정
  const handleUpdateChatRoom = async () => {
    if (!editingRoom || !editRoomTitle.trim() || isUpdatingRoom) return;

    try {
      setIsUpdatingRoom(true);
      const updatedRoom = await apiClient.updateChatRoom(workspaceId, editingRoom.id, editRoomTitle.trim());
      setChatRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));
      setShowEditModal(false);
      setEditingRoom(null);
      setEditRoomTitle("");
    } catch (error) {
      console.error("Failed to update chat room:", error);
    } finally {
      setIsUpdatingRoom(false);
    }
  };

  // 삭제 모달 열기
  const openDeleteModal = (room: ChatRoom) => {
    setDeletingRoom(room);
    setShowDeleteModal(true);
    closeContextMenu();
  };

  // 채팅방 삭제
  const handleDeleteChatRoom = async () => {
    if (!deletingRoom || isDeletingRoom) return;

    try {
      setIsDeletingRoom(true);
      await apiClient.deleteChatRoom(workspaceId, deletingRoom.id);
      setChatRooms(prev => prev.filter(r => r.id !== deletingRoom.id));
      // 삭제된 채팅방이 현재 활성화된 경우 다른 섹션으로 이동
      if (activeSection === `chat-${deletingRoom.id}`) {
        onSectionChange("members");
      }
      setShowDeleteModal(false);
      setDeletingRoom(null);
    } catch (error) {
      console.error("Failed to delete chat room:", error);
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 통화 채널 클릭 핸들러 - 모달 없이 바로 섹션 이동
  const handleCallChannelClick = (channelId: string, channelLabel: string) => {
    onSectionChange(channelId);
  };

  // 통화방 생성
  const handleCreateCallChannel = () => {
    if (!newCallChannelName.trim()) return;
    const newId = `call-${Date.now()}`;
    setCallChannels(prev => [...prev, { id: newId, label: newCallChannelName.trim() }]);
    setNewCallChannelName("");
    setShowCreateCallModal(false);
  };

  const navItems: NavItem[] = [
    {
      id: "members",
      label: "멤버",
      icon: <Users size={18} strokeWidth={1.5} />,
    },
    {
      id: "chat",
      label: "채팅",
      icon: <MessageSquare size={18} strokeWidth={1.5} />,
      dynamicChildren: true,
    },
    {
      id: "calls",
      label: "통화방",
      icon: <Video size={18} strokeWidth={1.5} />,
      dynamicChildren: true,
    },
    {
      id: "calendar",
      label: "캘린더",
      icon: <Calendar size={18} strokeWidth={1.5} />,
    },
    {
      id: "storage",
      label: "저장소",
      icon: <FolderOpen size={18} strokeWidth={1.5} />,
    },
  ];

  return (
    <>
      <div
        className={`h-screen bg-[#141414] border-r border-white/5 flex flex-col transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"
          }`}
      >
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/5">
            {!isCollapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">
                    {workspaceName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium text-sm text-white truncate">
                  {workspaceName}
                </span>
              </div>
            )}
            <button
              onClick={onToggleCollapse}
              className={`p-1.5 rounded-md hover:bg-white/5 transition-colors text-white/40 hover:text-white/70 ${isCollapsed ? "mx-auto" : ""
                }`}
            >
              <ChevronsLeft
                size={16}
                className={`transition-transform ${isCollapsed ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            {navItems.map((item) => (
              <div key={item.id}>
                <button
                  onClick={() => {
                    if (item.children || item.dynamicChildren) {
                      toggleExpand(item.id);
                    } else {
                      onSectionChange(item.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all mb-0.5 ${activeSection === item.id ||
                    (item.children && activeSection.startsWith("call-")) ||
                    (item.dynamicChildren && activeSection.startsWith("chat-"))
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                    } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!isCollapsed && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                      {(item.children || item.dynamicChildren) && (
                        <ChevronRight
                          size={14}
                          className={`transition-transform ${expandedItems.includes(item.id) ? "rotate-90" : ""}`}
                        />
                      )}
                    </>
                  )}
                </button>

                {/* Dynamic Children - 채팅방 */}
                {item.id === "chat" && item.dynamicChildren && expandedItems.includes(item.id) && !isCollapsed && (
                  <div className="ml-4 pl-4 border-l border-white/10 mt-1 mb-2">
                    {chatRooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => onSectionChange(`chat-${room.id}`)}
                        onContextMenu={(e) => handleContextMenu(e, room)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm group ${activeSection === `chat-${room.id}`
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
                          }`}
                      >
                        <Hash size={14} className="opacity-50 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{room.title}</span>
                      </button>
                    ))}
                    {/* 새 채팅방 버튼 */}
                    {canManageChannels && (
                      <button
                        onClick={() => setShowCreateChatModal(true)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm text-white/40 hover:bg-white/[0.05] hover:text-white/60"
                      >
                        <Plus size={14} />
                        새 채팅방
                      </button>
                    )}
                  </div>
                )}

                {/* Dynamic Children - 통화방 (디스코드 스타일) */}
                {item.id === "calls" && item.dynamicChildren && expandedItems.includes(item.id) && !isCollapsed && (
                  <div className="ml-4 pl-4 border-l border-white/10 mt-1 mb-2">
                    {callChannels.map((channel) => {
                      const roomName = `channel-${channel.id}`;
                      const channelParticipants = voiceParticipants[roomName] || [];
                      const hasParticipants = channelParticipants.length > 0;

                      return (
                        <div key={channel.id}>
                          <button
                            onClick={() => handleCallChannelClick(channel.id, channel.label)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm group ${hasParticipants
                              ? "bg-green-500/10 text-green-500 font-medium"
                              : activeSection === channel.id
                                ? "bg-white/10 text-white font-medium"
                                : "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
                              }`}
                          >
                            <Volume2 size={16} className="flex-shrink-0" />
                            <span className="flex-1 text-left">{channel.label}</span>
                            {hasParticipants && (
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            )}
                          </button>
                          {/* 참여자 목록 - 모든 참가자 표시 (내가 통화 중이 아니어도) */}
                          {hasParticipants && (
                            <div className="ml-6 mt-1 space-y-0.5">
                              {channelParticipants.map((participant) => {
                                const displayName = participant.name || participant.identity;
                                const profileImg = memberProfiles[displayName];
                                return (
                                  <div
                                    key={participant.identity}
                                    className="flex items-center gap-2 px-2 py-1 rounded text-xs text-white/60"
                                  >
                                    {profileImg ? (
                                      <img
                                        src={profileImg}
                                        alt={displayName}
                                        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-[10px] font-medium text-green-500">
                                          {displayName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                    <span className="truncate">{displayName}</span>
                                    <Mic size={12} className="text-green-500 flex-shrink-0 ml-auto" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* 새 통화방 버튼 */}
                    {canManageChannels && (
                      <button
                        onClick={() => setShowCreateCallModal(true)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm text-white/40 hover:bg-white/[0.05] hover:text-white/60"
                      >
                        <Plus size={14} />
                        새 통화방
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          {!isCollapsed && canManageRoles && (
            <div className="p-3 border-t border-white/[0.06]">
              <button
                onClick={() => router.push(`/workspace/${workspaceId}/settings`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:bg-white/[0.05] hover:text-white/60 transition-colors"
              >
                <Settings size={18} strokeWidth={1.5} />
                <span className="text-sm">설정</span>
              </button>
            </div>
          )}

          {/* 컨텍스트 메뉴 */}
          {contextMenu.isOpen && contextMenu.room && (
            <div
              ref={contextMenuRef}
              className="fixed z-50 min-w-[140px] bg-white rounded-lg shadow-lg shadow-black/10 border border-black/5 overflow-hidden"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
              }}
            >
              {canManageChannels && (
                <>
                  <button
                    onClick={() => openEditModal(contextMenu.room!)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-black/70 hover:bg-black/[0.04] hover:text-black"
                  >
                    <Pencil size={14} />
                    이름 변경
                  </button>
                  <button
                    onClick={() => openDeleteModal(contextMenu.room!)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    삭제
                  </button>
                </>
              )}
            </div>
          )}

          {/* 채팅방 생성 모달 */}
          {showCreateChatModal && (
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => { setShowCreateChatModal(false); setNewChatRoomTitle(""); }}
            >
              <div
                className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl shadow-black/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                  <h3 className="text-base font-semibold text-black">새 채팅방</h3>
                  <button
                    onClick={() => { setShowCreateChatModal(false); setNewChatRoomTitle(""); }}
                    className="p-1 rounded-full hover:bg-black/5 transition-colors text-black/40"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 입력 영역 */}
                <div className="p-5">
                  <input
                    type="text"
                    value={newChatRoomTitle}
                    onChange={(e) => setNewChatRoomTitle(e.target.value)}
                    placeholder="채팅방 이름을 입력하세요"
                    className="w-full px-0 py-2 text-sm text-black placeholder:text-black/30 bg-transparent border-b border-black/10 focus:border-black/30 transition-colors"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleCreateChatRoom()}
                  />
                </div>

                {/* 버튼 */}
                <div className="px-5 pb-5">
                  <button
                    onClick={handleCreateChatRoom}
                    disabled={!newChatRoomTitle.trim() || isCreatingRoom}
                    className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-full hover:bg-black/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isCreatingRoom ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        생성 중
                      </span>
                    ) : "만들기"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 채팅방 수정 모달 */}
          {showEditModal && editingRoom && (
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => { setShowEditModal(false); setEditingRoom(null); setEditRoomTitle(""); }}
            >
              <div
                className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl shadow-black/10 overflow-hidden animate-zoom-in"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                  <h3 className="text-base font-semibold text-black">채팅방 이름 변경</h3>
                  <button
                    onClick={() => { setShowEditModal(false); setEditingRoom(null); setEditRoomTitle(""); }}
                    className="p-1 rounded-full hover:bg-black/5 transition-colors text-black/40"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 입력 영역 */}
                <div className="p-5">
                  <input
                    type="text"
                    value={editRoomTitle}
                    onChange={(e) => setEditRoomTitle(e.target.value)}
                    placeholder="새 이름을 입력하세요"
                    className="w-full px-0 py-2 text-sm text-black placeholder:text-black/30 bg-transparent border-b border-black/10 focus:border-black/30 transition-colors focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleUpdateChatRoom()}
                  />
                </div>

                {/* 버튼 */}
                <div className="px-5 pb-5">
                  <button
                    onClick={handleUpdateChatRoom}
                    disabled={!editRoomTitle.trim() || editRoomTitle === editingRoom.title || isUpdatingRoom}
                    className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-full hover:bg-black/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isUpdatingRoom ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        저장 중
                      </span>
                    ) : "저장"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 채팅방 삭제 확인 모달 */}
          {showDeleteModal && deletingRoom && (
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => { setShowDeleteModal(false); setDeletingRoom(null); }}
            >
              <div
                className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl shadow-black/10 overflow-hidden animate-zoom-in"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                  <h3 className="text-base font-semibold text-black">채팅방 삭제</h3>
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeletingRoom(null); }}
                    className="p-1 rounded-full hover:bg-black/5 transition-colors text-black/40"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 내용 */}
                <div className="p-5">
                  <p className="text-sm text-black/60 leading-relaxed">
                    <span className="font-medium text-black">#{deletingRoom.title}</span> 채팅방을 삭제하시겠습니까?
                    <br />
                    <span className="text-red-500/80">모든 메시지가 삭제되며 복구할 수 없습니다.</span>
                  </p>
                </div>

                {/* 버튼 */}
                <div className="px-5 pb-5 flex gap-3">
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeletingRoom(null); }}
                    className="flex-1 py-2.5 bg-black/5 text-black/70 text-sm font-medium rounded-full hover:bg-black/10 transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDeleteChatRoom}
                    disabled={isDeletingRoom}
                    className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-full hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingRoom ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        삭제 중
                      </span>
                    ) : "삭제"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 새 통화방 생성 모달 */}
          {showCreateCallModal && (
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => { setShowCreateCallModal(false); setNewCallChannelName(""); }}
            >
              <div
                className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl shadow-black/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                  <h3 className="text-base font-semibold text-black">새 통화방</h3>
                  <button
                    onClick={() => { setShowCreateCallModal(false); setNewCallChannelName(""); }}
                    className="p-1 rounded-full hover:bg-black/5 transition-colors text-black/40"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 입력 영역 */}
                <div className="p-5">
                  <input
                    type="text"
                    value={newCallChannelName}
                    onChange={(e) => setNewCallChannelName(e.target.value)}
                    placeholder="통화방 이름을 입력하세요"
                    className="w-full px-0 py-2 text-sm text-black placeholder:text-black/30 bg-transparent border-b border-black/10 focus:border-black/30 transition-colors focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleCreateCallChannel()}
                  />
                </div>

                {/* 버튼 */}
                <div className="px-5 pb-5">
                  <button
                    onClick={handleCreateCallChannel}
                    disabled={!newCallChannelName.trim()}
                    className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-full hover:bg-black/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    만들기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div >

    </>
  );
}
