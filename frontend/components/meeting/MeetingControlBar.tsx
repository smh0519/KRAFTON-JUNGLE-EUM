'use client';

import { useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Pencil,
  Languages,
  PhoneOff,
  ChevronDown,
} from 'lucide-react';
import { TargetLanguage } from '@/app/hooks/useAudioWebSocket';

const LANGUAGES: { code: TargetLanguage; label: string; flag: string }[] = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

interface MeetingControlBarProps {
  // Media states
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  // Panel states
  isChatOpen: boolean;
  isWhiteboardOpen: boolean;
  isTranslationOpen: boolean;
  // Language
  sourceLanguage: TargetLanguage;
  targetLanguage: TargetLanguage;
  // Handlers
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onToggleChat: () => void;
  onToggleWhiteboard: () => void;
  onToggleTranslation: () => void;
  onSourceLanguageChange: (lang: TargetLanguage) => void;
  onTargetLanguageChange: (lang: TargetLanguage) => void;
  onLeave: () => void;
  // Optional
  unreadChatCount?: number;
  showLanguageDropdown?: boolean;
  onToggleLanguageDropdown?: () => void;
}

interface ControlButtonProps {
  onClick: () => void;
  isActive?: boolean;
  isDestructive?: boolean;
  badge?: number;
  tooltip?: string;
  children: React.ReactNode;
}

function ControlButton({ onClick, isActive, isDestructive, badge, tooltip, children }: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`
        relative w-11 h-11 rounded-lg border flex items-center justify-center
        transition-all duration-150 ease-out
        ${isDestructive 
          ? 'border-transparent bg-black/5 text-black/60 hover:bg-red-500 hover:text-white' 
          : isActive
            ? 'border-black/10 bg-black text-white'
            : 'border-black/[0.06] bg-white text-black/70 hover:bg-black/[0.04] hover:text-black'
        }
      `}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-black text-white text-[10px] font-medium flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-black/[0.06] mx-1" />;
}

export default function MeetingControlBar({
  isMicEnabled,
  isCameraEnabled,
  isScreenSharing,
  isChatOpen,
  isWhiteboardOpen,
  isTranslationOpen,
  sourceLanguage,
  targetLanguage,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  onToggleChat,
  onToggleWhiteboard,
  onToggleTranslation,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onLeave,
  unreadChatCount = 0,
  showLanguageDropdown = false,
  onToggleLanguageDropdown,
}: MeetingControlBarProps) {
  const currentSourceLang = LANGUAGES.find(l => l.code === sourceLanguage);
  const currentTargetLang = LANGUAGES.find(l => l.code === targetLanguage);

  return (
    <div className="h-16 bg-white border-t border-black/[0.06] flex items-center justify-center px-4">
      <div className="flex items-center gap-1">
        {/* Media Controls */}
        <ControlButton
          onClick={onToggleMic}
          isActive={!isMicEnabled}
          tooltip={isMicEnabled ? '마이크 끄기' : '마이크 켜기'}
        >
          {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </ControlButton>

        <ControlButton
          onClick={onToggleCamera}
          isActive={!isCameraEnabled}
          tooltip={isCameraEnabled ? '카메라 끄기' : '카메라 켜기'}
        >
          {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </ControlButton>

        <ControlButton
          onClick={onToggleScreen}
          isActive={isScreenSharing}
          tooltip={isScreenSharing ? '화면 공유 중지' : '화면 공유'}
        >
          <MonitorUp size={20} />
        </ControlButton>

        <Divider />

        {/* Tool Controls */}
        <ControlButton
          onClick={onToggleChat}
          isActive={isChatOpen}
          badge={!isChatOpen ? unreadChatCount : undefined}
          tooltip="채팅"
        >
          <MessageSquare size={20} />
        </ControlButton>

        <ControlButton
          onClick={onToggleWhiteboard}
          isActive={isWhiteboardOpen}
          tooltip="화이트보드"
        >
          <Pencil size={20} />
        </ControlButton>

        {/* Translation with Language Selector */}
        <div className="relative">
          <div className="flex items-center">
            <ControlButton
              onClick={onToggleTranslation}
              isActive={isTranslationOpen}
              tooltip="실시간 번역"
            >
              <Languages size={20} />
            </ControlButton>
            
            {isTranslationOpen && (
              <button
                onClick={onToggleLanguageDropdown}
                className="ml-1 h-11 px-2 rounded-lg border border-black/[0.06] bg-white hover:bg-black/[0.04] flex items-center gap-1 text-sm text-black/70 transition-colors"
              >
                <span>{currentSourceLang?.flag}</span>
                <span className="text-black/30">→</span>
                <span>{currentTargetLang?.flag}</span>
                <ChevronDown size={14} className="text-black/40" />
              </button>
            )}
          </div>

          {/* Language Dropdown */}
          {showLanguageDropdown && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-black/[0.08] rounded-xl shadow-lg shadow-black/[0.08] overflow-hidden z-50">
              <div className="p-3 border-b border-black/[0.06]">
                <p className="text-xs text-black/40 mb-2">내가 말하는 언어</p>
                <div className="flex flex-wrap gap-1">
                  {LANGUAGES.map(lang => (
                    <button
                      key={`source-${lang.code}`}
                      onClick={() => onSourceLanguageChange(lang.code)}
                      className={`px-2 py-1 rounded-md text-xs transition-colors ${
                        sourceLanguage === lang.code
                          ? 'bg-black text-white'
                          : 'bg-black/[0.04] text-black/70 hover:bg-black/[0.08]'
                      }`}
                    >
                      {lang.flag} {lang.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-black/40 mb-2">듣고 싶은 언어</p>
                <div className="flex flex-wrap gap-1">
                  {LANGUAGES.map(lang => (
                    <button
                      key={`target-${lang.code}`}
                      onClick={() => onTargetLanguageChange(lang.code)}
                      className={`px-2 py-1 rounded-md text-xs transition-colors ${
                        targetLanguage === lang.code
                          ? 'bg-black text-white'
                          : 'bg-black/[0.04] text-black/70 hover:bg-black/[0.08]'
                      }`}
                    >
                      {lang.flag} {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Leave */}
        <ControlButton
          onClick={onLeave}
          isDestructive
          tooltip="나가기"
        >
          <PhoneOff size={20} />
        </ControlButton>
      </div>
    </div>
  );
}
