"use client";

import { useState, useEffect, useRef } from "react";
import { StorageHeaderProps } from "../types";

export default function StorageHeader({
  fileStats,
  filesCount,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  isUploading,
  uploadProgress,
  uploadStatus,
  uploadError,
  onUploadErrorClear,
  onCreateFolder,
  onFileUpload,
  onFolderUpload,
  currentFolderId,
  breadcrumbs,
  onBreadcrumbClick,
}: StorageHeaderProps) {
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNewDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="px-6 py-4 border-b border-white/5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-white">저장소</h1>
          {filesCount > 0 && (
            <p className="text-xs text-white/40 mt-0.5">
              {fileStats.totalFolders > 0 && `${fileStats.totalFolders}개 폴더`}
              {fileStats.totalFolders > 0 && fileStats.totalFiles > 0 && " · "}
              {fileStats.totalFiles > 0 && `${fileStats.totalFiles}개 파일`}
            </p>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNewDropdown(!showNewDropdown)}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>{uploadProgress}%</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                파일 추가
              </>
            )}
          </button>

          {showNewDropdown && !isUploading && (
            <div className="absolute top-full right-0 mt-1 w-40 bg-[#2a2a2a] rounded-lg shadow-lg border border-white/5 py-1 z-50">
              <button
                onClick={() => {
                  onCreateFolder();
                  setShowNewDropdown(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                새 폴더
              </button>
              <button
                onClick={() => {
                  onFileUpload();
                  setShowNewDropdown(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                파일 업로드
              </button>
              <button
                onClick={() => {
                  onFolderUpload();
                  setShowNewDropdown(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                폴더 업로드
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>{uploadStatus}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 rounded-lg text-sm text-red-500 flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={onUploadErrorClear} className="text-red-400 hover:text-red-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search & View Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-black/20 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/10"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex items-center border border-white/5 rounded-lg">
          <button
            onClick={() => onViewModeChange("list")}
            className={`p-1.5 ${viewMode === "list" ? "text-white bg-white/10" : "text-white/40 hover:text-white"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => onViewModeChange("grid")}
            className={`p-1.5 ${viewMode === "grid" ? "text-white bg-white/10" : "text-white/40 hover:text-white"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      {currentFolderId && (
        <div className="flex items-center gap-1 mt-3 text-sm">
          <button
            onClick={() => onBreadcrumbClick(undefined)}
            className="text-white/40 hover:text-white"
          >
            저장소
          </button>
          {breadcrumbs.map((folder, index) => (
            <div key={folder.id} className="flex items-center gap-1">
              <span className="text-white/30">/</span>
              <button
                onClick={() => onBreadcrumbClick(folder.id)}
                className={index === breadcrumbs.length - 1 ? "text-white" : "text-white/40 hover:text-white"}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
