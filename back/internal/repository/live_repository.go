package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"

	"medrese-back/internal/models"
)

type LiveRepository interface {
	CreateRoom(ctx context.Context, room *models.LiveRoom) error
	GetRoomByID(ctx context.Context, roomID string) (*models.LiveRoom, error)
	GetRoomByIDAndSchool(ctx context.Context, roomID string, schoolID string) (*models.LiveRoom, error)
	GetRoomByJoinCode(ctx context.Context, joinCode string) (*models.LiveRoom, error)
	JoinCodeExists(ctx context.Context, joinCode string) (bool, error)
	EndRoom(ctx context.Context, roomID string, endedAt time.Time) error
	CreateParticipant(ctx context.Context, participant *models.LiveParticipant) error
	GetParticipantByID(ctx context.Context, participantID string) (*models.LiveParticipant, error)
	GetParticipantByIDInRoom(ctx context.Context, roomID string, participantID string) (*models.LiveParticipant, error)
	GetTeacherParticipant(ctx context.Context, roomID string, teacherID string) (*models.LiveParticipant, error)
	MarkParticipantLeft(ctx context.Context, participantID string, leftAt time.Time) error
	CreateMessage(ctx context.Context, message *models.LiveChatMessage) error
	ListMessages(ctx context.Context, roomID string, limit int) ([]models.LiveChatMessage, error)
}

type liveRepository struct {
	db *sqlx.DB
}

func NewLiveRepository(db *sqlx.DB) LiveRepository {
	return &liveRepository{db: db}
}

func (r *liveRepository) CreateRoom(ctx context.Context, room *models.LiveRoom) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO live_rooms (id, school_id, group_id, teacher_id, livekit_room_name, title, join_code, status, created_at, ended_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, room.ID, room.SchoolID, room.GroupID, room.TeacherID, room.LivekitRoomName, room.Title, room.JoinCode, room.Status, room.CreatedAt, room.EndedAt)
	return err
}

func (r *liveRepository) GetRoomByID(ctx context.Context, roomID string) (*models.LiveRoom, error) {
	var room models.LiveRoom
	if err := r.db.GetContext(ctx, &room, `
		SELECT id, school_id, group_id, teacher_id, livekit_room_name, title, join_code, status, created_at, ended_at
		FROM live_rooms
		WHERE id = $1
	`, roomID); err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *liveRepository) GetRoomByIDAndSchool(ctx context.Context, roomID string, schoolID string) (*models.LiveRoom, error) {
	var room models.LiveRoom
	if err := r.db.GetContext(ctx, &room, `
		SELECT id, school_id, group_id, teacher_id, livekit_room_name, title, join_code, status, created_at, ended_at
		FROM live_rooms
		WHERE id = $1 AND school_id = $2
	`, roomID, schoolID); err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *liveRepository) GetRoomByJoinCode(ctx context.Context, joinCode string) (*models.LiveRoom, error) {
	var room models.LiveRoom
	if err := r.db.GetContext(ctx, &room, `
		SELECT id, school_id, group_id, teacher_id, livekit_room_name, title, join_code, status, created_at, ended_at
		FROM live_rooms
		WHERE join_code = $1
	`, joinCode); err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *liveRepository) JoinCodeExists(ctx context.Context, joinCode string) (bool, error) {
	var exists bool
	if err := r.db.GetContext(ctx, &exists, `
		SELECT EXISTS(SELECT 1 FROM live_rooms WHERE join_code = $1)
	`, joinCode); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *liveRepository) EndRoom(ctx context.Context, roomID string, endedAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE live_rooms
		SET status = 'ended',
			ended_at = $2
		WHERE id = $1
	`, roomID, endedAt)
	return err
}

func (r *liveRepository) CreateParticipant(ctx context.Context, participant *models.LiveParticipant) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO live_participants (id, room_id, user_id, display_name, role, joined_at, left_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, participant.ID, participant.RoomID, participant.UserID, participant.DisplayName, participant.Role, participant.JoinedAt, participant.LeftAt)
	return err
}

func (r *liveRepository) GetParticipantByID(ctx context.Context, participantID string) (*models.LiveParticipant, error) {
	var participant models.LiveParticipant
	if err := r.db.GetContext(ctx, &participant, `
		SELECT id, room_id, user_id, display_name, role, joined_at, left_at
		FROM live_participants
		WHERE id = $1
	`, participantID); err != nil {
		return nil, err
	}
	return &participant, nil
}

func (r *liveRepository) GetParticipantByIDInRoom(ctx context.Context, roomID string, participantID string) (*models.LiveParticipant, error) {
	var participant models.LiveParticipant
	if err := r.db.GetContext(ctx, &participant, `
		SELECT id, room_id, user_id, display_name, role, joined_at, left_at
		FROM live_participants
		WHERE id = $1 AND room_id = $2
	`, participantID, roomID); err != nil {
		return nil, err
	}
	return &participant, nil
}

func (r *liveRepository) GetTeacherParticipant(ctx context.Context, roomID string, teacherID string) (*models.LiveParticipant, error) {
	var participant models.LiveParticipant
	if err := r.db.GetContext(ctx, &participant, `
		SELECT id, room_id, user_id, display_name, role, joined_at, left_at
		FROM live_participants
		WHERE room_id = $1 AND user_id = $2 AND role = 'teacher'
		ORDER BY joined_at ASC
		LIMIT 1
	`, roomID, teacherID); err != nil {
		return nil, err
	}
	return &participant, nil
}

func (r *liveRepository) MarkParticipantLeft(ctx context.Context, participantID string, leftAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE live_participants
		SET left_at = $2
		WHERE id = $1
	`, participantID, leftAt)
	return err
}

func (r *liveRepository) CreateMessage(ctx context.Context, message *models.LiveChatMessage) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO live_chat_messages (id, room_id, participant_id, display_name, role, message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, message.ID, message.RoomID, message.ParticipantID, message.DisplayName, message.Role, message.Message, message.CreatedAt)
	return err
}

func (r *liveRepository) ListMessages(ctx context.Context, roomID string, limit int) ([]models.LiveChatMessage, error) {
	var messages []models.LiveChatMessage
	if err := r.db.SelectContext(ctx, &messages, `
		SELECT id, room_id, participant_id, display_name, role, message, created_at
		FROM (
			SELECT id, room_id, participant_id, display_name, role, message, created_at
			FROM live_chat_messages
			WHERE room_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		) t
		ORDER BY created_at ASC
	`, roomID, limit); err != nil {
		return nil, err
	}
	return messages, nil
}
