'use client';

import { useState, useEffect } from 'react';
import { useParticipants } from '@livekit/components-react';
import { 
  Users, 
  Clock, 
  LayoutGrid, 
  PenTool,
  Maximize2,
  Settings,
  ChevronLeft
} from 'lucide-react';

interface MeetingTopBarProps {
  roomTitle: string;
  isWhiteboardMode: boolean;
  onToggleMode: () => void;
  onBack?: () => void;
  onFullscreen?: () => void;
  onSettings?: () => void;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function MeetingTopBar({
  roomTitle,
  isWhiteboardMode,
  onToggleMode,
  onBack,
  onFullscreen,
  onSettings,
}: MeetingTopBarProps) {
  const participants = useParticipants();
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-14 bg-white border-b border-black/[0.06] flex items-center justify-between px-4">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-md text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-black">{roomTitle}</h1>
          <span className="text-xs text-black/40 bg-black/[0.04] px-2 py-0.5 rounded-full">
            회의 중
          </span>
        </div>
      </div>

      {/* Center Section - Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-black/50">
          <Clock size={14} />
          <span className="text-xs font-medium tabular-nums">{formatDuration(elapsed)}</span>
        </div>
        
        <div className="w-px h-4 bg-black/[0.08]" />
        
        <div className="flex items-center gap-1.5 text-black/50">
          <Users size={14} />
          <span className="text-xs font-medium">{participants.length}</span>
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-1">
        {/* View Mode Toggle */}
        <div className="flex items-center p-0.5 bg-black/[0.04] rounded-lg">
          <button
            onClick={() => isWhiteboardMode && onToggleMode()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              !isWhiteboardMode
                ? 'bg-white text-black shadow-sm'
                : 'text-black/50 hover:text-black/70'
            }`}
          >
            <LayoutGrid size={14} />
            <span>비디오</span>
          </button>
          <button
            onClick={() => !isWhiteboardMode && onToggleMode()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              isWhiteboardMode
                ? 'bg-white text-black shadow-sm'
                : 'text-black/50 hover:text-black/70'
            }`}
          >
            <PenTool size={14} />
            <span>화이트보드</span>
          </button>
        </div>

        <div className="w-px h-5 bg-black/[0.08] mx-1" />

        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="p-2 rounded-md text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors"
            title="전체 화면"
          >
            <Maximize2 size={16} />
          </button>
        )}

        {onSettings && (
          <button
            onClick={onSettings}
            className="p-2 rounded-md text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors"
            title="설정"
          >
            <Settings size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
