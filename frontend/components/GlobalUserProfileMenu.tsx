import { useState } from "react";
import { useAuth } from "../app/lib/auth-context";
import { usePresence } from "../app/contexts/presence-context";
import StatusIndicator from "./StatusIndicator";
import { Pencil, LogOut, Check } from "lucide-react";

interface GlobalUserProfileMenuProps {
    onClose: () => void;
    onEditProfile: () => void;
    onLogout: () => void;
}

const EMOJI_PRESETS = ["💬", "🕐", "🍔", "📅", "🌴", "🤒", "😀", "😂", "😎", "😴", "🎮", "💻"];

export default function GlobalUserProfileMenu({ onClose, onEditProfile, onLogout }: GlobalUserProfileMenuProps) {
    const { user } = useAuth();
    const { updateStatus, updateCustomStatus, presenceMap } = usePresence();
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [statusEmoji, setStatusEmoji] = useState("💬");

    const myPresence = user ? presenceMap[user.id] : null;
    const currentStatus = myPresence?.status || user?.default_status || "online";

    const handleStatusChange = (status: string) => {
        updateStatus(status);
    };

    const handleSaveCustomStatus = (e: React.FormEvent) => {
        e.preventDefault();
        updateCustomStatus(statusText, statusEmoji);
        setIsEditingStatus(false);
    };

    return (
        <>
            <div
                className="fixed inset-0 z-10"
                onClick={onClose}
            />
            <div className="absolute right-0 mt-2 w-72 bg-[#141414] border border-white/[0.08] shadow-2xl z-20 rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                {/* User Info */}
                <div className="p-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            {user?.profileImg ? (
                                <img
                                    src={user.profileImg}
                                    alt={user?.nickname}
                                    className="w-11 h-11 rounded-full object-cover ring-1 ring-white/10"
                                />
                            ) : (
                                <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                                    <span className="text-base font-medium text-white/80">
                                        {user?.nickname?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <StatusIndicator
                                status={currentStatus}
                                size="md"
                                className="absolute bottom-0 right-0 ring-2 ring-[#141414]"
                            />
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="font-medium text-white/90 truncate">{user?.nickname}</p>
                            <p className="text-xs text-white/40 truncate">{user?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Custom Status Section */}
                <div className="p-3 border-b border-white/[0.06]">
                    {isEditingStatus ? (
                        <form onSubmit={handleSaveCustomStatus} className="bg-white/[0.04] p-3 rounded-lg border border-white/[0.06]">
                            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-2">상태 메시지</p>

                            {/* Emoji Presets */}
                            <div className="grid grid-cols-6 gap-1.5 mb-3">
                                {EMOJI_PRESETS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setStatusEmoji(emoji)}
                                        className={`w-7 h-7 flex items-center justify-center rounded-md transition-all text-base ${
                                            statusEmoji === emoji
                                                ? "bg-white/10 ring-1 ring-white/20"
                                                : "hover:bg-white/[0.06]"
                                        }`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>

                            {/* Inputs */}
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={statusEmoji}
                                    onChange={(e) => setStatusEmoji(e.target.value)}
                                    className="w-10 p-2 text-center bg-white/[0.06] border border-white/[0.08] rounded-md text-base text-white focus:outline-none focus:border-white/20 transition-all"
                                    placeholder="😀"
                                    maxLength={2}
                                />
                                <input
                                    type="text"
                                    value={statusText}
                                    onChange={(e) => setStatusText(e.target.value)}
                                    className="flex-1 p-2 bg-white/[0.06] border border-white/[0.08] rounded-md text-sm text-white focus:outline-none focus:border-white/20 transition-all placeholder:text-white/30"
                                    placeholder="상태 메시지 입력..."
                                    maxLength={30}
                                    autoFocus
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingStatus(false)}
                                    className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 text-xs font-medium bg-white text-[#0a0a0a] rounded-md hover:bg-white/90 transition-all"
                                >
                                    저장
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => {
                                setIsEditingStatus(true);
                                setStatusText(myPresence?.custom_status_text || "");
                                setStatusEmoji(myPresence?.custom_status_emoji || "💬");
                            }}
                            className="w-full group"
                        >
                            {(myPresence?.custom_status_text || myPresence?.custom_status_emoji) ? (
                                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-all text-left">
                                    <span className="text-xl">
                                        {myPresence.custom_status_emoji || "💬"}
                                    </span>
                                    <span className="flex-1 text-sm text-white/70 truncate">
                                        {myPresence.custom_status_text || "상태 메시지 없음"}
                                    </span>
                                    <Pencil size={12} className="text-white/30 group-hover:text-white/50 transition-colors" />
                                </div>
                            ) : (
                                <div className="w-full py-2.5 border border-dashed border-white/[0.12] rounded-lg flex items-center justify-center gap-2 text-sm text-white/30 hover:text-white/50 hover:border-white/20 transition-all">
                                    <span>💬</span>
                                    <span>상태 메시지 설정</span>
                                </div>
                            )}
                        </button>
                    )}
                </div>

                {/* Status Selection */}
                <div className="p-2 border-b border-white/[0.06]">
                    <p className="px-2 py-1.5 text-[10px] font-medium text-white/30 uppercase tracking-wider">온라인 상태</p>
                    {[
                        { id: "online", label: "온라인", color: "bg-green-500" },
                        { id: "idle", label: "자리 비움", color: "bg-yellow-500" },
                        { id: "dnd", label: "방해 금지", color: "bg-red-500" },
                        { id: "offline", label: "오프라인 표시", color: "bg-white/30" },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleStatusChange(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-white/[0.04] transition-colors ${
                                currentStatus === item.id ? "bg-white/[0.04]" : ""
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${item.color}`} />
                            <span className="text-white/70">{item.label}</span>
                            {currentStatus === item.id && (
                                <Check size={14} className="text-white/50 ml-auto" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Menu Items */}
                <div className="p-2">
                    <button
                        onClick={() => {
                            onClose();
                            onEditProfile();
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-white/60 hover:text-white/90 hover:bg-white/[0.04] rounded-lg transition-colors flex items-center gap-2.5"
                    >
                        <Pencil size={14} className="text-white/40" />
                        프로필 수정
                    </button>
                    <button
                        onClick={onLogout}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2.5"
                    >
                        <LogOut size={14} />
                        로그아웃
                    </button>
                </div>
            </div>
        </>
    );
}
