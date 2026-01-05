"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient, WorkspaceCategory } from "../../lib/api";

const CATEGORY_ORDER_KEY = "categoryOrder";

export function useCategories(isAuthenticated: boolean) {
  const [categories, setCategories] = useState<WorkspaceCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#6366f1");
  const [editingCategory, setEditingCategory] = useState<WorkspaceCategory | null>(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState<number | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Load saved category order and apply it
  const applySavedOrder = useCallback((cats: WorkspaceCategory[]) => {
    const savedOrder = localStorage.getItem(CATEGORY_ORDER_KEY);
    if (!savedOrder) return cats;

    try {
      const orderIds: number[] = JSON.parse(savedOrder);
      const catMap = new Map(cats.map(c => [c.id, c]));
      const ordered: WorkspaceCategory[] = [];

      // Add categories in saved order
      for (const id of orderIds) {
        const cat = catMap.get(id);
        if (cat) {
          ordered.push(cat);
          catMap.delete(id);
        }
      }

      // Add any new categories not in saved order
      for (const cat of catMap.values()) {
        ordered.push(cat);
      }

      return ordered;
    } catch {
      return cats;
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.getMyCategories();
      const orderedCategories = applySavedOrder(response.categories);
      setCategories(orderedCategories);
    } catch (error) {
      console.error("[useCategories] Failed to fetch categories:", error);
    }
  }, [applySavedOrder]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories();
    }
  }, [isAuthenticated, fetchCategories]);

  const handleCategoryChange = useCallback((categoryId: number | null) => {
    if (categoryId === selectedCategoryId) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedCategoryId(categoryId);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  }, [selectedCategoryId]);

  const handleCreateCategory = useCallback(async () => {
    if (!categoryName.trim() || isCreatingCategory) return;

    try {
      setIsCreatingCategory(true);
      await apiClient.createCategory({
        name: categoryName,
        color: categoryColor,
      });
      await fetchCategories();
      setShowCategoryModal(false);
      setCategoryName("");
      setCategoryColor("#6366f1");
    } catch (error) {
      console.error("Failed to create category:", error);
    } finally {
      setIsCreatingCategory(false);
    }
  }, [categoryName, categoryColor, isCreatingCategory, fetchCategories]);

  const handleUpdateCategory = useCallback(async () => {
    if (!editingCategory || !categoryName.trim() || isCreatingCategory) return;

    try {
      setIsCreatingCategory(true);
      await apiClient.updateCategory(editingCategory.id, {
        name: categoryName,
        color: categoryColor,
      });
      await fetchCategories();
      setEditingCategory(null);
      setShowCategoryModal(false);
      setCategoryName("");
      setCategoryColor("#6366f1");
    } catch (error) {
      console.error("Failed to update category:", error);
    } finally {
      setIsCreatingCategory(false);
    }
  }, [editingCategory, categoryName, categoryColor, isCreatingCategory, fetchCategories]);

  const handleDeleteCategory = useCallback(async (categoryId: number) => {
    if (!confirm("이 카테고리를 삭제하시겠습니까?")) return;

    try {
      await apiClient.deleteCategory(categoryId);
      await fetchCategories();
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
      }
      setCategoryMenuOpen(null);
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  }, [selectedCategoryId, fetchCategories]);

  const openEditCategory = useCallback((category: WorkspaceCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryColor(category.color);
    setShowCategoryModal(true);
    setCategoryMenuOpen(null);
  }, []);

  const openCreateCategory = useCallback(() => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryColor("#6366f1");
    setShowCategoryModal(true);
  }, []);

  const closeCategoryModal = useCallback(() => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategoryColor("#6366f1");
  }, []);

  const handleCategoryReorder = useCallback((newOrder: WorkspaceCategory[]) => {
    setCategories(newOrder);
    const orderIds = newOrder.map(c => c.id);
    localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(orderIds));
  }, []);

  const toggleWorkspaceCategory = useCallback(async (
    workspaceId: number,
    categoryId: number,
    currentCategories: number[],
    updateCategoryMap: (workspaceId: number, categoryIds: number[]) => void
  ) => {
    const isIn = currentCategories.includes(categoryId);

    try {
      if (isIn) {
        await apiClient.removeWorkspaceFromCategory(categoryId, workspaceId);
        updateCategoryMap(workspaceId, currentCategories.filter(id => id !== categoryId));
      } else {
        await apiClient.addWorkspaceToCategory(categoryId, workspaceId);
        updateCategoryMap(workspaceId, [...currentCategories, categoryId]);
      }
      await fetchCategories();
    } catch (error) {
      console.error("Failed to toggle workspace category:", error);
    }
  }, [fetchCategories]);

  const moveWorkspaceToCategory = useCallback(async (
    workspaceId: number,
    targetCategoryId: number,
    currentCategories: number[],
    updateCategoryMap: (workspaceId: number, categoryIds: number[]) => void
  ) => {
    try {
      for (const catId of currentCategories) {
        if (catId !== targetCategoryId) {
          await apiClient.removeWorkspaceFromCategory(catId, workspaceId);
        }
      }

      if (!currentCategories.includes(targetCategoryId)) {
        await apiClient.addWorkspaceToCategory(targetCategoryId, workspaceId);
      }

      updateCategoryMap(workspaceId, [targetCategoryId]);
      await fetchCategories();
    } catch (error) {
      console.error("Failed to move workspace:", error);
    }
  }, [fetchCategories]);

  const removeAllCategories = useCallback(async (
    workspaceId: number,
    currentCategories: number[],
    updateCategoryMap: (workspaceId: number, categoryIds: number[]) => void
  ) => {
    try {
      for (const catId of currentCategories) {
        await apiClient.removeWorkspaceFromCategory(catId, workspaceId);
      }
      updateCategoryMap(workspaceId, []);
      await fetchCategories();
    } catch (error) {
      console.error("Failed to remove categories:", error);
    }
  }, [fetchCategories]);

  return {
    categories,
    selectedCategoryId,
    isTransitioning,
    showCategoryModal,
    categoryName,
    categoryColor,
    editingCategory,
    categoryMenuOpen,
    isCreatingCategory,
    setCategoryName,
    setCategoryColor,
    setCategoryMenuOpen,
    handleCategoryChange,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleCategoryReorder,
    openEditCategory,
    openCreateCategory,
    closeCategoryModal,
    toggleWorkspaceCategory,
    moveWorkspaceToCategory,
    removeAllCategories,
    fetchCategories,
  };
}
