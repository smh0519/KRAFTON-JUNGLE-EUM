package cache

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// RoomTranscript represents a transcript entry for a room
type RoomTranscript struct {
	RoomID      string    `json:"roomId"`
	SpeakerID   string    `json:"speakerId"`
	SpeakerName string    `json:"speakerName"`
	Original    string    `json:"original"`
	Translated  string    `json:"translated,omitempty"`
	SourceLang  string    `json:"sourceLang"`
	TargetLang  string    `json:"targetLang,omitempty"`
	IsFinal     bool      `json:"isFinal"`
	Timestamp   time.Time `json:"timestamp"`
}

// RedisClient wraps the Redis client for transcript caching
type RedisClient struct {
	client *redis.Client
}

// NewRedisClient creates a new Redis client
func NewRedisClient(addr, password string) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           0,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	log.Printf("[Redis] Connected to %s", addr)
	return &RedisClient{client: client}, nil
}

// AddTranscript adds a transcript to the room's list
func (r *RedisClient) AddTranscript(ctx context.Context, roomID string, t *RoomTranscript) error {
	key := "room:" + roomID + ":transcripts"
	t.Timestamp = time.Now()

	data, err := json.Marshal(t)
	if err != nil {
		return err
	}

	// RPUSH to append to list
	if err := r.client.RPush(ctx, key, data).Err(); err != nil {
		log.Printf("[Redis] Failed to add transcript: %v", err)
		return err
	}

	// Set TTL on first write (24 hours)
	r.client.Expire(ctx, key, 24*time.Hour)

	return nil
}

// GetTranscripts retrieves all transcripts for a room
func (r *RedisClient) GetTranscripts(ctx context.Context, roomID string) ([]RoomTranscript, error) {
	key := "room:" + roomID + ":transcripts"

	results, err := r.client.LRange(ctx, key, 0, -1).Result()
	if err != nil {
		return nil, err
	}

	transcripts := make([]RoomTranscript, 0, len(results))
	for _, data := range results {
		var t RoomTranscript
		if err := json.Unmarshal([]byte(data), &t); err != nil {
			continue
		}
		transcripts = append(transcripts, t)
	}

	return transcripts, nil
}

// GetRecentTranscripts retrieves the last N transcripts for a room
func (r *RedisClient) GetRecentTranscripts(ctx context.Context, roomID string, count int64) ([]RoomTranscript, error) {
	key := "room:" + roomID + ":transcripts"

	// Get last N items
	results, err := r.client.LRange(ctx, key, -count, -1).Result()
	if err != nil {
		return nil, err
	}

	transcripts := make([]RoomTranscript, 0, len(results))
	for _, data := range results {
		var t RoomTranscript
		if err := json.Unmarshal([]byte(data), &t); err != nil {
			continue
		}
		transcripts = append(transcripts, t)
	}

	return transcripts, nil
}

// GetTranscriptCount returns the number of transcripts in a room
func (r *RedisClient) GetTranscriptCount(ctx context.Context, roomID string) (int64, error) {
	key := "room:" + roomID + ":transcripts"
	return r.client.LLen(ctx, key).Result()
}

// SetRoomExpiry sets the expiration time for a room's transcripts
func (r *RedisClient) SetRoomExpiry(ctx context.Context, roomID string, duration time.Duration) error {
	key := "room:" + roomID + ":transcripts"
	return r.client.Expire(ctx, key, duration).Err()
}

// FlushRoom retrieves all transcripts and deletes them from Redis
// Use this when moving data to RDS
func (r *RedisClient) FlushRoom(ctx context.Context, roomID string) ([]RoomTranscript, error) {
	transcripts, err := r.GetTranscripts(ctx, roomID)
	if err != nil {
		return nil, err
	}

	// Delete from Redis
	key := "room:" + roomID + ":transcripts"
	r.client.Del(ctx, key)

	log.Printf("[Redis] Flushed %d transcripts for room %s", len(transcripts), roomID)
	return transcripts, nil
}

// DeleteRoom removes all transcripts for a room
func (r *RedisClient) DeleteRoom(ctx context.Context, roomID string) error {
	key := "room:" + roomID + ":transcripts"
	return r.client.Del(ctx, key).Err()
}

// Close closes the Redis connection
func (r *RedisClient) Close() error {
	return r.client.Close()
}

// Health checks if Redis is healthy
func (r *RedisClient) Health(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// Generic Redis Operations

// Set sets a key-value pair with expiration
func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return r.client.Set(ctx, key, value, expiration).Err()
}

// Get gets a value by key
func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	return r.client.Get(ctx, key).Result()
}

// HGetAll gets all fields and values from a hash
func (r *RedisClient) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return r.client.HGetAll(ctx, key).Result()
}

// HIncrBy increments the integer value of a hash field by the given number
func (r *RedisClient) HIncrBy(ctx context.Context, key, field string, incr int64) (int64, error) {
	return r.client.HIncrBy(ctx, key, field, incr).Result()
}

// SAdd adds one or more members to a set
func (r *RedisClient) SAdd(ctx context.Context, key string, members ...interface{}) error {
	return r.client.SAdd(ctx, key, members...).Err()
}

// SIsMember checks if a member exists in a set
func (r *RedisClient) SIsMember(ctx context.Context, key string, member interface{}) (bool, error) {
	return r.client.SIsMember(ctx, key, member).Result()
}

// SRem removes one or more members from a set
func (r *RedisClient) SRem(ctx context.Context, key string, members ...interface{}) error {
	return r.client.SRem(ctx, key, members...).Err()
}
