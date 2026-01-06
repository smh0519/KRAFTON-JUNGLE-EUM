"use client";

import { useState, useEffect } from "react";
import { FileGridViewProps, WorkspaceFile } from "../types";
import { formatDate, isImageFile, isVideoFile, isMediaFile } from "../utils";
import { apiClient } from "../../../../../lib/api";
import FileIcon from "./FileIcon";

// 개별 그리드 아이템 컴포넌트
function FileGridItem({
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
      className={`group relative rounded-xl border cursor-pointer transition-all ${isSelected
          ? "border-white/30 bg-white/10 shadow-sm"
          : "border-white/5 hover:border-white/10 hover:bg-white/5 hover:shadow-sm"
        }`}
      onClick={() => onFileClick(file)}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-white/5 rounded-t-xl flex items-center justify-center overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <img
              src="/logo_black.png"
              alt=""
              className="w-10 h-10 object-contain opacity-20 animate-pulse"
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}
          </>
        ) : !isLoading && (
          <FileIcon file={file} size="lg" />
        )}
      </div>
      {/* Info */}
      <div className="p-2.5">
        <p className="text-sm text-white truncate">{file.name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {file.uploader && (
            <>
              {file.uploader.profile_img ? (
                <img
                  src={file.uploader.profile_img}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-medium text-white/70">
                    {file.uploader.nickname?.charAt(0)}
                  </span>
                </div>
              )}
            </>
          )}
          <span className="text-xs text-white/30 truncate">
            {file.uploader?.nickname && `${file.uploader.nickname} · `}
            {formatDate(file.created_at)}
          </span>
        </div>
      </div>
      {/* Hover Actions */}
      <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onRename(file); }}
          className="p-1.5 rounded-lg bg-[#333]/90 backdrop-blur text-white/50 hover:text-white shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(file); }}
          className="p-1.5 rounded-lg bg-[#333]/90 backdrop-blur text-white/50 hover:text-red-500 shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function FileGridView({
  files,
  selectedFile,
  workspaceId,
  onFileClick,
  onRename,
  onDelete,
}: FileGridViewProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {files.map((file) => (
        <FileGridItem
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
