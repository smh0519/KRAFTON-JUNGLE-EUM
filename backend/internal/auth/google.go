package auth

import (
	"context"
	"errors"

	"google.golang.org/api/idtoken"
)

var (
	ErrInvalidGoogleToken = errors.New("invalid google id token")
)

// GoogleUserInfo Google 사용자 정보
type GoogleUserInfo struct {
	ID            string
	Email         string
	EmailVerified bool
	Name          string
	Picture       string
}

// GoogleAuthenticator Google OAuth 검증기
type GoogleAuthenticator struct {
	clientID string
}

// NewGoogleAuthenticator GoogleAuthenticator 생성
func NewGoogleAuthenticator(clientID string) *GoogleAuthenticator {
	return &GoogleAuthenticator{
		clientID: clientID,
	}
}

// VerifyIDToken Google ID Token 검증
func (g *GoogleAuthenticator) VerifyIDToken(ctx context.Context, idToken string) (*GoogleUserInfo, error) {
	payload, err := idtoken.Validate(ctx, idToken, g.clientID)
	if err != nil {
		return nil, ErrInvalidGoogleToken
	}

	// 이메일 확인 여부 체크
	emailVerified, _ := payload.Claims["email_verified"].(bool)
	if !emailVerified {
		return nil, errors.New("email not verified")
	}

	return &GoogleUserInfo{
		ID:            payload.Subject,
		Email:         payload.Claims["email"].(string),
		EmailVerified: emailVerified,
		Name:          getStringClaim(payload.Claims, "name"),
		Picture:       getStringClaim(payload.Claims, "picture"),
	}, nil
}

func getStringClaim(claims map[string]interface{}, key string) string {
	if val, ok := claims[key].(string); ok {
		return val
	}
	return ""
}
