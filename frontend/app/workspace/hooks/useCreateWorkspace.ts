"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiClient, UserSearchResult } from "../../lib/api";

export function useCreateWorkspace(onCreated: () => void) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [isCreating, setIsCreating] = useState(false);

  // Member search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await apiClient.searchUsers(query);
      const filteredUsers = result.users.filter(
        (u) => !selectedMembers.some((m) => m.id === u.id)
      );
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [selectedMembers]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSearch]);

  const openModal = useCallback(() => {
    setShowModal(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShowModal(false);
      setIsClosing(false);
      setWorkspaceName("");
      setStep(1);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedMembers([]);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }, 600);
  }, []);

  const addMember = useCallback((user: UserSearchResult) => {
    setSelectedMembers((prev) => [...prev, user]);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const removeMember = useCallback((userId: number) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  }, []);

  const nextStep = useCallback(() => {
    if (workspaceName.trim()) {
      setStep(2);
    }
  }, [workspaceName]);

  const prevStep = useCallback(() => {
    setStep(1);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const createWorkspace = useCallback(async () => {
    if (isCreating) return;

    try {
      setIsCreating(true);
      const newWorkspace = await apiClient.createWorkspace({
        name: workspaceName,
        member_ids: selectedMembers.map((m) => m.id),
      });

      await onCreated();
      closeModal();
      router.push(`/workspace/${newWorkspace.id}`);
    } catch (error) {
      console.error("Failed to create workspace:", error);
      alert("워크스페이스 생성에 실패했습니다.");
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, workspaceName, selectedMembers, onCreated, closeModal, router]);

  return {
    showModal,
    isClosing,
    workspaceName,
    step,
    isCreating,
    searchQuery,
    searchResults,
    selectedMembers,
    isSearching,
    videoRef,
    setWorkspaceName,
    setSearchQuery,
    openModal,
    closeModal,
    addMember,
    removeMember,
    nextStep,
    prevStep,
    createWorkspace,
  };
}
