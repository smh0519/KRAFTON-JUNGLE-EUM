"use client";

import { forwardRef } from "react";
import { CustomGoogleLoginButton } from "../../../lib/google-login";
import { useAuth } from "../../../lib/auth-context";

interface CTASectionProps {
  isActive: boolean;
}

export const CTASection = forwardRef<HTMLElement, CTASectionProps>(
  function CTASection({ isActive }, ref) {
    const { user, isAuthenticated, logout } = useAuth();

    const handleLoginSuccess = () => {
      // 로그인 성공 시 대시보드나 메인 앱으로 이동
      window.location.href = "/workspace";
    };

    return (
      <section
        ref={ref}
        className="min-h-screen snap-start snap-always flex items-center justify-center bg-white px-16"
      >
        <div className="w-full max-w-6xl flex items-center justify-between">
          {/* Left: Text */}
          <div className="flex-1">
            <h1
              className={`text-5xl leading-tight text-gray-800 mb-4 transition-all duration-700 ease-out ${
                isActive
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-8"
              }`}
              style={{ fontFamily: 'Handwritten, sans-serif' }}
            >
              세상의 모든 말이 당신의 모국어가 됩니다.
            </h1>

            <p
              className={`text-2xl text-gray-500 transition-all duration-700 ease-out delay-200 ${
                isActive
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-8"
              }`}
              style={{ fontFamily: 'Handwritten, sans-serif' }}
            >
              듣고, 읽고, 말하세요. 가장 완벽한 실시간 협업의 시작.
            </p>
          </div>

          {/* Right: Buttons */}
          <div
            className={`transition-all duration-700 ease-out delay-400 ${
              isActive
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-8"
            }`}
          >
            {isAuthenticated ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 mb-2">
                  {user?.profileImg && (
                    <img
                      src={user.profileImg}
                      alt={user.nickname}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <span className="text-gray-700 font-medium">{user?.nickname}</span>
                </div>
                <button
                  onClick={() => (window.location.href = "/workspace")}
                  className="group px-12 py-5 bg-gray-900 text-white text-lg font-medium hover:bg-gray-800 transition-all duration-300 flex items-center gap-3"
                >
                  워크스페이스로 이동
                  <span className="group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </button>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <CustomGoogleLoginButton
                  onSuccess={handleLoginSuccess}
                  className="px-5 py-2.5 bg-white border border-gray-300 rounded-full hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
                >
                  <span className="text-sm font-medium text-gray-700">Google로 시작하기</span>
                </CustomGoogleLoginButton>
                <p className="text-gray-400 text-sm">
                  Google 계정으로 간편하게 시작하세요
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
);
