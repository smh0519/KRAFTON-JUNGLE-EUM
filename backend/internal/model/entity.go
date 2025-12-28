package model

import (
	"time"
)

// User 사용자
type User struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Email      string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	Nickname   string    `gorm:"type:varchar(100);not null" json:"nickname"`
	ProfileImg *string   `gorm:"type:text" json:"profile_img,omitempty"`
	Provider   *string   `gorm:"type:varchar(50)" json:"provider,omitempty"`
	ProviderID *string   `gorm:"type:varchar(255)" json:"provider_id,omitempty"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	Workspaces   []WorkspaceMember `gorm:"foreignKey:UserID" json:"workspaces,omitempty"`
	Participants []Participant     `gorm:"foreignKey:UserID" json:"participants,omitempty"`
}

func (User) TableName() string {
	return "users"
}

// Workspace 워크스페이스
type Workspace struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name"`
	OwnerID   int64     `gorm:"not null" json:"owner_id"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	Owner    User              `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Members  []WorkspaceMember `gorm:"foreignKey:WorkspaceID" json:"members,omitempty"`
	Roles    []Role            `gorm:"foreignKey:WorkspaceID" json:"roles,omitempty"`
	Meetings []Meeting         `gorm:"foreignKey:WorkspaceID" json:"meetings,omitempty"`
}

func (Workspace) TableName() string {
	return "workspaces"
}

// Role 역할
type Role struct {
	ID          int64   `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkspaceID int64   `gorm:"not null" json:"workspace_id"`
	Name        string  `gorm:"type:varchar(50);not null" json:"name"`
	Color       *string `gorm:"type:varchar(20)" json:"color,omitempty"`
	IsDefault   bool    `gorm:"default:false" json:"is_default"`

	// Relations
	Workspace   Workspace        `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
	Permissions []RolePermission `gorm:"foreignKey:RoleID" json:"permissions,omitempty"`
}

func (Role) TableName() string {
	return "roles"
}

// RolePermission 역할 권한
type RolePermission struct {
	RoleID         int64  `gorm:"primaryKey" json:"role_id"`
	PermissionCode string `gorm:"primaryKey;type:varchar(50);not null" json:"permission_code"`

	// Relations
	Role Role `gorm:"foreignKey:RoleID" json:"role,omitempty"`
}

func (RolePermission) TableName() string {
	return "role_permissions"
}

// WorkspaceMember 워크스페이스 멤버
type WorkspaceMember struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkspaceID int64     `gorm:"not null" json:"workspace_id"`
	UserID      int64     `gorm:"not null" json:"user_id"`
	RoleID      *int64    `json:"role_id,omitempty"`
	JoinedAt    time.Time `gorm:"autoCreateTime" json:"joined_at"`

	// Relations
	Workspace Workspace `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Role      *Role     `gorm:"foreignKey:RoleID" json:"role,omitempty"`
}

func (WorkspaceMember) TableName() string {
	return "workspace_members"
}

// Meeting 회의
type Meeting struct {
	ID          int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkspaceID *int64     `json:"workspace_id,omitempty"`
	HostID      int64      `gorm:"not null" json:"host_id"`
	Title       string     `gorm:"type:varchar(200);not null" json:"title"`
	Code        string     `gorm:"type:varchar(100);uniqueIndex;not null" json:"code"`
	Type        string     `gorm:"type:varchar(20);not null" json:"type"` // VIDEO, VOICE_ONLY
	Status      string     `gorm:"type:varchar(20);default:'SCHEDULED'" json:"status"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`

	// Relations
	Workspace    *Workspace    `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
	Host         User          `gorm:"foreignKey:HostID" json:"host,omitempty"`
	Participants []Participant `gorm:"foreignKey:MeetingID" json:"participants,omitempty"`
	Whiteboards  []Whiteboard  `gorm:"foreignKey:MeetingID" json:"whiteboards,omitempty"`
	ChatLogs     []ChatLog     `gorm:"foreignKey:MeetingID" json:"chat_logs,omitempty"`
}

func (Meeting) TableName() string {
	return "meetings"
}

// Participant 회의 참가자
type Participant struct {
	ID        int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	MeetingID int64      `gorm:"not null" json:"meeting_id"`
	UserID    *int64     `json:"user_id,omitempty"` // 비회원 허용
	Role      string     `gorm:"type:varchar(20);not null" json:"role"` // HOST, PRESENTER, GUEST
	JoinedAt  time.Time  `gorm:"autoCreateTime" json:"joined_at"`
	LeftAt    *time.Time `json:"left_at,omitempty"`

	// Relations
	Meeting Meeting `gorm:"foreignKey:MeetingID" json:"meeting,omitempty"`
	User    *User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Participant) TableName() string {
	return "participants"
}

// Whiteboard 화이트보드
type Whiteboard struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	MeetingID   *int64    `json:"meeting_id,omitempty"`
	WorkspaceID int64     `gorm:"not null" json:"workspace_id"`
	Data        *string   `gorm:"type:jsonb" json:"data,omitempty"` // JSONB
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	Meeting   *Meeting  `gorm:"foreignKey:MeetingID" json:"meeting,omitempty"`
	Workspace Workspace `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
}

func (Whiteboard) TableName() string {
	return "whiteboards"
}

// ChatLog 채팅 로그
type ChatLog struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	MeetingID int64     `gorm:"not null" json:"meeting_id"`
	SenderID  *int64    `json:"sender_id,omitempty"`
	Message   *string   `gorm:"type:text" json:"message,omitempty"`
	Type      string    `gorm:"type:varchar(20);default:'TEXT'" json:"type"` // TEXT, SYSTEM
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	Meeting Meeting `gorm:"foreignKey:MeetingID" json:"meeting,omitempty"`
	Sender  *User   `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
}

func (ChatLog) TableName() string {
	return "chat_logs"
}
