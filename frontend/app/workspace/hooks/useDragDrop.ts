"use client";

import { useState, useCallback, useEffect } from "react";
import { DragEndEvent, DragStartEvent, DragOverEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Workspace } from "../../lib/api";

const STORAGE_KEY = "workspaceCategoryOrders";

type CategoryOrders = Record<string, number[]>;

export function useDragDrop() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [categoryOrders, setCategoryOrders] = useState<CategoryOrders>({});

  // Load orders from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCategoryOrders(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse workspace orders:", e);
      }
    }
  }, []);

  const saveCategoryOrders = useCallback((newOrders: CategoryOrders) => {
    setCategoryOrders(newOrders);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrders));
  }, []);

  // Sort workspaces for a specific category section
  const sortWorkspacesByCategory = useCallback((
    workspaceList: Workspace[],
    categoryKey: string
  ): Workspace[] => {
    const order = categoryOrders[categoryKey];
    if (!order || order.length === 0) return workspaceList;

    return [...workspaceList].sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [categoryOrders]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id?.toString() || null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);

    const { active, over } = event;
    if (!over) return null;

    const activeId = active.id as number;
    const overIdValue = over.id;

    // Check if dropped on a category tab
    if (typeof overIdValue === "string") {
      if (overIdValue.startsWith("category-") || overIdValue === "uncategorized") {
        return { type: "category" as const, workspaceId: activeId, targetId: overIdValue };
      }
    }

    // Dropped on another workspace - reorder
    const overId = overIdValue as number;
    if (activeId !== overId) {
      return { type: "reorder" as const, activeId, overId };
    }

    return null;
  }, []);

  // Reorder within a category section - uses visual order
  const reorderInCategory = useCallback((
    categoryKey: string,
    sortedWorkspaceIds: number[],
    activeWorkspaceId: number,
    overWorkspaceId: number
  ) => {
    const oldIndex = sortedWorkspaceIds.indexOf(activeWorkspaceId);
    const newIndex = sortedWorkspaceIds.indexOf(overWorkspaceId);

    if (oldIndex === -1 || newIndex === -1) {
      console.warn("Reorder failed: workspace not found", { activeWorkspaceId, overWorkspaceId });
      return;
    }

    const newOrder = arrayMove(sortedWorkspaceIds, oldIndex, newIndex);
    saveCategoryOrders({ ...categoryOrders, [categoryKey]: newOrder });
  }, [categoryOrders, saveCategoryOrders]);

  // Add workspace to a category's order at specific position
  const addToCategory = useCallback((
    categoryKey: string,
    workspaceId: number,
    atPosition?: number
  ) => {
    const currentOrder = categoryOrders[categoryKey] || [];
    // Remove if already exists
    const filtered = currentOrder.filter(id => id !== workspaceId);
    // Add at position or end
    if (atPosition !== undefined && atPosition >= 0) {
      filtered.splice(atPosition, 0, workspaceId);
    } else {
      filtered.push(workspaceId);
    }
    saveCategoryOrders({ ...categoryOrders, [categoryKey]: filtered });
  }, [categoryOrders, saveCategoryOrders]);

  // Remove workspace from a category's order
  const removeFromCategoryOrder = useCallback((
    categoryKey: string,
    workspaceId: number
  ) => {
    const currentOrder = categoryOrders[categoryKey] || [];
    const filtered = currentOrder.filter(id => id !== workspaceId);
    saveCategoryOrders({ ...categoryOrders, [categoryKey]: filtered });
  }, [categoryOrders, saveCategoryOrders]);

  return {
    activeId,
    overId,
    categoryOrders,
    sortWorkspacesByCategory,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    reorderInCategory,
    addToCategory,
    removeFromCategoryOrder,
  };
}
