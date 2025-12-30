import { useState, useRef, useCallback } from "react";
import { apiClient } from "../../../../../lib/api";
import { WorkspaceFile, UploadFileItem, FileSystemEntry, FileSystemFileEntry, FileSystemDirectoryEntry } from "../types";

interface UseFileUploadProps {
  workspaceId: number;
  currentFolderId?: number;
  onFilesChange: React.Dispatch<React.SetStateAction<WorkspaceFile[]>>;
  onUploadComplete: () => void;
}

interface UseFileUploadReturn {
  isUploading: boolean;
  uploadProgress: number;
  uploadStatus: string;
  uploadError: string | null;
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  setUploadError: (error: string | null) => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => Promise<void>;
}

export function useFileUpload({
  workspaceId,
  currentFolderId,
  onFilesChange,
  onUploadComplete,
}: UseFileUploadProps): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const uploadSingleFile = useCallback(async (file: File, parentId?: number): Promise<WorkspaceFile> => {
    const presigned = await apiClient.getPresignedURL(
      workspaceId,
      file.name,
      file.type || "application/octet-stream",
      parentId
    );

    await apiClient.uploadFileToS3(presigned.upload_url, file);

    const uploadedFile = await apiClient.confirmUpload(workspaceId, {
      name: file.name,
      key: presigned.key,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      parent_folder_id: parentId,
    });

    return uploadedFile;
  }, [workspaceId]);

  const processAndUploadFiles = useCallback(async (fileList: UploadFileItem[]) => {
    if (fileList.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("폴더 구조 분석 중...");
    setUploadError(null);

    try {
      const totalFiles = fileList.length;
      let uploadedCount = 0;

      const folderPathMap = new Map<string, number>();

      for (const { file, path } of fileList) {
        const pathParts = path.split('/').filter(p => p !== ".");

        let parentId = currentFolderId;
        let currentPath = "";

        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderName = pathParts[i];
          if (!folderName) continue;

          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

          if (folderPathMap.has(currentPath)) {
            parentId = folderPathMap.get(currentPath);
          } else {
            setUploadStatus(`폴더 생성 중: ${folderName}`);
            const newFolder = await apiClient.createFolder(workspaceId, folderName, parentId);
            parentId = newFolder.id;
            folderPathMap.set(currentPath, parentId);

            if (newFolder.parent_folder_id === currentFolderId) {
              onFilesChange(prev => [newFolder, ...prev]);
            }
          }
        }

        setUploadStatus(`업로드 중: ${file.name}`);
        const uploadedFile = await uploadSingleFile(file, parentId);

        if (uploadedFile.parent_folder_id === currentFolderId) {
          onFilesChange(prev => [uploadedFile, ...prev]);
        }

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      onUploadComplete();
    } catch (error) {
      console.error("Failed to upload:", error);
      setUploadError("업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }, [workspaceId, currentFolderId, onFilesChange, onUploadComplete, uploadSingleFile]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;
    const fileList = Array.from(selectedFiles).map(file => ({ file, path: file.name }));
    processAndUploadFiles(fileList);
  }, [processAndUploadFiles]);

  const handleFolderUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;
    const fileList = Array.from(selectedFiles).map(file => ({ file, path: file.webkitRelativePath || file.name }));
    processAndUploadFiles(fileList);
  }, [processAndUploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    const fileList: UploadFileItem[] = [];

    const scanEntry = (entry: FileSystemEntry): Promise<void> => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          (entry as FileSystemFileEntry).file((file) => {
            const path = entry.fullPath.startsWith('/') ? entry.fullPath.slice(1) : entry.fullPath;
            fileList.push({ file, path });
            resolve();
          });
        } else if (entry.isDirectory) {
          const dirReader = (entry as FileSystemDirectoryEntry).createReader();
          dirReader.readEntries(async (entries) => {
            for (const childEntry of entries) {
              await scanEntry(childEntry);
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    };

    setUploadStatus("파일 목록 스캔 중...");

    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          promises.push(scanEntry(entry));
        } else {
          const file = item.getAsFile();
          if (file) {
            fileList.push({ file, path: file.name });
          }
        }
      }
    }

    await Promise.all(promises);
    processAndUploadFiles(fileList);
  }, [processAndUploadFiles]);

  return {
    isUploading,
    uploadProgress,
    uploadStatus,
    uploadError,
    isDragging,
    fileInputRef,
    folderInputRef,
    setUploadError,
    handleFileUpload,
    handleFolderUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
