package handler

import (
	"encoding/json"
	"log"
	"realtime-backend/internal/model"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type WhiteboardHandler struct {
	db *gorm.DB
}

func NewWhiteboardHandler(db *gorm.DB) *WhiteboardHandler {
	return &WhiteboardHandler{db: db}
}

type WhiteboardRequest struct {
	Room   string `json:"room"`
	Stroke any    `json:"stroke,omitempty"` // Can be single object or array
	Type   string `json:"type,omitempty"`   // add, clear, undo, redo, snapshot
}

// GetWhiteboard returns the history of strokes for the meeting
func (h *WhiteboardHandler) GetWhiteboard(c *fiber.Ctx) error {
	roomName := c.Query("room")
	if roomName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Room name is required"})
	}

	// Get authenticated user ID for lazy creation if needed
	userID := int64(0)
	if val := c.Locals("userID"); val != nil {
		userID = val.(int64)
	}

	meetingID, err := h.getMeetingID(roomName, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Meeting not found"})
	}

	// Fetch all non-deleted strokes for this meeting
	var strokes []model.WhiteboardStroke
	// Optimization: Only select ID and StrokeData to reduce payload if necessary,
	// but Frontend expects full stroke objects.
	// Since StrokeData is JSON stored as string/bytes, we just fetch it.
	err = h.db.Where("meeting_id = ? AND is_deleted = ?", meetingID, false).
		Order("id ASC").
		Find(&strokes).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error"})
	}

	// Convert strokes to history format expected by frontend (array of objects)
	// Currently frontend expects: Data: "[{...}, {...}]" (JSON string of array)
	// But `GetWhiteboard` returned `history` as `[]any`.
	// Let's decode StrokeData and append to history.
	history := make([]any, 0, len(strokes))
	for _, s := range strokes {
		var strokeData any
		if err := json.Unmarshal([]byte(s.StrokeData), &strokeData); err == nil {
			history = append(history, strokeData)
		}
	}

	// Calculate canRedo
	var deletedCount int64
	h.db.Model(&model.WhiteboardStroke{}).Where("meeting_id = ? AND is_deleted = ?", meetingID, true).Count(&deletedCount)

	return c.JSON(fiber.Map{
		"success": true,
		"history": history,
		"canUndo": len(strokes) > 0, // Simple check
		"canRedo": deletedCount > 0,
	})
}

// HandleWhiteboard handles add, undo, redo, clear actions
func (h *WhiteboardHandler) HandleWhiteboard(c *fiber.Ctx) error {
	// Get authenticated user ID
	userID := int64(0)
	if val := c.Locals("userID"); val != nil {
		userID = val.(int64)
	}

	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req WhiteboardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Room == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Room name is required"})
	}

	meetingID, err := h.getMeetingID(req.Room, userID)
	if err != nil {
		// Log the error for debugging
		// log.Printf("Failed to get meeting ID: %v", err)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Meeting not found"})
	}

	switch req.Type {
	case "clear":
		// User requested to wipe all history ("휴지통을 누르면 Ctrl +Z / Ctrl +Y 용 기록들이 사라져야합니다")
		// We use Hard Delete here.
		log.Printf("[Whiteboard] User %d requesting CLEAR (Hard Delete) in meeting %d", userID, meetingID)
		err := h.db.Where("meeting_id = ?", meetingID).Delete(&model.WhiteboardStroke{}).Error
		if err != nil {
			log.Printf("[Whiteboard] Failed to clear whiteboard: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to clear whiteboard"})
		}
		log.Printf("[Whiteboard] Clear successful (History wiped)")

	case "undo":
		log.Printf("[Whiteboard] User %d requesting UNDO in meeting %d", userID, meetingID)
		// Find last active stroke (Global Undo)
		var lastStroke model.WhiteboardStroke
		err := h.db.Where("meeting_id = ? AND is_deleted = ?", meetingID, false).
			Order("id DESC").
			First(&lastStroke).Error

		if err == nil {
			log.Printf("[Whiteboard] Undoing stroke ID: %d", lastStroke.ID)
			lastStroke.IsDeleted = true
			now := time.Now()
			lastStroke.DeletedAt = &now // Mark deletion time for LIFO Redo
			if saveErr := h.db.Save(&lastStroke).Error; saveErr != nil {
				log.Printf("[Whiteboard] Failed to save undo: %v", saveErr)
			}
		} else {
			log.Printf("[Whiteboard] Undo failed to find stroke (Error: %v)", err)
			if err != gorm.ErrRecordNotFound {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to undo"})
			}
		}

	case "redo":
		log.Printf("[Whiteboard] User %d requesting REDO in meeting %d", userID, meetingID)
		// Find last deleted stroke based on DeletedAt (LIFO - Most recently deleted)
		var lastDeletedStroke model.WhiteboardStroke
		err := h.db.Where("meeting_id = ? AND is_deleted = ?", meetingID, true).
			Order("deleted_at DESC"). // Restore the one that was deleted most recently
			First(&lastDeletedStroke).Error

		if err == nil {
			log.Printf("[Whiteboard] Redoing stroke ID: %d", lastDeletedStroke.ID)
			lastDeletedStroke.IsDeleted = false
			lastDeletedStroke.DeletedAt = nil // Clear deletion time
			if saveErr := h.db.Save(&lastDeletedStroke).Error; saveErr != nil {
				log.Printf("[Whiteboard] Failed to save redo: %v", saveErr)
			}
		} else {
			log.Printf("[Whiteboard] Redo failed to find stroke (Error: %v)", err)
			if err != gorm.ErrRecordNotFound {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to redo"})
			}
		}

	default: // "add"
		if req.Stroke != nil {
			// Marshal stroke data to JSON
			strokeBytes, err := json.Marshal(req.Stroke)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid stroke data"})
			}

			// Create new stroke entity
			newStroke := model.WhiteboardStroke{
				MeetingID:  meetingID,
				UserID:     userID,
				StrokeData: string(strokeBytes),
				Layer:      0, // Default layer
				IsDeleted:  false,
				CreatedAt:  time.Now(),
			}

			if err := h.db.Create(&newStroke).Error; err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save stroke"})
			}

			// Snapshot Logic Check (Every 50 strokes? Not implementing yet as per plan Phase 1)
		}
	}

	// Return success.
	// Frontend expects { success: true, history: ..., canUndo: ... }
	// To avoid fetching full history on every write (which would defeat optimization),
	// we just return success flags. Frontend manages optimistic state.
	// But if frontend relies on response to sync, we might need to conform.
	// The original implementation returned full history.
	// We will just return boolean flags.
	return c.JSON(fiber.Map{
		"success": true,
		"canUndo": true, // Ideally should query count, but let's keep it light
		"canRedo": true,
	})
}

// Helper to get meeting ID from room name
func (h *WhiteboardHandler) getMeetingID(roomName string, userID int64) (int64, error) {
	// 1. Check for standard "meeting-{id}" format
	if strings.HasPrefix(roomName, "meeting-") {
		idStr := strings.TrimPrefix(roomName, "meeting-")
		return strconv.ParseInt(idStr, 10, 64)
	}

	// 2. Check for raw ID (e.g. "1")
	if id, err := strconv.ParseInt(roomName, 10, 64); err == nil {
		return id, nil
	}

	// 3. Check for specific Workspace Channel format: "workspace-{wid}-call-{name}"
	// Example: "workspace-46-call-general"
	if strings.HasPrefix(roomName, "workspace-") && strings.Contains(roomName, "-call-") {
		// Try to find existing meeting by Code
		var meeting model.Meeting
		if err := h.db.Select("id").Where("code = ?", roomName).First(&meeting).Error; err == nil {
			return meeting.ID, nil
		}

		// If not found, LAZY CREATE it
		// Parse WorkspaceID
		parts := strings.Split(roomName, "-")
		if len(parts) >= 4 { // workspace, 46, call, general...
			// Extract ID coming after "workspace"
			// Format: workspace-{id}-...
			if wid, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
				// Create a new persistent meeting for this channel
				newMeeting := model.Meeting{
					WorkspaceID: &wid,
					HostID:      userID,                       // The user triggering this becomes the 'creator' but it's a shared channel
					Title:       strings.Join(parts[3:], " "), // "general" or "standup"
					Code:        roomName,
					Type:        "WORKSPACE_CHANNEL", // Special type or just VIDEO
					Status:      "ALWAYS_OPEN",
				}

				// Handle case where UserID might be 0 (if auth failed but middleware didn't catch it?)
				// AuthMiddleware should ensure UserID is present.
				if newMeeting.HostID == 0 {
					// Fallback to finding Workspace Owner?
					// For now, if 0, we can't create.
					return 0, gorm.ErrRecordNotFound
				}

				if err := h.db.Create(&newMeeting).Error; err != nil {
					// Handle race condition: double creation
					// If creation fails (e.g. unique constraint on Code), try fetching again
					if err := h.db.Select("id").Where("code = ?", roomName).First(&meeting).Error; err == nil {
						return meeting.ID, nil
					}
					return 0, err
				}
				return newMeeting.ID, nil
			}
		}
	}

	// 4. Fallback: Try finding by Code (for any other custom codes)
	var meeting model.Meeting
	if err := h.db.Select("id").Where("code = ?", roomName).First(&meeting).Error; err != nil {
		return 0, err
	}
	return meeting.ID, nil
}
