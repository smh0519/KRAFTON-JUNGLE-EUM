"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { apiClient, Workspace } from "../../lib/api";

const ITEMS_PER_PAGE = 10;

export function useWorkspaces(isAuthenticated: boolean) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalWorkspaces, setTotalWorkspaces] = useState(0);
  const [workspaceCategoryMap, setWorkspaceCategoryMap] = useState<Record<number, number[]>>({});

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const fetchWorkspaces = useCallback(async (reset = true) => {
    try {
      if (reset) {
        setIsLoadingWorkspaces(true);
        setWorkspaces([]);
      } else {
        setIsLoadingMore(true);
      }

      const offset = reset ? 0 : workspaces.length;
      const response = await apiClient.getMyWorkspaces({
        limit: ITEMS_PER_PAGE,
        offset,
        search: debouncedSearchQuery || undefined,
      });

      if (reset) {
        setWorkspaces(response.workspaces);
        const newMap: Record<number, number[]> = {};
        response.workspaces.forEach(ws => {
          if (ws.category_ids && ws.category_ids.length > 0) {
            newMap[ws.id] = ws.category_ids;
          }
        });
        setWorkspaceCategoryMap(newMap);
      } else {
        setWorkspaces(prev => [...prev, ...response.workspaces]);
        setWorkspaceCategoryMap(prev => {
          const newMap = { ...prev };
          response.workspaces.forEach(ws => {
            if (ws.category_ids && ws.category_ids.length > 0) {
              newMap[ws.id] = ws.category_ids;
            }
          });
          return newMap;
        });
      }

      setTotalWorkspaces(response.total);
      setHasMore(response.has_more ?? (offset + response.workspaces.length < response.total));
    } catch (error) {
      console.error("[useWorkspaces] Failed to fetch workspaces:", error);
    } finally {
      setIsLoadingWorkspaces(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearchQuery, workspaces.length]);

  // Re-fetch when search changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspaces(true);
    }
  }, [debouncedSearchQuery, isAuthenticated]);

  const updateCategoryMap = useCallback((workspaceId: number, categoryIds: number[]) => {
    setWorkspaceCategoryMap(prev => ({
      ...prev,
      [workspaceId]: categoryIds
    }));
  }, []);

  return {
    workspaces,
    isLoadingWorkspaces,
    hasMore,
    isLoadingMore,
    totalWorkspaces,
    workspaceCategoryMap,
    searchQuery,
    setSearchQuery,
    fetchWorkspaces,
    updateCategoryMap,
  };
}
