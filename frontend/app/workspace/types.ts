import { Workspace, WorkspaceCategory } from "../lib/api";

export interface DropTarget {
  workspaceId: number;
  position: "before" | "after";
}

export interface WorkspaceCardProps {
  workspace: Workspace;
  categories: WorkspaceCategory[];
  workspaceCategoryMap: Record<number, number[]>;
  draggingWorkspaceId: number | null;
  dropTarget: DropTarget | null;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

export interface CategoryTabsProps {
  categories: WorkspaceCategory[];
  selectedCategoryId: number | null;
  dragOverCategoryId: number | "uncategorized" | null;
  categoryMenuOpen: number | null;
  onCategoryChange: (categoryId: number | null) => void;
  onDragOver: (e: React.DragEvent, categoryId: number | "uncategorized") => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, categoryId: number | "uncategorized") => void;
  onMenuToggle: (categoryId: number | null) => void;
  onEditCategory: (category: WorkspaceCategory) => void;
  onDeleteCategory: (categoryId: number) => void;
  onAddCategory: () => void;
}

export interface WorkspaceGridProps {
  workspaces: Workspace[];
  categories: WorkspaceCategory[];
  workspaceCategoryMap: Record<number, number[]>;
  selectedCategoryId: number | null;
  draggingWorkspaceId: number | null;
  dragOverCategoryId: number | "uncategorized" | null;
  dropTarget: DropTarget | null;
  isTransitioning: boolean;
  sortWorkspaces: (workspaceList: Workspace[], categoryKey: string) => Workspace[];
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, categoryId: number | "uncategorized") => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, categoryId: number | "uncategorized") => void;
  onWorkspaceDragOver: (e: React.DragEvent, workspaceId: number) => void;
  onWorkspaceDrop: (e: React.DragEvent, targetWorkspaceId: number, categoryKey: string, workspaceList: Workspace[]) => void;
  onWorkspaceClick: (workspaceId: number) => void;
}

export interface CategoryModalProps {
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

export interface CreateWorkspaceModalProps {
  isOpen: boolean;
  isClosing: boolean;
  step: 1 | 2;
  workspaceName: string;
  searchQuery: string;
  searchResults: Array<{ id: number; nickname: string; email: string; profile_img?: string }>;
  selectedMembers: Array<{ id: number; nickname: string; email: string; profile_img?: string }>;
  isSearching: boolean;
  isCreating: boolean;
  onWorkspaceNameChange: (name: string) => void;
  onSearchQueryChange: (query: string) => void;
  onAddMember: (user: { id: number; nickname: string; email: string; profile_img?: string }) => void;
  onRemoveMember: (userId: number) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export interface LeftPanelProps {
  userNickname: string;
  workspaceCount: number;
  onCreateWorkspace: () => void;
}

export interface WorkspaceHeaderProps {
  user: {
    id: number;
    nickname: string;
    profileImg?: string;
    default_status?: string;
  };
  presenceStatus: string;
  showProfileMenu: boolean;
  onProfileMenuToggle: () => void;
  onProfileMenuClose: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onInvitationAccepted: () => void;
}
