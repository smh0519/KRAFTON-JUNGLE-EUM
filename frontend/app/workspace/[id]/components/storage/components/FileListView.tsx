"use client";

import { useState, useEffect } from "react";
import { FileListViewProps, WorkspaceFile } from "../types";
import { formatFileSize, formatDate, isImageFile, isVideoFile, isMediaFile } from "../utils";
import { apiClient } from "../../../../../lib/api";
import FileIcon from "./FileIcon";

// 개별 파일 아이템 컴포넌트
function FileListItem({
  file,
  isSelected,
  workspaceId,
  onFileClick,
  onRename,
  onDelete,
}: {
  file: WorkspaceFile;
  isSelected: boolean;
  workspaceId: number;
  onFileClick: (file: WorkspaceFile) => void;
  onRename: (file: WorkspaceFile) => void;
  onDelete: (file: WorkspaceFile) => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isImage = isImageFile(file);
  const isVideo = isVideoFile(file);
  const isMedia = isMediaFile(file);

  // 미디어 파일인 경우 썸네일 URL 가져오기
  useEffect(() => {
    if (!isMedia || file.type === "FOLDER") return;

    const fetchThumbnail = async () => {
      setIsLoading(true);
      try {
        const { url } = await apiClient.getDownloadURL(workspaceId, file.id);
        setThumbnailUrl(url);
      } catch {
        // file_url이 있으면 폴백으로 사용
        if (file.file_url) {
          setThumbnailUrl(file.file_url);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchThumbnail();
  }, [file.id, file.file_url, file.type, isMedia, workspaceId]);

  const showThumbnail = isMedia && thumbnailUrl && !mediaError;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group transition-all ${isSelected ? "bg-white/10" : "hover:bg-white/5"
        }`}
      onClick={() => onFileClick(file)}
    >
      {/* Icon / Thumbnail */}
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <img
              src="/logo_black.png"
              alt=""
              className="w-5 h-5 object-contain opacity-20 animate-pulse"
            />
          </div>
        )}
        {showThumbnail ? (
          <>
            {isVideo ? (
              <video
                src={thumbnailUrl}
                className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-300"
                onError={() => setMediaError(true)}
                muted
                preload="metadata"
              />
            ) : (
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-300"
                onError={() => setMediaError(true)}
              />
            )}
            {/* 동영상 플레이 아이콘 오버레이 */}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}
          </>
        ) : !isLoading && (
          <FileIcon file={file} size="md" />
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{file.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {file.uploader && (
            <>
              {file.uploader.profile_img ? (
                <img
                  src={file.uploader.profile_img}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-[8px] font-medium text-white/70">
                    {file.uploader.nickname?.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-xs text-white/40">{file.uploader.nickname}</span>
              <span className="text-xs text-white/20">·</span>
            </>
          )}
          {file.file_size && (
            <>
              <span className="text-xs text-white/40">{formatFileSize(file.file_size)}</span>
              <span className="text-xs text-white/20">·</span>
            </>
          )}
          <span className="text-xs text-white/40">{formatDate(file.created_at)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onRename(file); }}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(file); }}
          className="p-1.5 rounded-lg text-white/40 hover:text-red-500 hover:bg-red-500/10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function FileListView({
  files,
  selectedFile,
  workspaceId,
  onFileClick,
  onRename,
  onDelete,
}: FileListViewProps) {
  return (
    <div className="space-y-0.5">
      {files.map((file) => (
        <FileListItem
          key={file.id}
          file={file}
          isSelected={selectedFile?.id === file.id}
          workspaceId={workspaceId}
          onFileClick={onFileClick}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
