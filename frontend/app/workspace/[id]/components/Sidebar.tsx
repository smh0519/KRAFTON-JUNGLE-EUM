"use client";

import { useState, useEffect, useRef } from "react";
import { ChatRoom, Meeting, apiClient } from "../../../lib/api";

interface SidebarProps {
  workspaceId: number;
  workspaceName: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  chatRooms: ChatRoom[];
  meetings: Meeting[];
  onRefreshSidebar: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  room: ChatRoom;
}

export default function Sidebar({
  workspaceId,
  workspaceName,
  activeSection,
  onSectionChange,
  isCollapsed,
  onToggleCollapse,
  chatRooms,
  meetings,
  onRefreshSidebar,
}: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>(["chat", "calls"]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isChatActive = activeSection === "chat" || activeSection.startsWith("chatroom-");
  const isCallsActive = activeSection === "calls" || activeSection.startsWith("call-");

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Right-click handler
  const handleContextMenu = (e: React.MouseEvent, room: ChatRoom) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      room,
    });
  };

  // Create chat room
  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const newRoom = await apiClient.createChatRoom(workspaceId, newRoomTitle.trim());
      setNewRoomTitle("");
      setShowCreateModal(false);
      onRefreshSidebar();
      onSectionChange(`chatroom-${newRoom.id}`);
    } catch (error) {
      console.error("Failed to create chat room:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete chat room
  const handleDeleteRoom = async () => {
    if (!selectedRoom || isLoading) return;

    try {
      setIsLoading(true);
      await apiClient.deleteChatRoom(workspaceId, selectedRoom.id);
      setShowDeleteModal(false);
      setSelectedRoom(null);
      onRefreshSidebar();

      // If deleted room was active, go to members
      if (activeSection === `chatroom-${selectedRoom.id}`) {
        onSectionChange("members");
      }
    } catch (error) {
      console.error("Failed to delete chat room:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Rename chat room (using delete + create for now since no rename API)
  const handleRenameRoom = async () => {
    if (!selectedRoom || !newRoomTitle.trim() || isLoading) return;

    try {
      setIsLoading(true);
      // Delete old room
      await apiClient.deleteChatRoom(workspaceId, selectedRoom.id);
      // Create new room with same messages won't work, so just create new one
      const newRoom = await apiClient.createChatRoom(workspaceId, newRoomTitle.trim());
      setNewRoomTitle("");
      setShowRenameModal(false);
      setSelectedRoom(null);
      onRefreshSidebar();
      onSectionChange(`chatroom-${newRoom.id}`);
    } catch (error) {
      console.error("Failed to rename chat room:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
        className={`h-screen bg-stone-50 border-r border-black/5 flex flex-col transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-black/5">
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">
                  {workspaceName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="font-medium text-sm text-black truncate">
                {workspaceName}
              </span>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-md hover:bg-black/5 transition-colors text-black/40 hover:text-black/70 ${
              isCollapsed ? "mx-auto" : ""
            }`}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {/* 멤버 */}
          <button
            onClick={() => onSectionChange("members")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all mb-0.5 ${
              activeSection === "members"
                ? "bg-black/5 text-black"
                : "text-black/60 hover:bg-black/[0.03] hover:text-black"
            } ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? "멤버" : undefined}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {!isCollapsed && <span className="text-sm font-medium">멤버</span>}
          </button>

          {/* 채팅 */}
          <div>
            <button
              onClick={() => toggleExpand("chat")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all mb-0.5 ${
                isChatActive
                  ? "bg-black/5 text-black"
                  : "text-black/60 hover:bg-black/[0.03] hover:text-black"
              } ${isCollapsed ? "justify-center" : ""}`}
              title={isCollapsed ? "채팅" : undefined}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {!isCollapsed && (
                <>
                  <span className="text-sm font-medium flex-1 text-left">채팅</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedItems.includes("chat") ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            {/* 채팅방 목록 */}
            {expandedItems.includes("chat") && !isCollapsed && (
              <div className="ml-4 pl-4 border-l border-black/10 mb-2">
                {chatRooms.length === 0 ? (
                  <p className="text-xs text-black/40 py-2 px-3">채팅방 없음</p>
                ) : (
                  chatRooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => onSectionChange(`chatroom-${room.id}`)}
                      onContextMenu={(e) => handleContextMenu(e, room)}
                      className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-sm ${
                        activeSection === `chatroom-${room.id}`
                          ? "bg-black/5 text-black font-medium"
                          : "text-black/50 hover:bg-black/[0.03] hover:text-black/70"
                      }`}
                    >
                      <span className="text-black/30">#</span>
                      <span className="truncate">{room.title}</span>
                    </button>
                  ))
                )}
                {/* 새 채팅방 만들기 버튼 */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm text-black/40 hover:bg-black/[0.03] hover:text-black/60 mt-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>새 채팅방</span>
                </button>
              </div>
            )}
          </div>

          {/* 통화방 */}
          <div>
            <button
              onClick={() => toggleExpand("calls")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all mb-0.5 ${
                isCallsActive
                  ? "bg-black/5 text-black"
                  : "text-black/60 hover:bg-black/[0.03] hover:text-black"
              } ${isCollapsed ? "justify-center" : ""}`}
              title={isCollapsed ? "통화방" : undefined}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {!isCollapsed && (
                <>
                  <span className="text-sm font-medium flex-1 text-left">통화방</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedItems.includes("calls") ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            {/* 통화방 목록 */}
            {expandedItems.includes("calls") && !isCollapsed && (
              <div className="ml-4 pl-4 border-l border-black/10 mb-2">
                {meetings.length === 0 ? (
                  <p className="text-xs text-black/40 py-2 px-3">통화방 없음</p>
                ) : (
                  meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      onClick={() => onSectionChange(`call-${meeting.id}`)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm ${
                        activeSection === `call-${meeting.id}`
                          ? "bg-black/5 text-black font-medium"
                          : "text-black/50 hover:bg-black/[0.03] hover:text-black/70"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        meeting.status === "IN_PROGRESS"
                          ? "bg-green-500 animate-pulse"
                          : "bg-current opacity-50"
                      }`} />
                      <span className="truncate">{meeting.title}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 캘린더 */}
          <button
            onClick={() => onSectionChange("calendar")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all mb-0.5 ${
              activeSection === "calendar"
                ? "bg-black/5 text-black"
                : "text-black/60 hover:bg-black/[0.03] hover:text-black"
            } ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? "캘린더" : undefined}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {!isCollapsed && <span className="text-sm font-medium">캘린더</span>}
          </button>

          {/* 저장소 */}
          <button
            onClick={() => onSectionChange("storage")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all mb-0.5 ${
              activeSection === "storage"
                ? "bg-black/5 text-black"
                : "text-black/60 hover:bg-black/[0.03] hover:text-black"
            } ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? "저장소" : undefined}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            {!isCollapsed && <span className="text-sm font-medium">저장소</span>}
          </button>
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-3 border-t border-black/5">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-black/40 hover:bg-black/[0.03] hover:text-black/60 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm">설정</span>
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white rounded-lg shadow-lg border border-black/10 z-50 min-w-[140px] overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setSelectedRoom(contextMenu.room);
              setNewRoomTitle(contextMenu.room.title);
              setShowRenameModal(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-black/70 hover:bg-black/5 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            이름 변경
          </button>
          <button
            onClick={() => {
              setSelectedRoom(contextMenu.room);
              setShowDeleteModal(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            삭제
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setNewRoomTitle("");
            }
          }}
        >
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
            <div className="p-5">
              <input
                type="text"
                value={newRoomTitle}
                onChange={(e) => setNewRoomTitle(e.target.value)}
                placeholder="채팅방 이름을 입력하세요"
                maxLength={25}
                className="w-full px-0 py-2 text-lg text-black placeholder:text-black/30 outline-none focus:outline-none focus:ring-0 focus:border-0 border-0 ring-0 bg-transparent"
                style={{ outline: 'none', boxShadow: 'none' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateRoom();
                  }
                  if (e.key === "Escape") {
                    setShowCreateModal(false);
                    setNewRoomTitle("");
                  }
                }}
              />
            </div>
            <div className="flex border-t border-black/5">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewRoomTitle("");
                }}
                className="flex-1 py-3.5 text-sm text-black/50 hover:text-black hover:bg-black/[0.02] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={!newRoomTitle.trim() || isLoading}
                className="flex-1 py-3.5 text-sm font-medium text-black hover:bg-black/[0.02] transition-colors disabled:text-black/20 disabled:cursor-not-allowed border-l border-black/5"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                  </span>
                ) : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedRoom && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
              setSelectedRoom(null);
            }
          }}
        >
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
            <div className="p-5">
              <p className="text-lg text-black">
                <span className="font-medium">{selectedRoom.title}</span>
              </p>
              <p className="text-sm text-black/40 mt-1">이 채팅방을 삭제할까요?</p>
            </div>
            <div className="flex border-t border-black/5">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedRoom(null);
                }}
                className="flex-1 py-3.5 text-sm text-black/50 hover:text-black hover:bg-black/[0.02] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteRoom}
                disabled={isLoading}
                className="flex-1 py-3.5 text-sm font-medium text-red-500 hover:bg-black/[0.02] transition-colors disabled:text-red-300 disabled:cursor-not-allowed border-l border-black/5"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <span className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                  </span>
                ) : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && selectedRoom && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowRenameModal(false);
              setSelectedRoom(null);
              setNewRoomTitle("");
            }
          }}
        >
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
            <div className="p-5">
              <input
                type="text"
                value={newRoomTitle}
                onChange={(e) => setNewRoomTitle(e.target.value)}
                placeholder="새 이름을 입력하세요"
                maxLength={25}
                className="w-full px-0 py-2 text-lg text-black placeholder:text-black/30 outline-none focus:outline-none focus:ring-0 focus:border-0 border-0 ring-0 bg-transparent"
                style={{ outline: 'none', boxShadow: 'none' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleRenameRoom();
                  }
                  if (e.key === "Escape") {
                    setShowRenameModal(false);
                    setSelectedRoom(null);
                    setNewRoomTitle("");
                  }
                }}
              />
            </div>
            <div className="flex border-t border-black/5">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setSelectedRoom(null);
                  setNewRoomTitle("");
                }}
                className="flex-1 py-3.5 text-sm text-black/50 hover:text-black hover:bg-black/[0.02] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleRenameRoom}
                disabled={!newRoomTitle.trim() || isLoading}
                className="flex-1 py-3.5 text-sm font-medium text-black hover:bg-black/[0.02] transition-colors disabled:text-black/20 disabled:cursor-not-allowed border-l border-black/5"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                  </span>
                ) : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
