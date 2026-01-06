"use client";

import NotificationDropdown from "../../components/NotificationDropdown";
import GlobalUserProfileMenu from "../../../components/GlobalUserProfileMenu";
import StatusIndicator from "../../../components/StatusIndicator";

interface WorkspaceHeaderProps {
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

export function WorkspaceHeader({
  user,
  presenceStatus,
  showProfileMenu,
  onProfileMenuToggle,
  onProfileMenuClose,
  onEditProfile,
  onLogout,
  onInvitationAccepted,
}: WorkspaceHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 lg:px-10 h-16 border-b border-white/10">
      <img src="/logo_white.png" alt="EUM" className="h-4 lg:hidden" />

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <NotificationDropdown onInvitationAccepted={onInvitationAccepted} />

        <div className="relative">
          <button
            onClick={onProfileMenuToggle}
            className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="relative">
              {user.profileImg ? (
                <img
                  src={user.profileImg}
                  alt={user.nickname}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user.nickname.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <StatusIndicator
                status={presenceStatus}
                size="sm"
                className="absolute -bottom-0.5 -right-0.5 ring-2 ring-[#1a1a1a]"
              />
            </div>
            <span className="hidden sm:block text-sm text-white/80">{user.nickname}</span>
          </button>

          {showProfileMenu && (
            <GlobalUserProfileMenu
              onClose={onProfileMenuClose}
              onEditProfile={onEditProfile}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
}
