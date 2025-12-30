interface EmptyStateProps {
  searchQuery: string;
  onUploadClick: () => void;
}

export default function EmptyState({ searchQuery, onUploadClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {searchQuery ? `"${searchQuery}" 검색 결과 없음` : "파일이 없습니다"}
      </p>
      {!searchQuery && (
        <button
          onClick={onUploadClick}
          className="text-sm text-gray-900 hover:underline"
        >
          파일 업로드
        </button>
      )}
    </div>
  );
}
