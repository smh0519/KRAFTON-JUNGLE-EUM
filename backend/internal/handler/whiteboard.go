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
	Stroke any    `json:"stroke,omitempty"`
	Type   string `json:"type,omitempty"` // add, clear, undo, redo
}

func (h *WhiteboardHandler) GetWhiteboard(c *fiber.Ctx) error {
	roomName := c.Query("room")
	if roomName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Room name is required"})
	}

	var meeting model.Meeting
	found := false
	if strings.HasPrefix(roomName, "meeting-") {
		idStr := strings.TrimPrefix(roomName, "meeting-")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err == nil {
			if err := h.db.First(&meeting, id).Error; err == nil {
				found = true
			}
		}
	}

	if !found {
		if err := h.db.Where("code = ?", roomName).First(&meeting).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Meeting not found"})
		}
	}

	var whiteboard model.Whiteboard
	err := h.db.Where("meeting_id = ?", meeting.ID).First(&whiteboard).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error"})
	}

	history := []any{}
	if whiteboard.Data != nil {
		if err := json.Unmarshal([]byte(*whiteboard.Data), &history); err != nil {
			log.Printf("warning: failed to unmarshal whiteboard history: %v", err)
			history = []any{}
		}
	}

	redoStack := []any{}
	if whiteboard.RedoData != nil {
		if err := json.Unmarshal([]byte(*whiteboard.RedoData), &redoStack); err != nil {
			log.Printf("warning: failed to unmarshal whiteboard redo stack: %v", err)
			redoStack = []any{}
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"history": history,
		"canUndo": len(history) > 0,
		"canRedo": len(redoStack) > 0,
	})
}

func (h *WhiteboardHandler) HandleWhiteboard(c *fiber.Ctx) error {
	var req WhiteboardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Room == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Room name is required"})
	}

	var meeting model.Meeting
	found := false
	if strings.HasPrefix(req.Room, "meeting-") {
		idStr := strings.TrimPrefix(req.Room, "meeting-")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err == nil {
			if err := h.db.First(&meeting, id).Error; err == nil {
				found = true
			}
		}
	}

	if !found {
		if err := h.db.Where("code = ?", req.Room).First(&meeting).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Meeting not found"})
		}
	}

	var whiteboard model.Whiteboard
	isNew := false
	if err := h.db.Where("meeting_id = ?", meeting.ID).First(&whiteboard).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			wsID := int64(0)
			if meeting.WorkspaceID != nil {
				wsID = *meeting.WorkspaceID
			}
			whiteboard = model.Whiteboard{
				MeetingID:   &meeting.ID,
				WorkspaceID: wsID,
			}
			isNew = true
		} else {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error"})
		}
	}

	history := []any{}
	if whiteboard.Data != nil {
		if err := json.Unmarshal([]byte(*whiteboard.Data), &history); err != nil {
			log.Printf("warning: failed to unmarshal whiteboard history: %v", err)
			history = []any{}
		}
	}

	redoStack := []any{}
	if whiteboard.RedoData != nil {
		if err := json.Unmarshal([]byte(*whiteboard.RedoData), &redoStack); err != nil {
			log.Printf("warning: failed to unmarshal whiteboard redo stack: %v", err)
			redoStack = []any{}
		}
	}

	switch req.Type {
	case "clear":
		whiteboard.Data = nil
		whiteboard.RedoData = nil

	case "undo":
		if len(history) > 0 {
			last := history[len(history)-1]
			history = history[:len(history)-1]
			redoStack = append(redoStack, last)
		}

	case "redo":
		if len(redoStack) > 0 {
			last := redoStack[len(redoStack)-1]
			redoStack = redoStack[:len(redoStack)-1]
			history = append(history, last)
		}

	default: // "add" or just stroke data
		if req.Stroke != nil {
			history = append(history, req.Stroke)
			redoStack = []any{} // Clear redo stack on new stroke
		}
	}

	hData, _ := json.Marshal(history)
	rData, _ := json.Marshal(redoStack)
	hStr := string(hData)
	rStr := string(rData)
	whiteboard.Data = &hStr
	whiteboard.RedoData = &rStr
	whiteboard.UpdatedAt = time.Now()

	var err error
	if isNew {
		err = h.db.Create(&whiteboard).Error
	} else {
		err = h.db.Save(&whiteboard).Error
	}

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save whiteboard"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"history": history,
		"canUndo": len(history) > 0,
		"canRedo": len(redoStack) > 0,
	})
}
