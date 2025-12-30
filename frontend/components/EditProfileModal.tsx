"use client";

import { useState, useRef } from "react";
import type { AuthResponse } from "../app/lib/api";
import { apiClient } from "../app/lib/api";

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
            if (file.size > 2 * 1024 * 1024) { // 2MB restriction
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="bg-white rounded-2xl w-full max-w-md p-8 relative z-10 shadow-2xl animate-in fade-in zoom-in duration-200">
                <h2 className="text-2xl font-medium text-black mb-6">프로필 수정</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Profile Image Preview */}
                    <div className="flex flex-col items-center gap-2">
                        <div
                            className="relative w-24 h-24 cursor-pointer group"
                            onClick={handleImageClick}
                        >
                            {previewImg ? (
                                <img
                                    src={previewImg}
                                    alt="Preview"
                                    className="w-full h-full rounded-full object-cover border-2 border-black/5 group-hover:opacity-70 transition-opacity"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${nickname}&background=000&color=fff`;
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full rounded-full bg-black flex items-center justify-center group-hover:opacity-70 transition-opacity">
                                    <svg className="w-12 h-12 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                            )}
                            {/* Overlay Icon */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-black/50 rounded-full p-2">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-black/40 pt-2">이미지를 클릭하여 변경</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-black/70 mb-1">
                                닉네임
                            </label>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="w-full px-4 py-3 bg-black/5 rounded-xl text-black placeholder:text-black/30 outline-none focus:ring-2 focus:ring-black/10 transition-all"
                                placeholder="닉네임을 입력하세요"
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-500 text-center">{error}</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl text-black/70 hover:bg-black/5 transition-colors font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-3 px-4 rounded-xl bg-black text-white hover:bg-black/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading && (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            )}
                            <span>저장</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
