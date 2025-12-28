package handler

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"realtime-backend/internal/auth"
	"realtime-backend/internal/model"
)

// AuthHandler 인증 핸들러
type AuthHandler struct {
	db           *gorm.DB
	jwtManager   *auth.JWTManager
	googleAuth   *auth.GoogleAuthenticator
	secureCookie bool
}

// NewAuthHandler AuthHandler 생성
func NewAuthHandler(db *gorm.DB, jwtManager *auth.JWTManager, googleAuth *auth.GoogleAuthenticator, secureCookie bool) *AuthHandler {
	return &AuthHandler{
		db:           db,
		jwtManager:   jwtManager,
		googleAuth:   googleAuth,
		secureCookie: secureCookie,
	}
}

// GoogleLoginRequest Google 로그인 요청
type GoogleLoginRequest struct {
	IDToken string `json:"id_token"`
}

// AuthResponse 인증 응답
type AuthResponse struct {
	User         UserResponse `json:"user"`
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token,omitempty"`
	ExpiresIn    int64        `json:"expires_in"`
}

// UserResponse 사용자 응답
type UserResponse struct {
	ID         int64   `json:"id"`
	Email      string  `json:"email"`
	Nickname   string  `json:"nickname"`
	ProfileImg *string `json:"profile_img,omitempty"`
	Provider   *string `json:"provider,omitempty"`
}

// GoogleLogin Google OAuth 로그인
func (h *AuthHandler) GoogleLogin(c *fiber.Ctx) error {
	var req GoogleLoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if req.IDToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "id_token is required",
		})
	}

	// Google ID Token 검증
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	googleUser, err := h.googleAuth.VerifyIDToken(ctx, req.IDToken)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid google token",
		})
	}

	// 사용자 조회 또는 생성
	var user model.User
	result := h.db.Where("email = ?", googleUser.Email).First(&user)

	provider := "google"
	if result.Error == gorm.ErrRecordNotFound {
		// 신규 사용자 생성
		user = model.User{
			Email:      googleUser.Email,
			Nickname:   googleUser.Name,
			ProfileImg: &googleUser.Picture,
			Provider:   &provider,
			ProviderID: &googleUser.ID,
		}
		if err := h.db.Create(&user).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to create user",
			})
		}
	} else if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "database error",
		})
	} else {
		// 기존 사용자 업데이트
		user.ProfileImg = &googleUser.Picture
		// Provider가 다르면 업데이트 (local → google 전환)
		if user.Provider == nil || *user.Provider != "google" {
			user.Provider = &provider
			user.ProviderID = &googleUser.ID
		}
		h.db.Save(&user)
	}

	// JWT 토큰 생성
	accessToken, err := h.jwtManager.GenerateAccessToken(user.ID, user.Email, user.Nickname)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate token",
		})
	}

	refreshToken, err := h.jwtManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate refresh token",
		})
	}

	// HTTP-Only 쿠키로 리프레시 토큰 설정 (보안 강화)
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60, // 7일
		Secure:   h.secureCookie,
		HTTPOnly: true,
		SameSite: "Lax",
	})

	return c.JSON(AuthResponse{
		User: UserResponse{
			ID:         user.ID,
			Email:      user.Email,
			Nickname:   user.Nickname,
			ProfileImg: user.ProfileImg,
			Provider:   user.Provider,
		},
		AccessToken: accessToken,
		ExpiresIn:   3600, // 1시간
	})
}

// RefreshToken 토큰 갱신
func (h *AuthHandler) RefreshToken(c *fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "refresh token not found",
		})
	}

	// 리프레시 토큰 검증
	userID, err := h.jwtManager.ValidateRefreshToken(refreshToken)
	if err != nil {
		// 쿠키 삭제
		c.Cookie(&fiber.Cookie{
			Name:     "refresh_token",
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			Secure:   h.secureCookie,
			HTTPOnly: true,
		})
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid or expired refresh token",
		})
	}

	// 사용자 조회
	var user model.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "user not found",
		})
	}

	// 새 액세스 토큰 발급
	accessToken, err := h.jwtManager.GenerateAccessToken(user.ID, user.Email, user.Nickname)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate token",
		})
	}

	return c.JSON(fiber.Map{
		"access_token": accessToken,
		"expires_in":   3600,
	})
}

// Logout 로그아웃
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	// 리프레시 토큰 쿠키 삭제
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   h.secureCookie,
		HTTPOnly: true,
	})

	return c.JSON(fiber.Map{
		"message": "logged out successfully",
	})
}

// GetMe 현재 사용자 정보
func (h *AuthHandler) GetMe(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*auth.Claims)

	var user model.User
	if err := h.db.First(&user, "id = ?", claims.UserID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "user not found",
		})
	}

	return c.JSON(UserResponse{
		ID:         user.ID,
		Email:      user.Email,
		Nickname:   user.Nickname,
		ProfileImg: user.ProfileImg,
		Provider:   user.Provider,
	})
}
