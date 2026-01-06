'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  RoomAudioRenderer,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useRoomTranslation, RoomTranscriptData } from '@/app/hooks/useRoomTranslation';
import { TargetLanguage } from '@/app/hooks/useAudioWebSocket';
import { apiClient } from '@/app/lib/api';
import WhiteboardCanvas from '@/components/video/whiteboard/WhiteboardCanvas';
import ChatPanel, { VoiceRecord } from '@/components/video/ChatPanel';

import MeetingTopBar from './MeetingTopBar';
import MeetingControlBar from './MeetingControlBar';
import VideoSidebar from './VideoSidebar';
import SubtitlePills from './SubtitlePills';

interface ActiveMeetingProps {
  roomId: string;
  roomTitle: string;
  onLeave: () => void;
  currentUser: {
    nickname: string;
    profileImg?: string;
  };
}

export default function ActiveMeeting({
  roomId,
  roomTitle,
  onLeave,
  currentUser,
}: ActiveMeetingProps) {
  // View state
  const [isWhiteboardMode, setIsWhiteboardMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  
  // Translation state
  const [isTranslationOpen, setIsTranslationOpen] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState<TargetLanguage>('ko');
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>('en');
  
  // Chat state
  const [unreadCount, setUnreadCount] = useState(0);
  const [voiceRecords, setVoiceRecords] = useState<VoiceRecord[]>([]);
  
  // Subtitle state
  const [currentSpeaker, setCurrentSpeaker] = useState<{ name: string; profileImg?: string; isLocal?: boolean } | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string | null>(null);
  const [currentOriginal, setCurrentOriginal] = useState<string | null>(null);
  const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // LiveKit
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone]);

  // Media states
  const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const isCameraEnabled = localParticipant?.isCameraEnabled ?? false;
  const isScreenSharing = localParticipant?.isScreenShareEnabled ?? false;

  // Update local participant metadata with source language
  useEffect(() => {
    if (!localParticipant?.sid) return;

    const updateMetadata = async () => {
      try {
        let existingMetadata: Record<string, unknown> = {};
        if (localParticipant.metadata) {
          try {
            existingMetadata = JSON.parse(localParticipant.metadata);
          } catch {
            // Ignore parse errors
          }
        }

        const newMetadata = {
          ...existingMetadata,
          sourceLanguage,
          profileImg: currentUser.profileImg,
        };

        const newMetadataStr = JSON.stringify(newMetadata);
        if (localParticipant.metadata === newMetadataStr) return;

        await localParticipant.setMetadata(newMetadataStr);
      } catch (err) {
        console.warn('[ActiveMeeting] Failed to update metadata:', err);
      }
    };

    const timeoutId = setTimeout(updateMetadata, 500);
    return () => clearTimeout(timeoutId);
  }, [localParticipant, sourceLanguage, currentUser.profileImg]);

  // Handle transcript data
  const handleTranscript = useCallback((data: RoomTranscriptData) => {
    const speaker = data.participantName || data.participantId;
    const hasTranslation = data.translated && data.translated.length > 0;

    setVoiceRecords(prev => {
      const lastIndex = prev.findLastIndex(r => r.speaker === speaker);
      const lastRecord = lastIndex >= 0 ? prev[lastIndex] : null;
      const showTranslation = isTranslationOpen && hasTranslation;

      if (!data.isFinal) {
        const isLastRecordPartial = lastRecord && !lastRecord._isFinal;
        
        if (isLastRecordPartial) {
          const updated = [...prev];
          updated[lastIndex] = {
            ...lastRecord,
            original: data.original,
            translated: showTranslation ? data.translated : undefined,
            sourceLanguage: data.language || lastRecord.sourceLanguage,
            targetLanguage: showTranslation ? targetLanguage : undefined,
          };
          return updated;
        }
        
        return [...prev, {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          speaker,
          profileImg: data.profileImg,
          original: data.original,
          translated: showTranslation ? data.translated : undefined,
          sourceLanguage: data.language,
          targetLanguage: showTranslation ? targetLanguage : undefined,
          timestamp: Date.now(),
          _isFinal: false,
        } as VoiceRecord];
      }

      const isLastRecordPartial = lastRecord && !lastRecord._isFinal;
      
      if (isLastRecordPartial) {
        const updated = [...prev];
        updated[lastIndex] = {
          ...lastRecord,
          original: data.original,
          translated: isTranslationOpen && hasTranslation ? data.translated : undefined,
          sourceLanguage: data.language || lastRecord.sourceLanguage,
          targetLanguage: isTranslationOpen && hasTranslation ? targetLanguage : undefined,
          _isFinal: true,
        };
        return updated;
      }

      return [...prev, {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        speaker,
        profileImg: data.profileImg,
        original: data.original,
        translated: isTranslationOpen && hasTranslation ? data.translated : undefined,
        sourceLanguage: data.language,
        targetLanguage: isTranslationOpen && hasTranslation ? targetLanguage : undefined,
        timestamp: Date.now(),
        _isFinal: true,
      } as VoiceRecord];
    });

    // Show subtitle
    if (isTranslationOpen && hasTranslation) {
      setCurrentSpeaker({
        name: data.participantName || data.participantId,
        profileImg: data.profileImg,
        isLocal: false,
      });
      setCurrentOriginal(data.original);
      setCurrentTranscript(data.translated ?? null);

      if (transcriptTimeoutRef.current) {
        clearTimeout(transcriptTimeoutRef.current);
      }
      transcriptTimeoutRef.current = setTimeout(() => {
        setCurrentTranscript(null);
        setCurrentOriginal(null);
        setCurrentSpeaker(null);
      }, 3000);
    }
  }, [isTranslationOpen, targetLanguage]);

  // Load existing transcripts
  useEffect(() => {
    if (!roomId) return;

    const loadExistingTranscripts = async () => {
      try {
        const response = await apiClient.getRoomTranscripts(roomId);
        if (response.transcripts && response.transcripts.length > 0) {
          const existingRecords: VoiceRecord[] = response.transcripts.map((t) => ({
            id: `${t.timestamp}-${t.speakerId}`,
            speaker: t.speakerName || t.speakerId,
            original: t.original,
            translated: t.translated,
            sourceLanguage: t.sourceLang,
            targetLanguage: t.targetLang,
            timestamp: new Date(t.timestamp).getTime(),
            _isFinal: t.isFinal,
          }));
          setVoiceRecords(existingRecords);
        }
      } catch (err) {
        console.warn('[ActiveMeeting] Failed to load existing transcripts:', err);
      }
    };

    loadExistingTranscripts();
  }, [roomId]);

  // Room translation hook
  const { isActive: isTranslationActive } = useRoomTranslation({
    roomId,
    enabled: true,
    targetLanguage,
    listenerId: localParticipant?.identity,
    autoPlayTTS: isTranslationOpen,
    onTranscript: handleTranscript,
  });

  // Handlers
  const toggleMic = useCallback(async () => {
    await localParticipant?.setMicrophoneEnabled(!isMicEnabled);
  }, [localParticipant, isMicEnabled]);

  const toggleCamera = useCallback(async () => {
    await localParticipant?.setCameraEnabled(!isCameraEnabled);
  }, [localParticipant, isCameraEnabled]);

  const toggleScreen = useCallback(async () => {
    await localParticipant?.setScreenShareEnabled(!isScreenSharing);
  }, [localParticipant, isScreenSharing]);

  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => {
      if (!prev) setUnreadCount(0);
      return !prev;
    });
  }, []);

  const toggleWhiteboard = useCallback(() => {
    setIsWhiteboardMode(prev => !prev);
  }, []);

  const toggleTranslation = useCallback(() => {
    setIsTranslationOpen(prev => !prev);
  }, []);

  const handleNewMessage = useCallback(() => {
    if (!isChatOpen) setUnreadCount(prev => prev + 1);
  }, [isChatOpen]);

  // Close language dropdown when clicking outside
  useEffect(() => {
    if (!showLanguageDropdown) return;
    
    const handleClick = () => setShowLanguageDropdown(false);
    
    // Add listener on next tick to avoid immediate closure from same click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClick);
    };
  }, [showLanguageDropdown]);

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      <RoomAudioRenderer />
      
      {/* Top Bar */}
      <MeetingTopBar
        roomTitle={roomTitle}
        isWhiteboardMode={isWhiteboardMode}
        onToggleMode={toggleWhiteboard}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Whiteboard / Video Area (75%) */}
        <div className="flex-1 bg-stone-50 overflow-hidden">
          {isWhiteboardMode ? (
            <div className="h-full p-4">
              <div className="h-full bg-white rounded-xl border border-black/[0.06] overflow-hidden">
                <WhiteboardCanvas />
              </div>
            </div>
          ) : (
            <div className="h-full p-4">
              {/* Video Grid Placeholder - In non-whiteboard mode, videos are in sidebar */}
              <div className="h-full bg-white rounded-xl border border-black/[0.06] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-black/[0.04] flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-black/40">비디오는 오른쪽 사이드바에 표시됩니다</p>
                  <p className="text-xs text-black/30 mt-1">화이트보드 모드로 전환하여 협업하세요</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Video Sidebar (25%) */}
        <div className="w-72 flex-shrink-0">
          <VideoSidebar currentUser={currentUser} />
        </div>
      </div>

      {/* Control Bar */}
      <MeetingControlBar
        isMicEnabled={isMicEnabled}
        isCameraEnabled={isCameraEnabled}
        isScreenSharing={isScreenSharing}
        isChatOpen={isChatOpen}
        isWhiteboardOpen={isWhiteboardMode}
        isTranslationOpen={isTranslationOpen}
        sourceLanguage={sourceLanguage}
        targetLanguage={targetLanguage}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreen={toggleScreen}
        onToggleChat={toggleChat}
        onToggleWhiteboard={toggleWhiteboard}
        onToggleTranslation={toggleTranslation}
        onSourceLanguageChange={setSourceLanguage}
        onTargetLanguageChange={setTargetLanguage}
        onLeave={onLeave}
        unreadChatCount={unreadCount}
        showLanguageDropdown={showLanguageDropdown}
        onToggleLanguageDropdown={() => setShowLanguageDropdown(prev => !prev)}
      />

      {/* Chat Panel */}
      <div className={`
        fixed top-14 right-0 bottom-0 w-80 z-40
        transform transition-transform duration-300 ease-out
        ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <ChatPanel
          roomId={roomId}
          onClose={toggleChat}
          onNewMessage={handleNewMessage}
          voiceRecords={voiceRecords}
        />
      </div>

      {/* Subtitle Overlay */}
      <SubtitlePills
        text={currentTranscript}
        originalText={currentOriginal}
        speaker={currentSpeaker || undefined}
        isActive={isTranslationActive}
        showTranslation={isTranslationOpen}
      />
    </div>
  );
}
