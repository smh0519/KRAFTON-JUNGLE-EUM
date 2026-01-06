package handler

import (
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"realtime-backend/internal/auth"
	"realtime-backend/internal/model"
)

// CategoryHandler 워크스페이스 카테고리 핸들러
type CategoryHandler struct {
	db *gorm.DB
}

// NewCategoryHandler CategoryHandler 생성
func NewCategoryHandler(db *gorm.DB) *CategoryHandler {
	return &CategoryHandler{db: db}
}

// CategoryResponse 카테고리 응답
type CategoryResponse struct {
	ID             int64  `json:"id"`
	UserID         int64  `json:"user_id"`
	Name           string `json:"name"`
	Color          string `json:"color"`
	SortOrder      int    `json:"sort_order"`
	CreatedAt      string `json:"created_at"`
	WorkspaceCount int    `json:"workspace_count"`
}

// CreateCategoryRequest 카테고리 생성 요청
type CreateCategoryRequest struct {
	Name  string `json:"name"`
	Color string `json:"color,omitempty"`
}

// GetMyCategories 내 카테고리 목록 조회
func (h *CategoryHandler) GetMyCategories(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*auth.Claims)

	var categories []model.WorkspaceCategory
	err := h.db.
		Where("user_id = ?", claims.UserID).
		Order("sort_order ASC, created_at ASC").
		Find(&categories).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to get categories",
		})
	}

	// 각 카테고리의 워크스페이스 개수 조회
	responses := make([]CategoryResponse, len(categories))
	for i, cat := range categories {
		var count int64
		h.db.Model(&model.WorkspaceCategoryMapping{}).
			Where("category_id = ? AND user_id = ?", cat.ID, claims.UserID).
			Count(&count)

		responses[i] = CategoryResponse{
			ID:             cat.ID,
			UserID:         cat.UserID,
			Name:           cat.Name,
			Color:          cat.Color,
			SortOrder:      cat.SortOrder,
			CreatedAt:      cat.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			WorkspaceCount: int(count),
		}
	}

	return c.JSON(fiber.Map{
		"categories": responses,
		"total":      len(responses),
	})
}

// CreateCategory 카테고리 생성
func (h *CategoryHandler) CreateCategory(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*auth.Claims)

	var req CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "category name is required",
		})
	}

	if len(req.Name) > 100 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "category name must be less than 100 characters",
		})
	}

	// 기본 색상
	if req.Color == "" {
		req.Color = "#6366f1"
	}

	// 중복 이름 확인
	var existing model.WorkspaceCategory
	err := h.db.Where("user_id = ? AND name = ?", claims.UserID, req.Name).First(&existing).Error
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "category with this name already exists",
		})
	}

	// 다음 sort_order 계산
	var maxSortOrder int
	h.db.Model(&model.WorkspaceCategory{}).
		Where("user_id = ?", claims.UserID).
		Select("COALESCE(MAX(sort_order), 0)").
		Scan(&maxSortOrder)

	category := model.WorkspaceCategory{
		UserID:    claims.UserID,
		Name:      sanitizeString(req.Name),
		Color:     req.Color,
		SortOrder: maxSortOrder + 1,
	}

	if err := h.db.Create(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create category",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(CategoryResponse{
		ID:             category.ID,
		UserID:         category.UserID,
		Name:           category.Name,
		Color:          category.Color,
		SortOrder:      category.SortOrder,
		CreatedAt:      category.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		WorkspaceCount: 0,
	})
}

// UpdateCategory 카테고리 수정
func (h *CategoryHandler) UpdateCategory(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*auth.Claims)
	categoryID, err := c.ParamsInt("categoryId")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid category id",
		})
	}

	var req CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	// 카테고리 조회
	var category model.WorkspaceCategory
	if err := h.db.Where("id = ? AND user_id = ?", categoryID, claims.UserID).First(&category).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "category not found",
		})
	}

	// 업데이트
	if req.Name != "" {
		// 중복 이름 확인 (자기 자신 제외)
		var existing model.WorkspaceCategory
		err := h.db.Where("user_id = ? AND name = ? AND id != ?", claims.UserID, req.Name, categoryID).First(&existing).Error
		if err == nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "category with this name already exists",
			})
		}
		category.Name = sanitizeString(req.Name)
	}

	if req.Color != "" {
		category.Color = req.Color
	}

	if err := h.db.Save(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update category",
		})
	}

	// 워크스페이스 개수 조회
	var count int64
	h.db.Model(&model.WorkspaceCategoryMapping{}).
		Where("category_id = ? AND user_id = ?", category.ID, claims.UserID).
		Count(&count)

	return c.JSON(CategoryResponse{
		ID:             category.ID,
		UserID:         category.UserID,
		Name:           category.Name,
		Color:          category.Color,
		SortOrder:      category.SortOrder,
		CreatedAt:      category.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		WorkspaceCount: int(count),
	})
}

// DeleteCategory 카테고리 삭제
func (h *CategoryHandler) DeleteCategory(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*auth.Claims)
	categoryID, err := c.ParamsInt("categoryId")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid category id",
		})
	}

	// 카테고리 조회
	var category model.WorkspaceCategory
	if err := h.db.Where("id = ? AND user_id = ?", categoryID, claims.UserID).First(&category).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "category not found",
		})
	}

	// 카테고리 삭제 (CASCADE로 매핑도 삭제됨)
	if err := h.db.Delete(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete category",
		})
	}

	return c.JSON(fiber.Map{
		"message": "category deleted successfully",
	})
}

// AddWorkspaceToCategory 워크스페이스를 카테고리에 추가
func (h *CategoryHandler) AddWorkspaceToCategory(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*auth.Claims)
	categoryID, err := c.ParamsInt("categoryId")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid category id",
		})
	}
	workspaceID, err := c.ParamsInt("workspaceId")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid workspace id",
		})
	}

	// 카테고리 조회 (본인 소유 확인)
	var category model.WorkspaceCategory
	if err := h.db.Where("id = ? AND user_id = ?", categoryID, claims.UserID).First(&category).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "category not found",
		})
	}

	// 워크스페이스 멤버십 확인
	var memberCount int64
	h.db.Model(&model.WorkspaceMember{}).
		Where("workspace_id = ? AND user_id = ? AND status = ?", workspaceID, claims.UserID, model.MemberStatusActive.String()).
		Count(&memberCount)
	if memberCount == 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "you are not a member of this workspace",
		})
	}

	// 이미 매핑되어 있는지 확인
	var existing model.WorkspaceCategoryMapping
	err = h.db.Where("category_id = ? AND workspace_id = ? AND user_id = ?", categoryID, workspaceID, claims.UserID).First(&existing).Error
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "workspace already in this category",
		})
	}

	// 매핑 생성
	mapping := model.WorkspaceCategoryMapping{
		CategoryID:  int64(categoryID),
		WorkspaceID: int64(workspaceID),
		UserID:      claims.UserID,
	}

	if err := h.db.Create(&mapping).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to add workspace to category",
		})
	}

	return c.JSON(fiber.Map{
		"message": "workspace added to category successfully",
	})
}

// RemoveWorkspaceFromCategory 워크스페이스를 카테고리에서 제거
func (h *CategoryHandler) RemoveWorkspaceFromCategory(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*auth.Claims)
	categoryID, err := c.ParamsInt("categoryId")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid category id",
		})
	}
	workspaceID, err := c.ParamsInt("workspaceId")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid workspace id",
		})
	}

	// 매핑 조회
	var mapping model.WorkspaceCategoryMapping
	if err := h.db.Where("category_id = ? AND workspace_id = ? AND user_id = ?", categoryID, workspaceID, claims.UserID).First(&mapping).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "workspace not in this category",
		})
	}

	// 매핑 삭제
	if err := h.db.Delete(&mapping).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to remove workspace from category",
		})
	}

	return c.JSON(fiber.Map{
		"message": "workspace removed from category successfully",
	})
}
