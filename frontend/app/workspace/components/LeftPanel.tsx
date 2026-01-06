"use client";

import { ArrowRight } from "lucide-react";

interface LeftPanelProps {
  userNickname: string;
  workspaceCount: number;
  onCreateWorkspace: () => void;
}

export function LeftPanel({
  userNickname,
  workspaceCount,
  onCreateWorkspace,
}: LeftPanelProps) {
  return (
    <div className="hidden lg:flex w-[420px] min-h-screen flex-col justify-between p-10 border-r border-white/10 relative overflow-hidden">
      {/* Background Flower */}
      <div className="absolute top-0 bottom-0 right-0 w-2/3 pointer-events-none">
        <img
          src="/workspace-flower.png"
          alt=""
          className="absolute top-1/2 -translate-y-1/2 -right-4 h-[85%] object-contain opacity-[0.15]"
        />
      </div>

      {/* Top */}
      <div className="relative z-10">
        <img src="/logo_white.png" alt="EUM" className="h-5" />
      </div>

      {/* Center - Typography */}
      <div className="space-y-8 relative z-10">
        <div className="space-y-3">
          <p className="text-white/50 text-sm tracking-wide">Welcome back</p>
          <h1 className="text-[48px] font-bold leading-[1.1] tracking-tight text-white">
            {userNickname}
          </h1>
        </div>

        <div className="w-16 h-[2px] bg-white/30" />

        <div className="space-y-2">
          <p className="text-white/60 text-base">
            {workspaceCount > 0
              ? `${workspaceCount}개의 워크스페이스`
              : "워크스페이스 없음"}
          </p>
        </div>
      </div>

      {/* Bottom - Create Button */}
      <button
        onClick={onCreateWorkspace}
        className="group flex items-center justify-between py-5 border-t border-white/10 hover:border-white/20 transition-colors relative z-10"
      >
        <span className="text-base text-white/70 group-hover:text-white transition-colors">
          새 워크스페이스 만들기
        </span>
        <ArrowRight size={18} className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
      </button>
    </div>
  );
}
