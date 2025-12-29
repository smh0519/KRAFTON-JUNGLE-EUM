"use client";

import { useState, useEffect } from "react";

interface StepTiming {
  step: number;
  delay: number;
}

interface UseStepAnimationProps {
  isActive: boolean;
  steps: StepTiming[];
}

interface UseStepAnimationReturn {
  currentStep: number;
}

export function useStepAnimation({
  isActive,
  steps,
}: UseStepAnimationProps): UseStepAnimationReturn {
  const [currentStep, setCurrentStep] = useState(0);

  // Stringify steps to use as dependency
  const stepsKey = JSON.stringify(steps);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    if (isActive) {
      // 비동기로 초기화하여 cascade 방지
      timers.push(setTimeout(() => setCurrentStep(0), 0));

      steps.forEach(({ step, delay }) => {
        timers.push(setTimeout(() => setCurrentStep(step), delay));
      });
    } else {
      timers.push(setTimeout(() => setCurrentStep(0), 0));
    }

    return () => timers.forEach((t) => clearTimeout(t));
  }, [isActive, stepsKey]);

  return { currentStep };
}

// Pre-configured hooks for specific sections
const MEETING_NOTES_STEPS: StepTiming[] = [
  { step: 1, delay: 500 },
  { step: 2, delay: 1500 },
  { step: 3, delay: 3500 },
  { step: 4, delay: 5000 },
  { step: 5, delay: 6000 },
];

export function useMeetingNotesAnimation(isActive: boolean) {
  return useStepAnimation({
    isActive,
    steps: MEETING_NOTES_STEPS,
  });
}

const TECH_CHALLENGES_STEPS: StepTiming[] = [
  { step: 1, delay: 300 },
  { step: 2, delay: 600 },
  { step: 3, delay: 1800 },
  { step: 4, delay: 2100 },
];

export function useTechChallengesAnimation(isActive: boolean) {
  return useStepAnimation({
    isActive,
    steps: TECH_CHALLENGES_STEPS,
  });
}

const TEAM_STEPS: StepTiming[] = [
  { step: 1, delay: 200 },
  { step: 2, delay: 400 },
  { step: 3, delay: 600 },
  { step: 4, delay: 800 },
  { step: 5, delay: 1000 },
];

export function useTeamAnimation(isActive: boolean) {
  return useStepAnimation({
    isActive,
    steps: TEAM_STEPS,
  });
}
