import { WorkspaceFile } from "../../../../lib/api";

// React InputHTMLAttributes 확장
declare module "react" {
  interface InputHTMLAttributes<T> extends React.HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

// FileSystem API Types
export interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}

export interface FileSystemFileEntry extends FileSystemEntry {
  file: (callback: (file: File) => void) => void;
}

export interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader: () => FileSystemDirectoryReader;
}

export interface FileSystemDirectoryReader {
  readEntries: (callback: (entries: FileSystemEntry[]) => void) => void;
}

// Component Props
export interface StorageSectionProps {
  workspaceId: number;
}

export interface FileListViewProps {
  files: WorkspaceFile[];
  selectedFile: WorkspaceFile | null;
  workspaceId: number;
  onFileClick: (file: WorkspaceFile) => void;
  onRename: (file: WorkspaceFile) => void;
  onDelete: (file: WorkspaceFile) => void;
}

export interface FileGridViewProps {
  files: WorkspaceFile[];
  selectedFile: WorkspaceFile | null;
  workspaceId: number;
  onFileClick: (file: WorkspaceFile) => void;
  onRename: (file: WorkspaceFile) => void;
  onDelete: (file: WorkspaceFile) => void;
}

export interface StorageHeaderProps {
  fileStats: FileStats;
  filesCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  isUploading: boolean;
  uploadProgress: number;
  uploadStatus: string;
  uploadError: string | null;
  onUploadErrorClear: () => void;
  onCreateFolder: () => void;
  onFileUpload: () => void;
  onFolderUpload: () => void;
  currentFolderId?: number;
  breadcrumbs: WorkspaceFile[];
  onBreadcrumbClick: (folderId?: number) => void;
}

export interface FileStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  imageCount: number;
  documentCount: number;
  videoCount: number;
  otherCount: number;
}

export interface UploadFileItem {
  file: File;
  path: string;
}

// Modal Props
export interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  isCreating: boolean;
}

export interface RenameModalProps {
  isOpen: boolean;
  file: WorkspaceFile | null;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  isRenaming: boolean;
}

export interface MediaPreviewModalProps {
  file: WorkspaceFile | null;
  mediaUrl: string | null;
  onClose: () => void;
}

export interface DeleteModalProps {
  isOpen: boolean;
  file: WorkspaceFile | null;
  onClose: () => void;
  onDelete: () => Promise<void>;
  isDeleting: boolean;
}

export type { WorkspaceFile };
