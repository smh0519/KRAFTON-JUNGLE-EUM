"use client";

import { useState, useRef } from "react";
import type { AuthResponse } from "../app/lib/api";
import { apiClient } from "../app/lib/api";
import { X, Camera, Loader2 } from "lucide-react";

interface EditProfileModalProps {
    user: {
        nickname: string;
        profile_img?: string;
        profileImg?: string;
        [key: string]: any;
    };
    onClose: () => void;
    onUpdate: (updatedUser: AuthResponse["user"]) => void;
}

export default function EditProfileModal({
    user,
    onClose,
    onUpdate,
}: EditProfileModalProps) {
    const [nickname, setNickname] = useState(user.nickname);
    const [previewImg, setPreviewImg] = useState(user.profile_img || user.profileImg || "");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError("이미지 크기는 2MB 이하여야 합니다.");
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImg(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) {
            setError("닉네임을 입력해주세요.");
            return;
        }

        try {
            setIsLoading(true);
            setError("");

            const formData = new FormData();
            formData.append("nickname", nickname);
            if (selectedFile) {
                formData.append("profile_img", selectedFile);
            }

            const updatedUser = await apiClient.updateProfile(formData);
            onUpdate(updatedUser);
            onClose();
        } catch (err: any) {
            console.error("Failed to update profile:", err);
            setError(err.message || "프로필 수정에 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="bg-[#141414] rounded-2xl w-full max-w-md relative z-10 border border-white/[0.08] shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <h2 className="text-lg font-medium text-white">프로필 수정</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-6">
                        {/* Profile Image Preview */}
                        <div className="flex flex-col items-center gap-3">
                            <div
                                className="relative w-24 h-24 cursor-pointer group"
                                onClick={handleImageClick}
                            >
                                {previewImg ? (
                                    <img
                                        src={previewImg}
                                        alt="Preview"
                                        className="w-full h-full rounded-full object-cover ring-2 ring-white/10 group-hover:ring-white/20 transition-all"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${nickname}&background=1a1a1a&color=fff`;
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/[0.15] transition-colors">
                                        <span className="text-3xl font-medium text-white/50">
                                            {nickname.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                {/* Overlay Icon */}
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={24} className="text-white/80" />
                                </div>
                            </div>
                            <p className="text-xs text-white/30">클릭하여 이미지 변경</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        {/* Nickname Input */}
                        <div>
                            <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                                닉네임
                            </label>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-all"
                                placeholder="닉네임을 입력하세요"
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-400 text-center">{error}</p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 px-6 py-4 border-t border-white/[0.06]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors font-medium text-sm"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-2.5 px-4 rounded-lg bg-white text-[#0a0a0a] hover:bg-white/90 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading && <Loader2 size={14} className="animate-spin" />}
                            <span>저장</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
