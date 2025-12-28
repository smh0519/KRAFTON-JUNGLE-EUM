package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// AuthMiddleware JWT 인증 미들웨어
func AuthMiddleware(jwtManager *JWTManager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Authorization 헤더에서 토큰 추출
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			// 쿠키에서 토큰 확인
			authHeader = c.Cookies("access_token")
			if authHeader == "" {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "missing authorization token",
				})
			}
		} else {
			// Bearer 토큰 파싱
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "invalid authorization header format",
				})
			}
			authHeader = parts[1]
		}

		// 토큰 검증
		claims, err := jwtManager.ValidateAccessToken(authHeader)
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
