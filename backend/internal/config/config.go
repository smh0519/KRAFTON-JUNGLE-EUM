package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config 애플리케이션 전체 설정
type Config struct {
	Server    ServerConfig
	WebSocket WebSocketConfig
	Audio     AudioConfig
	CORS      CORSConfig
	AI        AIConfig
	Auth      AuthConfig
	S3        S3Config
}

// S3Config AWS S3 설정
type S3Config struct {
	Region          string
	BucketName      string
	AccessKeyID     string
	SecretAccessKey string
	PresignExpiry   time.Duration
}

// AuthConfig 인증 설정
type AuthConfig struct {
	JWTSecret          string
	AccessTokenExpiry  time.Duration
	RefreshTokenExpiry time.Duration
	GoogleClientID     string
	SecureCookie       bool
}

// AIConfig AI 서버 설정
type AIConfig struct {
	ServerAddr string
	Enabled    bool
}

// ServerConfig HTTP 서버 설정
type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// WebSocketConfig WebSocket 관련 설정
type WebSocketConfig struct {
	ReadBufferSize   int
	WriteBufferSize  int
	HandshakeTimeout time.Duration
	WriteTimeout     time.Duration
}

// AudioConfig 오디오 처리 설정
type AudioConfig struct {
	ChannelBufferSize int
	ValidSampleRates  []uint32
	MaxChannels       uint16
	ValidBitDepths    []uint16
}

// CORSConfig CORS 설정
type CORSConfig struct {
	AllowOrigins string
	AllowHeaders string
}

// Load 환경 변수에서 설정 로드
func Load() *Config {
	// .env 파일 로드 (없어도 에러 무시)
	if err := godotenv.Load(); err != nil {
		log.Println("ℹ️ No .env file found, using environment variables")
	}

	return &Config{
		Server: ServerConfig{
			Port:         getEnv("PORT", ":8080"),
			ReadTimeout:  getDuration("READ_TIMEOUT", 10*time.Second),
			WriteTimeout: getDuration("WRITE_TIMEOUT", 10*time.Second),
			IdleTimeout:  getDuration("IDLE_TIMEOUT", 120*time.Second),
		},
		WebSocket: WebSocketConfig{
			ReadBufferSize:   getInt("WS_READ_BUFFER_SIZE", 16*1024),
			WriteBufferSize:  getInt("WS_WRITE_BUFFER_SIZE", 16*1024),
			HandshakeTimeout: getDuration("WS_HANDSHAKE_TIMEOUT", 10*time.Second),
			WriteTimeout:     getDuration("WS_WRITE_TIMEOUT", 5*time.Second),
		},
		Audio: AudioConfig{
			ChannelBufferSize: getInt("AUDIO_CHANNEL_BUFFER_SIZE", 100),
			ValidSampleRates:  []uint32{8000, 16000, 22050, 44100, 48000},
			MaxChannels:       uint16(getInt("AUDIO_MAX_CHANNELS", 2)),
			ValidBitDepths:    []uint16{16, 32},
		},
		CORS: CORSConfig{
			AllowOrigins: getEnv("CORS_ALLOW_ORIGINS", "*"),
			AllowHeaders: getEnv("CORS_ALLOW_HEADERS", "Origin, Content-Type, Accept"),
		},
		AI: AIConfig{
			ServerAddr: getEnv("AI_SERVER_ADDR", "localhost:50051"),
			Enabled:    getBool("AI_ENABLED", false),
		},
		Auth: AuthConfig{
			JWTSecret:          getEnv("JWT_SECRET", "change-this-secret-in-production"),
			AccessTokenExpiry:  getDuration("ACCESS_TOKEN_EXPIRY", 1*time.Hour),
			RefreshTokenExpiry: getDuration("REFRESH_TOKEN_EXPIRY", 7*24*time.Hour),
			GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
			SecureCookie:       getBool("SECURE_COOKIE", false),
		},
		S3: S3Config{
			Region:          getEnv("AWS_REGION", "ap-northeast-2"),
			BucketName:      getEnv("AWS_S3_BUCKET", ""),
			AccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", ""),
			SecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),
			PresignExpiry:   getDuration("S3_PRESIGN_EXPIRY", 15*time.Minute),
		},
	}
}

// getEnv 환경 변수 조회 (기본값 지원)
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getInt 정수형 환경 변수 조회
func getInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

// getBool 불리언 환경 변수 조회
func getBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}

// getDuration 시간 환경 변수 조회
func getDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		// 숫자만 있으면 초로 간주
		if !strings.ContainsAny(value, "smh") {
			if secs, err := strconv.Atoi(value); err == nil {
				return time.Duration(secs) * time.Second
			}
		}
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
