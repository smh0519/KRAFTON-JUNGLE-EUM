"use client";

const CATEGORY_COLORS = ["#737373", "#a3a3a3", "#6366f1", "#22c55e", "#ef4444", "#f97316"];

interface CategoryModalProps {
  isOpen: boolean;
  categoryName: string;
  categoryColor: string;
  isEditing: boolean;
  isLoading: boolean;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function CategoryModal({
  isOpen,
  categoryName,
  categoryColor,
  isEditing,
  isLoading,
  onNameChange,
  onColorChange,
  onSubmit,
  onClose,
}: CategoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="bg-[#222] w-full max-w-xs relative z-10">
        <div className="p-5 space-y-4">
          <input
            type="text"
            value={categoryName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="카테고리 이름"
            className="w-full bg-transparent border-b border-white/20 focus:border-white/50 py-2 text-white placeholder:text-white/30 outline-none transition-colors"
            autoFocus
          />

          <div className="flex gap-1.5">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onColorChange(color)}
                className={`w-6 h-6 ${categoryColor === color ? "ring-1 ring-white" : ""}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="flex border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={!categoryName.trim() || isLoading}
            className="flex-1 py-3 text-sm text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isLoading ? "..." : (isEditing ? "수정" : "생성")}
          </button>
        </div>
      </div>
    </div>
  );
}
