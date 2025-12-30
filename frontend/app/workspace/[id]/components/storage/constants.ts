// 파일 타입별 스타일 설정
export const FILE_TYPE_CONFIG = {
  folder: { bgColor: "bg-gray-100", textColor: "text-gray-500" },
  image: { bgColor: "bg-gray-100", textColor: "text-gray-500" },
  document: { bgColor: "bg-gray-100", textColor: "text-gray-500" },
  video: { bgColor: "bg-gray-100", textColor: "text-gray-500" },
  audio: { bgColor: "bg-gray-100", textColor: "text-gray-500" },
  code: { bgColor: "bg-gray-100", textColor: "text-gray-500" },
  default: { bgColor: "bg-gray-100", textColor: "text-gray-500" },
} as const;

export type FileTypeKey = keyof typeof FILE_TYPE_CONFIG;
