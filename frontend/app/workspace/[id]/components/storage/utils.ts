import { WorkspaceFile } from "./types";

// 파일 크기 포맷
export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// 날짜 포맷 (상대 시간)
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
};

// 파일 확장자 추출
export const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toUpperCase() || "" : "";
};

// 이미지 파일 여부 확인
export const isImageFile = (file: WorkspaceFile): boolean => {
  return file.mime_type?.startsWith("image/") || false;
};

// 동영상 파일 여부 확인
export const isVideoFile = (file: WorkspaceFile): boolean => {
  return file.mime_type?.startsWith("video/") || false;
};

// 미디어 파일 여부 확인 (이미지 + 동영상)
export const isMediaFile = (file: WorkspaceFile): boolean => {
  return isImageFile(file) || isVideoFile(file);
};

// 파일 타입 구분
export const getFileType = (file: WorkspaceFile): string => {
  if (file.type === "FOLDER") return "folder";
  const mimeType = file.mime_type || "";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("word")) return "document";
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("html") || mimeType.includes("css")) return "code";
  return "default";
};
