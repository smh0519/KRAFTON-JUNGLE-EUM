"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { slides } from "./data";
import {
  useScrollNavigation,
  useLogoAnimation,
  useSpeechAnimation,
  useMeetingNotesAnimation,
} from "./hooks";
import { DotNavigation, ScrollIndicator } from "./components/navigation";
import {
  IntroSection,
  SilentExpertsSection,
  PassiveMeetingSection,
  WhiteboardSection,
  SpeechToSpeechSection,
  MeetingNotesSection,
  CTASection,
} from "./components/sections";
import { useAuth } from "../lib/auth-context";
import { CustomGoogleLoginButton } from "../lib/google-login";

export function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/workspace");
      } else {
        setShowContent(true);
      }
    }
  }, [isLoading, isAuthenticated, router]);

  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoEnded = useCallback(() => {
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    }, 5000);
  }, []);

  // Navigation
  const { currentSlide, sectionRefs, scrollToSlide } = useScrollNavigation({
    totalSlides: slides.length,
  });

  // Logo animation for IntroSection
  const { currentLogo } = useLogoAnimation();

  // Speech-to-Speech animation
  const { activeSpeaker, activeChunkIndex, translatedChunkIndex, currentStreamData } =
    useSpeechAnimation({ isActive: currentSlide === 4 });

  // Meeting notes step animation
  const { currentStep: notesStep } = useMeetingNotesAnimation(currentSlide === 5);

  const handleLoginSuccess = () => {
    router.push("/workspace");
  };

  // 로딩 중이거나 인증 확인 중이면 로딩 화면 표시
  if (isLoading || !showContent) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <img
          src="/kor_eum_black.png"
          alt="Loading"
          className="w-12 h-12 animate-pulse"
        />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-white">
      {/* Main scroll container */}
      <div className="h-screen overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth">

        {/* Header for sections 0, 1, 2 */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 transition-transform duration-500 ease-out ${
            currentSlide <= 2 ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="px-10 py-5 flex items-center justify-between">
            <img src="/eum_black.png" alt="Eum" className="h-7" />
            <CustomGoogleLoginButton
              onSuccess={handleLoginSuccess}
              className="px-5 py-2.5 bg-white border border-gray-300 rounded-full hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
            >
              <span className="text-sm font-medium text-gray-700">Google로 시작하기</span>
            </CustomGoogleLoginButton>
          </div>
        </header>

        {/* Intro sections wrapper (0, 1, 2) with sticky video */}
        <div className="flex">
          {/* Left content - sections stack vertically */}
          <div className="w-[35%] flex flex-col">
            {/* Section 0: Intro */}
            <IntroSection
              ref={(el) => { sectionRefs.current[0] = el; }}
              currentLogo={currentLogo}
            />

            {/* Section 1: Silent Experts */}
            <SilentExpertsSection ref={(el) => { sectionRefs.current[1] = el; }} />

            {/* Section 2: Passive Meeting */}
            <PassiveMeetingSection ref={(el) => { sectionRefs.current[2] = el; }} />
          </div>

          {/* Right side - sticky video */}
          <div className="w-[70%]">
            <div className="sticky top-0 h-screen flex items-center justify-center">
              <div className="relative overflow-hidden rounded-xl shadow-2xl scale-[1.6] origin-center translate-x-[-10%]">
                <video
                  ref={videoRef}
                  className="w-[50vw] h-auto"
                  src="/video.mov"
                  autoPlay
                  muted
                  playsInline
                  onEnded={handleVideoEnded}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Whiteboard */}
        <WhiteboardSection
          ref={(el) => { sectionRefs.current[3] = el; }}
          isActive={currentSlide === 3}
        />

        {/* Section 4: Speech-to-Speech */}
        <SpeechToSpeechSection
          ref={(el) => { sectionRefs.current[4] = el; }}
          activeSpeaker={activeSpeaker}
          activeChunkIndex={activeChunkIndex}
          translatedChunkIndex={translatedChunkIndex}
          currentStreamData={currentStreamData}
        />

        {/* Section 5: Meeting Notes */}
        <MeetingNotesSection
          ref={(el) => { sectionRefs.current[5] = el; }}
          notesStep={notesStep}
        />

        {/* Section 6: CTA */}
        <CTASection
          ref={(el) => { sectionRefs.current[6] = el; }}
          isActive={currentSlide === 6}
        />
      </div>

      {/* Side Dot Navigation */}
      <DotNavigation
        currentSlide={currentSlide}
        totalSlides={slides.length}
        onNavigate={scrollToSlide}
      />

      {/* Scroll indicator */}
      <ScrollIndicator isVisible={currentSlide === 0} />
    </div>
  );
}
