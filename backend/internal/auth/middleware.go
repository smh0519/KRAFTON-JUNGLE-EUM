package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// ErrNoClaims claims가 없을 때 반환되는 에러
var ErrNoClaims = errors.New("no claims in context")

// GenerateCSRFToken CSRF 토큰 생성
func GenerateCSRFToken() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		// crypto/rand 실패 시 에러 로깅 (매우 드문 경우)
		panic("crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(bytes)
}

// GetClaimsFromContext 컨텍스트에서 Claims를 안전하게 추출
func GetClaimsFromContext(c *fiber.Ctx) (*Claims, error) {
	claimsInterface := c.Locals("claims")
	if claimsInterface == nil {
		return nil, ErrNoClaims
	}
	claims, ok := claimsInterface.(*Claims)
	if !ok || claims == nil {
		return nil, ErrNoClaims
	}
	return claims, nil
}

// AuthMiddleware JWT 인증 미들웨어
func AuthMiddleware(jwtManager *JWTManager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 쿠키에서 토큰 우선 확인 (HTTP-only 쿠키 보안)
		token := c.Cookies("access_token")

		// 쿠키에 없으면 Authorization 헤더 확인 (API 클라이언트용)
		if token == "" {
			authHeader := c.Get("Authorization")
			if authHeader == "" {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "missing authorization token",
				})
			}
			// Bearer 토큰 파싱
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "invalid authorization header format",
				})
			}
			token = parts[1]
		}

		// 토큰 검증
		claims, err := jwtManager.ValidateAccessToken(token)
		if err != nil {
			if err == ErrExpiredToken {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "token expired",
					"code":  "TOKEN_EXPIRED",
				})
			}
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token",
			})
		}

		// 사용자 정보를 컨텍스트에 저장
		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("nickname", claims.Nickname)
		c.Locals("claims", claims)

		return c.Next()
	}
}

// OptionalAuthMiddleware 선택적 인증 미들웨어 (인증 실패해도 계속 진행)
func OptionalAuthMiddleware(jwtManager *JWTManager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			authHeader = c.Cookies("access_token")
		}

		if authHeader != "" {
			// Bearer 토큰 파싱
			if strings.HasPrefix(authHeader, "Bearer ") {
				authHeader = strings.TrimPrefix(authHeader, "Bearer ")
			}

			claims, err := jwtManager.ValidateAccessToken(authHeader)
			if err == nil {
				c.Locals("userID", claims.UserID)
				c.Locals("email", claims.Email)
				c.Locals("nickname", claims.Nickname)
				c.Locals("claims", claims)
			}
		}

		return c.Next()
	}
}
