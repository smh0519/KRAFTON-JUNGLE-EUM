export default function DragOverlay() {
  return (
    <div className="absolute inset-0 bg-black/60 border-2 border-dashed border-white/20 z-50 flex items-center justify-center pointer-events-none backdrop-blur-sm">
      <div className="text-center">
        <svg className="w-8 h-8 text-white/40 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-sm text-white/60">파일을 놓으세요</p>
      </div>
    </div>
  );
}
