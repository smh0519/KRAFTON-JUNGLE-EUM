package handler

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"realtime-backend/internal/auth"
	"realtime-backend/internal/model"
)

// UserHandler 유저 핸들러
type UserHandler struct {
	db *gorm.DB
}

// NewUserHandler UserHandler 생성
func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{db: db}
}

// SearchUsersResponse 유저 검색 응답
type SearchUsersResponse struct {
	Users []UserResponse `json:"users"`
	Total int64          `json:"total"`
}

// SearchUsers 유저 검색 (닉네임 또는 이메일)
func (h *UserHandler) SearchUsers(c *fiber.Ctx) error {
	// 현재 로그인한 사용자 정보
	claims, err := auth.GetClaimsFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// 검색어 가져오기
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "search query is required",
		})
	}

	// 최소 2글자 이상
	if len(query) < 2 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "search query must be at least 2 characters",
		})
	}

	// 검색어 정제 (XSS 방지)
	query = sanitizeString(query)

	// 검색 쿼리 생성 (ILIKE로 대소문자 무시)
	searchPattern := "%" + query + "%"

	var users []model.User
	var total int64

	// 닉네임 또는 이메일로 검색 (본인 제외, 최대 10명)
	result := h.db.Model(&model.User{}).
		Where("id != ?", claims.UserID).
		Where("nickname ILIKE ? OR email ILIKE ?", searchPattern, searchPattern).
		Count(&total)

	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to search users",
		})
	}

	result = h.db.
		Where("id != ?", claims.UserID).
		Where("nickname ILIKE ? OR email ILIKE ?", searchPattern, searchPattern).
		Limit(10).
		Find(&users)

	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to search users",
		})
	}

	// 응답 변환
	userResponses := make([]UserResponse, len(users))
	for i, user := range users {
		userResponses[i] = UserResponse{
			ID:         user.ID,
			Email:      user.Email,
			Nickname:   user.Nickname,
			ProfileImg: user.ProfileImg,
		}
	}

	return c.JSON(SearchUsersResponse{
		Users: userResponses,
		Total: total,
	})
}

// UpdateUserRequest 유저 정보 수정 요청
type UpdateUserRequest struct {
	Nickname   string  `json:"nickname"`
	ProfileImg *string `json:"profile_img"`
}

// UpdateUser 내 정보 수정
func (h *UserHandler) UpdateUser(c *fiber.Ctx) error {
	claims, err := auth.GetClaimsFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// Multipart Form 파싱
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "failed to parse multipart form",
		})
	}

	nickname := ""
	if values, ok := form.Value["nickname"]; ok && len(values) > 0 {
		nickname = strings.TrimSpace(values[0])
	}

	// 닉네임 유효성 검사
	if nickname == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "nickname is required",
		})
	}
	if len(nickname) < 2 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "nickname must be at least 2 characters",
		})
	}

	var profileImgPath *string

	// 파일 업로드 처리
	if files, ok := form.File["profile_img"]; ok && len(files) > 0 {
		file := files[0]

		// 파일 크기 제한 (2MB)
		if file.Size > 2*1024*1024 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "profile image too large (max 2MB)",
			})
		}

		// 이미지 파일 검증 (MIME type)
		contentType := file.Header.Get("Content-Type")
		if !strings.HasPrefix(contentType, "image/") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid file type (image only)",
			})
		}

		// 저장 디렉토리 생성
		uploadDir := "./uploads/profiles"
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to create upload directory",
			})
		}

		// 파일명 생성 (UUID 등 사용 권장하지만 간단히 userID_timestamp 조합 사용)
		ext := filepath.Ext(file.Filename)
		filename := fmt.Sprintf("%d_%d%s", claims.UserID, time.Now().Unix(), ext)
		savePath := filepath.Join(uploadDir, filename)

		// 파일 저장
		if err := c.SaveFile(file, savePath); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to save profile image",
			})
		}

		// URL 경로 설정 (백엔드 서버 주소 포함 필요할 수 있으나 상대 경로로 /uploads/... 사용)
		// 실제 서비스에선 CDN이나 S3 URL이 될 것
		// 클라이언트에서 접근 가능한 경로로 저장
		// Windows 환경 고려하여 경로 구분자 변경
		webPath := fmt.Sprintf("/uploads/profiles/%s", filename)
		profileImgPath = &webPath
	}

	// DB 업데이트
	var user model.User
	result := h.db.First(&user, claims.UserID)
	if result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "user not found",
		})
	}

	user.Nickname = nickname
	if profileImgPath != nil {
		user.ProfileImg = profileImgPath
	}

	if err := h.db.Save(&user).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update user",
		})
	}

	// 응답
	return c.JSON(UserResponse{
		ID:         user.ID,
		Email:      user.Email,
		Nickname:   user.Nickname,
		ProfileImg: user.ProfileImg,
	})
}
