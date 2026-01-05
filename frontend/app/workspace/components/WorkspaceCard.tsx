"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Workspace, WorkspaceCategory } from "../../lib/api";
import { filterActiveMembers } from "../../lib/utils";

interface WorkspaceCardProps {
  workspace: Workspace;
  categories: WorkspaceCategory[];
  workspaceCategoryMap: Record<number, number[]>;
  onClick: () => void;
}

export function WorkspaceCard({
  workspace,
  categories,
  workspaceCategoryMap,
  onClick,
}: WorkspaceCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: workspace.id });

  const activeMembers = filterActiveMembers(workspace.members || []);
  const displayMembers = activeMembers.slice(0, 5);
  const wsCategories = workspaceCategoryMap[workspace.id] || [];

  // Get the first category's color for hover border
  const primaryCategory = wsCategories.length > 0
    ? categories.find(c => c.id === wsCategories[0])
    : null;
  const categoryColor = primaryCategory?.color;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    // CSS custom property for hover border color
    "--category-color": categoryColor || "transparent",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group touch-none ${
        isDragging ? "opacity-50 scale-[1.02] z-50" : ""
      } ${isOver ? "ring-2 ring-white/40" : ""}`}
      {...attributes}
      {...listeners}
    >
      {/* Hover border overlay */}
      {categoryColor && !isDragging && (
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
          style={{ boxShadow: `inset 0 0 0 2px ${categoryColor}` }}
        />
      )}
      <button
        onClick={onClick}
        className={`w-full p-5 bg-[#222] group-hover:bg-[#262626] transition-colors text-left cursor-grab active:cursor-grabbing ${
          isDragging ? "shadow-2xl shadow-black/50" : ""
        }`}
      >

        {/* Name */}
        <h3 className="text-base font-medium text-white truncate mb-1">
          {workspace.name}
        </h3>

        {/* Member count */}
        <p className="text-sm text-white/40 mb-4">
          멤버 {activeMembers.length}명
        </p>

        {/* Avatars */}
        <div className="flex items-center -space-x-2">
          {displayMembers.map((member) => (
            <div
              key={member.id}
              className="w-7 h-7 rounded-full bg-white/15 ring-2 ring-[#222] group-hover:ring-[#262626] overflow-hidden transition-colors"
            >
              {member.user?.profile_img ? (
                <img src={member.user.profile_img} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[10px] text-white/50">{member.user?.nickname?.charAt(0)}</span>
                </div>
              )}
            </div>
          ))}
          {activeMembers.length > 5 && (
            <div className="w-7 h-7 rounded-full bg-white/10 ring-2 ring-[#222] group-hover:ring-[#262626] flex items-center justify-center transition-colors">
              <span className="text-[10px] text-white/50">+{activeMembers.length - 5}</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

// Overlay component for drag preview
export function WorkspaceCardOverlay({
  workspace,
  categories,
  workspaceCategoryMap,
}: Omit<WorkspaceCardProps, "onClick">) {
  const activeMembers = filterActiveMembers(workspace.members || []);
  const displayMembers = activeMembers.slice(0, 5);
  const wsCategories = workspaceCategoryMap[workspace.id] || [];

  return (
    <div className="w-[300px] opacity-90 rotate-2 shadow-2xl shadow-black/50">
      <div className="p-5 bg-[#2a2a2a] text-left">

        {/* Name */}
        <h3 className="text-base font-medium text-white truncate mb-1">
          {workspace.name}
        </h3>

        {/* Member count */}
        <p className="text-sm text-white/40 mb-4">
          멤버 {activeMembers.length}명
        </p>

        {/* Avatars */}
        <div className="flex items-center -space-x-2">
          {displayMembers.map((member) => (
            <div
              key={member.id}
              className="w-7 h-7 rounded-full bg-white/15 ring-2 ring-[#2a2a2a] overflow-hidden"
            >
              {member.user?.profile_img ? (
                <img src={member.user.profile_img} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[10px] text-white/50">{member.user?.nickname?.charAt(0)}</span>
                </div>
              )}
            </div>
          ))}
          {activeMembers.length > 5 && (
            <div className="w-7 h-7 rounded-full bg-white/10 ring-2 ring-[#2a2a2a] flex items-center justify-center">
              <span className="text-[10px] text-white/50">+{activeMembers.length - 5}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
