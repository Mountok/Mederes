package models

import "time"

type LiveRoom struct {
	ID              string     `db:"id" json:"id"`
	SchoolID        string     `db:"school_id" json:"-"`
	GroupID         *string    `db:"group_id" json:"group_id"`
	TeacherID       string     `db:"teacher_id" json:"-"`
	LivekitRoomName string     `db:"livekit_room_name" json:"-"`
	Title           string     `db:"title" json:"title"`
	JoinCode        string     `db:"join_code" json:"join_code"`
	Status          string     `db:"status" json:"status"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	EndedAt         *time.Time `db:"ended_at" json:"ended_at"`
}

type LiveParticipant struct {
	ID          string     `db:"id" json:"id"`
	RoomID      string     `db:"room_id" json:"room_id"`
	UserID      *string    `db:"user_id" json:"user_id"`
	DisplayName string     `db:"display_name" json:"display_name"`
	Role        string     `db:"role" json:"role"`
	JoinedAt    time.Time  `db:"joined_at" json:"joined_at"`
	LeftAt      *time.Time `db:"left_at" json:"left_at"`
}

type LiveChatMessage struct {
	ID            string    `db:"id" json:"id"`
	RoomID        string    `db:"room_id" json:"room_id"`
	ParticipantID *string   `db:"participant_id" json:"participant_id"`
	DisplayName   string    `db:"display_name" json:"display_name"`
	Role          string    `db:"role" json:"role"`
	Message       string    `db:"message" json:"message"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

type LiveCreateRoomRequest struct {
	GroupID *string `json:"group_id"`
	Title   string  `json:"title"`
}

type LiveRoomParticipantResponse struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

type LiveCreateRoomResponse struct {
	ID          string                      `json:"id"`
	GroupID     *string                     `json:"group_id"`
	Title       string                      `json:"title"`
	JoinCode    string                      `json:"join_code"`
	Status      string                      `json:"status"`
	LiveKitURL  string                      `json:"livekit_url"`
	Token       string                      `json:"token"`
	CreatedAt   time.Time                   `json:"created_at"`
	Participant LiveRoomParticipantResponse `json:"participant"`
}

type LiveRoomResponse struct {
	ID        string     `json:"id"`
	GroupID   *string    `json:"group_id"`
	Title     string     `json:"title"`
	JoinCode  string     `json:"join_code"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	EndedAt   *time.Time `json:"ended_at"`
}

type LiveJoinRoomRequest struct {
	JoinCode    string `json:"join_code"`
	DisplayName string `json:"display_name"`
}

type LiveJoinRoomResponse struct {
	Room struct {
		ID     string `json:"id"`
		Title  string `json:"title"`
		Status string `json:"status"`
	} `json:"room"`
	Participant LiveRoomParticipantResponse `json:"participant"`
	LiveKitURL  string                      `json:"livekit_url"`
	Token       string                      `json:"token"`
}

type LiveTokenRequest struct {
	ParticipantID string `json:"participant_id"`
}

type LiveTokenResponse struct {
	LiveKitURL string `json:"livekit_url"`
	Token      string `json:"token"`
}

type LiveEndRoomResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type LiveMessagesResponse struct {
	Messages []LiveChatMessage `json:"messages"`
}

type LiveSendMessageRequest struct {
	ParticipantID string `json:"participant_id"`
	Message       string `json:"message"`
}

type LiveWSEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

type LiveWSClientMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type LiveParticipantPresence struct {
	ParticipantID string `json:"participant_id"`
	DisplayName   string `json:"display_name"`
	Role          string `json:"role"`
}
