"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";

export default function WorkspacePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <img
          src="/kor_eum_black.png"
          alt="Loading"
          className="w-12 h-12 animate-pulse"
        />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">EUM Workspace</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">
            내 계정 정보
          </h2>

          <div className="flex items-start gap-8">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              {user.profileImg ? (
                <img
                  src={user.profileImg}
                  alt={user.nickname}
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-3xl text-gray-500">
                    {user.nickname.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  닉네임
                </label>
                <p className="text-lg text-gray-900">{user.nickname}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  이메일
                </label>
                <p className="text-lg text-gray-900">{user.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  사용자 ID
                </label>
                <p className="text-lg text-gray-900">{user.id}</p>
              </div>

              {user.provider && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    로그인 방식
                  </label>
                  <p className="text-lg text-gray-900 capitalize">
                    {user.provider === "google" ? "Google 계정" : user.provider}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Logout Button */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Placeholder for future features */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            워크스페이스 기능이 곧 추가됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
