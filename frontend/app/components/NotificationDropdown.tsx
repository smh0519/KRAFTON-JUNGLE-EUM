"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient, Notification } from "../lib/api";
import { NotificationType } from "../lib/constants";
import { usePresence } from "../contexts/presence-context";
import { useAuth } from "../lib/auth-context";
import { Bell, Inbox, Loader2, Check, X } from "lucide-react";

interface NotificationDropdownProps {
    onInvitationAccepted?: (workspaceId: number) => void;
}

export default function NotificationDropdown({ onInvitationAccepted }: NotificationDropdownProps) {
    const { isAuthenticated } = useAuth();
    const { latestNotification } = usePresence();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            setIsLoading(true);
            const response = await apiClient.getMyNotifications();
            setNotifications(response.notifications || []);
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (latestNotification) {
            setNotifications(prev => {
                if (prev.some(n => n.id === latestNotification.id)) {
                    return prev;
                }
                return [latestNotification, ...prev];
            });
        }
    }, [latestNotification]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();
        } else {
            setNotifications([]);
        }
    }, [isAuthenticated, fetchNotifications]);

    useEffect(() => {
        if (isOpen && isAuthenticated) {
            fetchNotifications();
        }
    }, [isOpen, isAuthenticated, fetchNotifications]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAccept = async (notification: Notification) => {
        try {
            setProcessingId(notification.id);
            const response = await apiClient.acceptInvitation(notification.id);
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
            if (onInvitationAccepted && response.workspace_id) {
                onInvitationAccepted(response.workspace_id);
            }
        } catch (err) {
            console.error("Failed to accept invitation:", err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleDecline = async (notification: Notification) => {
        try {
            setProcessingId(notification.id);
            await apiClient.declineInvitation(notification.id);
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
        } catch (err) {
            console.error("Failed to decline invitation:", err);
        } finally {
            setProcessingId(null);
        }
    };

    const getRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "방금 전";
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        return `${diffDays}일 전`;
    };

    return (
        <div ref={dropdownRef} className="relative">
            {/* Notification Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors relative"
            >
                <Bell size={18} strokeWidth={1.5} />
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#141414] rounded-xl shadow-2xl border border-white/[0.08] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                        <h3 className="font-medium text-white/90 text-sm">알림</h3>
                    </div>

                    {isLoading ? (
                        <div className="p-6 flex items-center justify-center">
                            <Loader2 size={20} className="animate-spin text-white/30" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                                <Inbox size={20} className="text-white/20" />
                            </div>
                            <p className="text-sm text-white/30">새로운 알림이 없습니다</p>
                        </div>
                    ) : (
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className="p-4 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Sender Avatar */}
                                        {notification.sender?.profile_img ? (
                                            <img
                                                src={notification.sender.profile_img}
                                                alt={notification.sender.nickname}
                                                className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10"
                                            />
                                        ) : notification.sender ? (
                                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-medium text-white/70">
                                                    {notification.sender.nickname.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                                                <Bell size={14} className="text-white/30" />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white/80 leading-relaxed">
                                                {notification.content}
                                            </p>
                                            <p className="text-xs text-white/30 mt-1">
                                                {getRelativeTime(notification.created_at)}
                                            </p>

                                            {/* Invitation Actions */}
                                            {notification.type === NotificationType.WORKSPACE_INVITE && (
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleAccept(notification)}
                                                        disabled={processingId === notification.id}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-[#0a0a0a] text-xs font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
                                                    >
                                                        {processingId === notification.id ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Check size={12} />
                                                        )}
                                                        수락
                                                    </button>
                                                    <button
                                                        onClick={() => handleDecline(notification)}
                                                        disabled={processingId === notification.id}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/[0.06] text-white/60 text-xs font-medium rounded-lg hover:bg-white/[0.1] hover:text-white/80 transition-colors disabled:opacity-50"
                                                    >
                                                        <X size={12} />
                                                        거절
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
