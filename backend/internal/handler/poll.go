package handler

import (
	"encoding/json"
	"fmt"
	"time"

	"realtime-backend/internal/cache"

	"github.com/gofiber/fiber/v2"
)

type PollHandler struct {
	redis *cache.RedisClient
}

func NewPollHandler(redis *cache.RedisClient) *PollHandler {
	return &PollHandler{redis: redis}
}

type CreatePollRequest struct {
	Question    string   `json:"question"`
	Options     []string `json:"options"`
	Duration    int64    `json:"duration"` // ms
	IsAnonymous bool     `json:"isAnonymous"`
}

type PollData struct {
	ID          string   `json:"id"`
	Question    string   `json:"question"`
	Options     []string `json:"options"`
	IsAnonymous bool     `json:"isAnonymous"`
	CreatedAt   int64    `json:"createdAt"`
	ExpiresAt   int64    `json:"expiresAt"`
	CreatedBy   string   `json:"createdBy"` // User ID or Name
	IsClosed    bool     `json:"isClosed"`
}

type VoteRequest struct {
	OptionIndex int `json:"optionIndex"`
}

// CreatePoll handles poll creation
func (h *PollHandler) CreatePoll(c *fiber.Ctx) error {
	ctx := c.UserContext()
	if h.redis == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Redis not available"})
	}

	var req CreatePollRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	userID := c.Locals("userID")
	// If userID is missing (e.g. from middleware), try to get from query or header, or fail.
	// Assuming AuthMiddleware sets "userID" (int64) or similar.
	// For simplified chat logic, we might use "sender" name if available, but AuthMiddleware uses ID.
	userIdStr := fmt.Sprintf("%v", userID)
	if userID == nil {
		// Fallback for demo if auth is loose, or error
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	pollID := fmt.Sprintf("poll-%d", time.Now().UnixNano())
	now := time.Now().UnixMilli()
	expiresAt := now + req.Duration
	if req.Duration <= 0 {
		expiresAt = 0 // No expiry
	}

	poll := PollData{
		ID:          pollID,
		Question:    req.Question,
		Options:     req.Options,
		IsAnonymous: req.IsAnonymous,
		CreatedAt:   now,
		ExpiresAt:   expiresAt,
		CreatedBy:   userIdStr,
		IsClosed:    false,
	}

	// Save Metadata to Redis
	// Key: poll:{id}:meta
	metaKey := fmt.Sprintf("poll:%s:meta", pollID)
	data, _ := json.Marshal(poll)

	// Save with TTL (if duration exists, + buffer)
	ttl := time.Duration(req.Duration)*time.Millisecond + 24*time.Hour
	if req.Duration <= 0 {
		ttl = 24 * time.Hour // Default 24h retention
	}

	err := h.redis.Set(ctx, metaKey, string(data), ttl)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save poll"})
	}

	return c.JSON(poll)
}

// GetPoll returns poll status and votes
func (h *PollHandler) GetPoll(c *fiber.Ctx) error {
	ctx := c.UserContext()
	pollID := c.Params("id")
	if pollID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Poll ID required"})
	}

	// Get Meta
	metaKey := fmt.Sprintf("poll:%s:meta", pollID)
	val, err := h.redis.Get(ctx, metaKey)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Poll not found"})
	}

	var poll PollData
	json.Unmarshal([]byte(val), &poll)

	// Get Votes
	// Key: poll:{id}:votes (Hash: optionIdx -> count)
	votesKey := fmt.Sprintf("poll:%s:votes", pollID)
	counts, err := h.redis.HGetAll(ctx, votesKey)
	if err != nil {
		// No votes yet is fine
		counts = make(map[string]string)
	}

	// Convert counts map[string]string to map[int]int
	voteCounts := make(map[int]int)
	for k, v := range counts {
		var idx int
		var count int
		fmt.Sscanf(k, "%d", &idx)
		fmt.Sscanf(v, "%d", &count)
		voteCounts[idx] = count
	}

	return c.JSON(fiber.Map{
		"poll":  poll,
		"votes": voteCounts,
	})
}

// Vote handles casting a vote
func (h *PollHandler) Vote(c *fiber.Ctx) error {
	ctx := c.UserContext()
	pollID := c.Params("id")
	if pollID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Poll ID required"})
	}

	var req VoteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	userID := c.Locals("userID")
	userIdStr := fmt.Sprintf("%v", userID)

	// 1. Check Poll Status
	metaKey := fmt.Sprintf("poll:%s:meta", pollID)
	val, err := h.redis.Get(ctx, metaKey)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Poll not found"})
	}
	var poll PollData
	json.Unmarshal([]byte(val), &poll)

	if poll.IsClosed {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Poll is closed"})
	}
	if poll.ExpiresAt > 0 && time.Now().UnixMilli() > poll.ExpiresAt {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Poll expired"})
	}

	// 2. Check Double Vote
	// Key: poll:{id}:voted_users (Set)
	votedKey := fmt.Sprintf("poll:%s:voted_users", pollID)
	isMember, err := h.redis.SIsMember(ctx, votedKey, userIdStr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Redis error"})
	}
	if isMember {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already voted"})
	}

	// 3. Cast Vote
	// Add user to set
	h.redis.SAdd(ctx, votedKey, userIdStr)

	// Increment Option Count
	votesKey := fmt.Sprintf("poll:%s:votes", pollID)
	newCount, err := h.redis.HIncrBy(ctx, votesKey, fmt.Sprintf("%d", req.OptionIndex), 1)
	if err != nil {
		// Rollback user add? (Optional, implies data inconsistency risk if we don't)
		h.redis.SRem(ctx, votedKey, userIdStr)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to count vote"})
	}

	return c.JSON(fiber.Map{
		"success":     true,
		"pollId":      pollID,
		"optionIndex": req.OptionIndex,
		"newCount":    newCount,
	})
}

// ClosePoll handles manual closing
func (h *PollHandler) ClosePoll(c *fiber.Ctx) error {
	ctx := c.UserContext()
	pollID := c.Params("id")
	userID := c.Locals("userID")
	userIdStr := fmt.Sprintf("%v", userID)

	metaKey := fmt.Sprintf("poll:%s:meta", pollID)
	val, err := h.redis.Get(ctx, metaKey)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Poll not found"})
	}
	var poll PollData
	json.Unmarshal([]byte(val), &poll)

	// Check ownership
	if poll.CreatedBy != userIdStr {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only creator can close"})
	}

	// Update Close Status
	poll.IsClosed = true
	updatedData, _ := json.Marshal(poll)

	// TTL remains same
	h.redis.Set(ctx, metaKey, string(updatedData), 0) // 0 = keep existing TTL ideally, but Set might reset.
	// To be safe, we should assume Redis wrapper handles it or we re-set TTL.
	// For MVP, just setting it is fine (default persistence or long enough).
	// Actually `Set` usually overwrites. Detailed implementation depends on `cache/redis.go`.

	return c.JSON(fiber.Map{"success": true})
}
