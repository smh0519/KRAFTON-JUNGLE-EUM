"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseScrollNavigationProps {
  totalSlides: number;
}

interface UseScrollNavigationReturn {
  currentSlide: number;
  sectionRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  setSectionRef: (index: number) => (el: HTMLElement | null) => void;
  scrollToSlide: (index: number) => void;
}

export function useScrollNavigation({
  totalSlides,
}: UseScrollNavigationProps): UseScrollNavigationReturn {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [refsReady, setRefsReady] = useState(false);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const scrollToSlide = useCallback((index: number) => {
    sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const setSectionRef = useCallback((index: number) => (el: HTMLElement | null) => {
    sectionRefs.current[index] = el;
  }, []);

  // Check if refs are ready after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setRefsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Intersection Observer for scroll detection
  useEffect(() => {
    if (!refsReady) return;

    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((section, index) => {
      if (!section) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
              setCurrentSlide(index);
            }
          });
        },
        { threshold: 0.3 }
      );

      observer.observe(section);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [refsReady]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowRight" || e.code === "ArrowDown") {
        e.preventDefault();
        if (currentSlide < totalSlides - 1) {
          scrollToSlide(currentSlide + 1);
        }
      } else if (e.code === "ArrowLeft" || e.code === "ArrowUp") {
        e.preventDefault();
        if (currentSlide > 0) {
          scrollToSlide(currentSlide - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide, totalSlides, scrollToSlide]);

  return {
    currentSlide,
    sectionRefs,
    setSectionRef,
    scrollToSlide,
  };
}
