"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WorkspaceCategory } from "../../lib/api";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";

interface CategoryTabsProps {
  categories: WorkspaceCategory[];
  selectedCategoryId: number | null;
  dragOverCategoryId: number | "uncategorized" | null;
  categoryMenuOpen: number | null;
  totalWorkspaces: number;
  onCategoryChange: (categoryId: number | null) => void;
  onCategoryReorder: (newOrder: WorkspaceCategory[]) => void;
  onDragOver: (e: React.DragEvent, categoryId: number | "uncategorized") => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, categoryId: number | "uncategorized") => void;
  onMenuToggle: (categoryId: number | null) => void;
  onEditCategory: (category: WorkspaceCategory) => void;
  onDeleteCategory: (categoryId: number) => void;
  onAddCategory: () => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

interface SortableCategoryProps {
  category: WorkspaceCategory;
  isSelected: boolean;
  isDragOver: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function SortableCategory({
  category,
  isSelected,
  isDragOver,
  isHovered,
  onSelect,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
  onMouseEnter,
  onMouseLeave,
}: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex-shrink-0"
      {...attributes}
      {...listeners}
    >
      <button
        onClick={onSelect}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`flex items-center gap-2 px-4 py-2 text-sm transition-all cursor-grab active:cursor-grabbing ${
          isDragOver
            ? "ring-2 ring-white/50 scale-105"
            : isSelected
            ? "text-white font-medium"
            : "text-white/60 hover:text-white"
        }`}
        style={{
          backgroundColor: isDragOver
            ? `${category.color}66`
            : isSelected
            ? category.color
            : isHovered
            ? `${category.color}30`
            : "#222",
        }}
      >
        <span>{category.name}</span>
        {category.workspace_count !== undefined && (
          <span className={isSelected ? "text-white/70" : "text-white/30"}>
            {category.workspace_count}
          </span>
        )}
      </button>
    </div>
  );
}

export function CategoryTabs({
  categories,
  selectedCategoryId,
  dragOverCategoryId,
  categoryMenuOpen,
  totalWorkspaces,
  onCategoryChange,
  onCategoryReorder,
  onDragOver,
  onDragLeave,
  onDrop,
  onMenuToggle,
  onEditCategory,
  onDeleteCategory,
  onAddCategory,
}: CategoryTabsProps) {
  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [contextMenuCategory, setContextMenuCategory] = useState<WorkspaceCategory | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleContextMenu = (e: React.MouseEvent, category: WorkspaceCategory) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuCategory(category);
    onMenuToggle(category.id);
  };

  const closeMenu = () => {
    onMenuToggle(null);
    setMenuPosition(null);
    setContextMenuCategory(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      const newOrder = arrayMove(categories, oldIndex, newIndex);
      onCategoryReorder(newOrder);
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {/* All */}
      <button
        onClick={() => onCategoryChange(null)}
        onDragOver={(e) => onDragOver(e, "uncategorized")}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, "uncategorized")}
        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm transition-all ${
          dragOverCategoryId === "uncategorized"
            ? "bg-white/20 ring-2 ring-white/50 scale-105"
            : selectedCategoryId === null
            ? "bg-white text-[#1a1a1a] font-medium"
            : "bg-[#222] text-white/60 hover:text-white hover:bg-[#2a2a2a]"
        }`}
      >
        <span>전체</span>
        {totalWorkspaces > 0 && (
          <span className={selectedCategoryId === null ? "text-[#1a1a1a]/60" : "text-white/30"}>
            {totalWorkspaces}
          </span>
        )}
      </button>

      {/* Sortable Category Buttons */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categories.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          {categories.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            const isDragOver = dragOverCategoryId === category.id;
            const isHovered = hoveredCategoryId === category.id && !isSelected && !isDragOver;

            return (
              <SortableCategory
                key={category.id}
                category={category}
                isSelected={isSelected}
                isDragOver={isDragOver}
                isHovered={isHovered}
                onSelect={() => onCategoryChange(category.id)}
                onContextMenu={(e) => handleContextMenu(e, category)}
                onDragOver={(e) => onDragOver(e, category.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, category.id)}
                onMouseEnter={() => setHoveredCategoryId(category.id)}
                onMouseLeave={() => setHoveredCategoryId(null)}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      {/* Context Menu Dropdown */}
      {categoryMenuOpen !== null && menuPosition && contextMenuCategory && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeMenu();
            }}
          />
          <div
            className="fixed w-36 bg-[#252525] border border-white/10 rounded-lg overflow-hidden z-50 shadow-xl"
            style={{
              left: menuPosition.x,
              top: menuPosition.y,
            }}
          >
            <button
              onClick={() => {
                onEditCategory(contextMenuCategory);
                closeMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
            >
              <Pencil size={14} />
              수정
            </button>
            <button
              onClick={() => {
                onDeleteCategory(contextMenuCategory.id);
                closeMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
              삭제
            </button>
          </div>
        </>
      )}

      {/* Add Category Button */}
      <button
        onClick={onAddCategory}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm text-white/40 hover:text-white/70 bg-[#222] hover:bg-[#262626] transition-colors"
      >
        <FolderPlus size={14} />
        <span>카테고리</span>
      </button>
    </div>
  );
}
