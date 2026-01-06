"use client";

import { RefObject } from "react";
import { ArrowRight, ArrowLeft, Search, X, Loader2 } from "lucide-react";
import { UserSearchResult } from "../../lib/api";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  isClosing: boolean;
  step: 1 | 2;
  workspaceName: string;
  searchQuery: string;
  searchResults: UserSearchResult[];
  selectedMembers: UserSearchResult[];
  isSearching: boolean;
  isCreating: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onWorkspaceNameChange: (name: string) => void;
  onSearchQueryChange: (query: string) => void;
  onAddMember: (user: UserSearchResult) => void;
  onRemoveMember: (userId: number) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function CreateWorkspaceModal({
  isOpen,
  isClosing,
  step,
  workspaceName,
  searchQuery,
  searchResults,
  selectedMembers,
  isSearching,
  isCreating,
  videoRef,
  onWorkspaceNameChange,
  onSearchQueryChange,
  onAddMember,
  onRemoveMember,
  onNextStep,
  onPrevStep,
  onSubmit,
  onClose,
}: CreateWorkspaceModalProps) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex transition-all duration-500 ${
        isOpen
          ? isClosing
            ? 'opacity-0'
            : 'opacity-100'
          : 'opacity-0 pointer-events-none'
      }`}
      style={{ fontFamily: "'Cafe24ProSlim', sans-serif" }}
    >
      {/* Left - Video */}
      <div className="hidden lg:block w-[55%] h-full relative overflow-hidden bg-[#1a1a1a]">
        <video
          ref={videoRef}
          src="/new-workspace-page-background-video.mov"
          className="w-full h-full object-cover opacity-60"
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#1a1a1a]" />

        <button
          onClick={onClose}
          className="absolute top-8 left-8 text-white/60 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Right - Form */}
      <div className="w-full lg:w-[45%] h-full bg-[#1a1a1a] flex flex-col justify-center px-10 lg:px-16">
        <button
          onClick={onClose}
          className="lg:hidden absolute top-8 right-8 text-white/60 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="max-w-sm">
          {/* Progress */}
          <div className="flex gap-3 mb-12">
            <div className={`h-[3px] w-10 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/20'}`} />
            <div className={`h-[3px] w-10 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/20'}`} />
          </div>

          {step === 1 && (
            <div className="space-y-12">
              <div className="space-y-3">
                <p className="text-sm text-white/50 uppercase tracking-[0.15em]">Step 01</p>
                <h2 className="text-3xl font-bold text-white">워크스페이스 이름</h2>
              </div>

              <input
                type="text"
                value={workspaceName}
                onChange={(e) => onWorkspaceNameChange(e.target.value)}
                placeholder="이름 입력"
                className="w-full bg-transparent border-b-2 border-white/20 focus:border-white/60 py-4 text-xl text-white placeholder:text-white/30 outline-none transition-colors"
                autoFocus
              />

              <button
                onClick={onNextStep}
                disabled={!workspaceName.trim()}
                className={`flex items-center gap-3 text-base transition-all ${
                  workspaceName.trim()
                    ? 'text-white hover:gap-4'
                    : 'text-white/30 cursor-not-allowed'
                }`}
              >
                <span>다음</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-10">
              <div className="space-y-3">
                <p className="text-sm text-white/50 uppercase tracking-[0.15em]">Step 02</p>
                <h2 className="text-3xl font-bold text-white">멤버 초대</h2>
                <p className="text-base text-white/50">선택사항</p>
              </div>

              {/* Selected */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 bg-white/10 rounded-full py-1.5 pl-1.5 pr-3"
                    >
                      {member.profile_img ? (
                        <img src={member.profile_img} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                          <span className="text-[10px] text-white/70">{member.nickname.charAt(0)}</span>
                        </div>
                      )}
                      <span className="text-sm text-white/80">{member.nickname}</span>
                      <button onClick={() => onRemoveMember(member.id)} className="ml-1">
                        <X size={12} className="text-white/40 hover:text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder="이름 또는 이메일 검색"
                  className="w-full bg-transparent border-b-2 border-white/20 focus:border-white/60 py-4 pl-7 text-base text-white placeholder:text-white/30 outline-none transition-colors"
                />
                {isSearching && (
                  <Loader2 size={14} className="absolute right-0 top-1/2 -translate-y-1/2 animate-spin text-white/50" />
                )}

                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#252525] border border-white/10 rounded-xl overflow-hidden">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => onAddMember(result)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
                      >
                        {result.profile_img ? (
                          <img src={result.profile_img} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="text-sm text-white/70">{result.nickname.charAt(0)}</span>
                          </div>
                        )}
                        <div>
                          <p className="text-base text-white">{result.nickname}</p>
                          <p className="text-sm text-white/50">{result.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={onPrevStep}
                  className="flex items-center gap-2 text-base text-white/50 hover:text-white transition-colors"
                >
                  <ArrowLeft size={18} />
                  <span>이전</span>
                </button>

                <button
                  onClick={onSubmit}
                  disabled={isCreating}
                  className="flex items-center gap-3 text-base text-white hover:gap-4 transition-all disabled:text-white/40"
                >
                  <span>{isCreating ? '생성 중...' : '완료'}</span>
                  {isCreating ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
