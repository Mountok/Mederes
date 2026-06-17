package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	livekitclient "medrese-back/internal/livekit"
	"medrese-back/internal/models"
	"medrese-back/internal/repository"
	"medrese-back/pkg/auth"
)

const (
	maxLiveJoinCodeAttempts = 5
	liveJoinCodeAlphabet    = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
)

type LiveService struct {
	liveRepo      repository.LiveRepository
	groupRepo     repository.GroupRepository
	liveKitClient *livekitclient.Client
}

func NewLiveService(
	liveRepo repository.LiveRepository,
	groupRepo repository.GroupRepository,
	liveKitClient *livekitclient.Client,
) *LiveService {
	return &LiveService{
		liveRepo:      liveRepo,
		groupRepo:     groupRepo,
		liveKitClient: liveKitClient,
	}
}

func (s *LiveService) CreateRoom(ctx context.Context, claims *auth.Claims, request models.LiveCreateRoomRequest) (*models.LiveCreateRoomResponse, error) {
	if claims == nil || claims.Role != "teacher" {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	title := strings.TrimSpace(request.Title)
	if title == "" {
		return nil, models.ValidationError("Введите название трансляции")
	}
	if len(title) > 120 {
		return nil, models.ValidationError("Название трансляции слишком длинное")
	}

	groupID := normalizeOptionalString(request.GroupID)
	if groupID != nil {
		if _, err := s.groupRepo.GetByID(ctx, *groupID, claims.SchoolID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.NotFoundError("Группа не найдена")
			}
			return nil, models.InternalError("Не удалось проверить группу трансляции", err)
		}
	}

	roomID := uuid.NewString()
	createdAt := time.Now().UTC()
	room := &models.LiveRoom{
		ID:              roomID,
		SchoolID:        claims.SchoolID,
		GroupID:         groupID,
		TeacherID:       claims.UserID,
		LivekitRoomName: "live-" + roomID,
		Title:           title,
		Status:          "active",
		CreatedAt:       createdAt,
	}

	for range maxLiveJoinCodeAttempts {
		joinCode, err := randomString(liveJoinCodeAlphabet, 6)
		if err != nil {
			return nil, models.InternalError("Не удалось сгенерировать код подключения", err)
		}

		room.JoinCode = joinCode
		if err := s.liveRepo.CreateRoom(ctx, room); err != nil {
			if isUniqueViolation(err) {
				continue
			}
			return nil, models.InternalError("Не удалось создать трансляцию", err)
		}

		participant, err := s.ensureTeacherParticipant(ctx, room)
		if err != nil {
			return nil, err
		}

		token, err := s.liveKitClient.IssueToken(room.LivekitRoomName, participant.ID, participant.DisplayName, participant.Role)
		if err != nil {
			return nil, models.InternalError("Не удалось создать LiveKit токен", err)
		}

		return &models.LiveCreateRoomResponse{
			ID:         room.ID,
			GroupID:    room.GroupID,
			Title:      room.Title,
			JoinCode:   room.JoinCode,
			Status:     room.Status,
			LiveKitURL: s.liveKitClient.PublicURL(),
			Token:      token,
			CreatedAt:  room.CreatedAt,
			Participant: models.LiveRoomParticipantResponse{
				ID:          participant.ID,
				DisplayName: participant.DisplayName,
				Role:        participant.Role,
			},
		}, nil
	}

	return nil, models.ConflictError("Не удалось сгенерировать уникальный код подключения")
}

func (s *LiveService) GetRoom(ctx context.Context, claims *auth.Claims, roomID string) (*models.LiveRoomResponse, error) {
	room, err := s.getOwnedTeacherRoom(ctx, claims, roomID)
	if err != nil {
		return nil, err
	}

	return &models.LiveRoomResponse{
		ID:        room.ID,
		GroupID:   room.GroupID,
		Title:     room.Title,
		JoinCode:  room.JoinCode,
		Status:    room.Status,
		CreatedAt: room.CreatedAt,
		EndedAt:   room.EndedAt,
	}, nil
}

func (s *LiveService) JoinRoom(ctx context.Context, claims *auth.Claims, request models.LiveJoinRoomRequest) (*models.LiveJoinRoomResponse, error) {
	joinCode := strings.ToUpper(strings.TrimSpace(request.JoinCode))
	if len(joinCode) < 6 || len(joinCode) > 10 {
		return nil, models.ValidationError("Некорректный код подключения")
	}

	displayName := strings.TrimSpace(request.DisplayName)
	if len(displayName) < 2 || len(displayName) > 80 {
		return nil, models.ValidationError("Укажите имя участника от 2 до 80 символов")
	}

	room, err := s.liveRepo.GetRoomByJoinCode(ctx, joinCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Трансляция не найдена")
		}
		return nil, models.InternalError("Не удалось найти трансляцию", err)
	}
	if room.Status == "ended" {
		return nil, models.RoomEndedError("Трансляция завершена")
	}

	role := "student"
	var userID *string
	if claims != nil {
		if claims.Role != "student" && claims.Role != "parent" {
			return nil, models.ForbiddenError("Недостаточно прав")
		}
		if claims.SchoolID != room.SchoolID {
			return nil, models.ForbiddenError("Недостаточно прав")
		}
		role = claims.Role
		userID = &claims.UserID
	}

	participant := &models.LiveParticipant{
		ID:          uuid.NewString(),
		RoomID:      room.ID,
		UserID:      userID,
		DisplayName: displayName,
		Role:        role,
		JoinedAt:    time.Now().UTC(),
	}

	if err := s.liveRepo.CreateParticipant(ctx, participant); err != nil {
		return nil, models.InternalError("Не удалось добавить участника трансляции", err)
	}

	token, err := s.liveKitClient.IssueToken(room.LivekitRoomName, participant.ID, participant.DisplayName, participant.Role)
	if err != nil {
		return nil, models.InternalError("Не удалось создать LiveKit токен", err)
	}

	response := &models.LiveJoinRoomResponse{
		Participant: models.LiveRoomParticipantResponse{
			ID:          participant.ID,
			DisplayName: participant.DisplayName,
			Role:        participant.Role,
		},
		LiveKitURL: s.liveKitClient.PublicURL(),
		Token:      token,
	}
	response.Room.ID = room.ID
	response.Room.Title = room.Title
	response.Room.Status = room.Status

	return response, nil
}

func (s *LiveService) IssueToken(ctx context.Context, roomID string, claims *auth.Claims, participantID string) (*models.LiveTokenResponse, error) {
	room, participant, err := s.resolveRoomParticipant(ctx, roomID, claims, participantID, true)
	if err != nil {
		return nil, err
	}
	if room.Status == "ended" {
		return nil, models.RoomEndedError("Трансляция завершена")
	}

	token, err := s.liveKitClient.IssueToken(room.LivekitRoomName, participant.ID, participant.DisplayName, participant.Role)
	if err != nil {
		return nil, models.InternalError("Не удалось создать LiveKit токен", err)
	}

	return &models.LiveTokenResponse{
		LiveKitURL: s.liveKitClient.PublicURL(),
		Token:      token,
	}, nil
}

func (s *LiveService) EndRoom(ctx context.Context, claims *auth.Claims, roomID string) error {
	room, err := s.getOwnedTeacherRoom(ctx, claims, roomID)
	if err != nil {
		return err
	}

	if room.Status == "ended" {
		return nil
	}

	if err := s.liveRepo.EndRoom(ctx, room.ID, time.Now().UTC()); err != nil {
		return models.InternalError("Не удалось завершить трансляцию", err)
	}

	_ = s.liveKitClient.EndRoom(ctx, room.LivekitRoomName)
	return nil
}

func (s *LiveService) ListMessages(ctx context.Context, roomID string, claims *auth.Claims, participantID string, limit int) (*models.LiveMessagesResponse, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	if _, _, err := s.resolveRoomParticipant(ctx, roomID, claims, participantID, false); err != nil {
		return nil, err
	}

	messages, err := s.liveRepo.ListMessages(ctx, roomID, limit)
	if err != nil {
		return nil, models.InternalError("Не удалось получить сообщения трансляции", err)
	}
	if messages == nil {
		messages = []models.LiveChatMessage{}
	}

	return &models.LiveMessagesResponse{Messages: messages}, nil
}

func (s *LiveService) SendMessage(ctx context.Context, roomID string, claims *auth.Claims, request models.LiveSendMessageRequest) (*models.LiveChatMessage, error) {
	messageText := strings.TrimSpace(request.Message)
	if len(messageText) < 1 || len(messageText) > 1000 {
		return nil, models.ValidationError("Сообщение должно быть от 1 до 1000 символов")
	}

	room, participant, err := s.resolveRoomParticipant(ctx, roomID, claims, request.ParticipantID, true)
	if err != nil {
		return nil, err
	}
	if room.Status == "ended" {
		return nil, models.RoomEndedError("Трансляция завершена")
	}

	participantID := participant.ID
	message := &models.LiveChatMessage{
		ID:            uuid.NewString(),
		RoomID:        room.ID,
		ParticipantID: &participantID,
		DisplayName:   participant.DisplayName,
		Role:          participant.Role,
		Message:       messageText,
		CreatedAt:     time.Now().UTC(),
	}

	if err := s.liveRepo.CreateMessage(ctx, message); err != nil {
		return nil, models.InternalError("Не удалось отправить сообщение", err)
	}

	return message, nil
}

func (s *LiveService) ResolveWebsocketParticipant(ctx context.Context, roomID string, claims *auth.Claims, participantID string) (*models.LiveRoom, *models.LiveParticipant, error) {
	room, participant, err := s.resolveRoomParticipant(ctx, roomID, claims, participantID, true)
	if err != nil {
		return nil, nil, err
	}
	if room.Status == "ended" {
		return nil, nil, models.RoomEndedError("Трансляция завершена")
	}
	return room, participant, nil
}

func (s *LiveService) MarkParticipantLeft(ctx context.Context, participantID string) error {
	if strings.TrimSpace(participantID) == "" {
		return nil
	}
	if err := s.liveRepo.MarkParticipantLeft(ctx, participantID, time.Now().UTC()); err != nil {
		return models.InternalError("Не удалось обновить статус участника", err)
	}
	return nil
}

func (s *LiveService) getOwnedTeacherRoom(ctx context.Context, claims *auth.Claims, roomID string) (*models.LiveRoom, error) {
	if claims == nil || claims.Role != "teacher" {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	room, err := s.liveRepo.GetRoomByIDAndSchool(ctx, roomID, claims.SchoolID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.NotFoundError("Трансляция не найдена")
		}
		return nil, models.InternalError("Не удалось получить трансляцию", err)
	}

	if room.TeacherID != claims.UserID {
		return nil, models.ForbiddenError("Недостаточно прав")
	}

	return room, nil
}

func (s *LiveService) resolveRoomParticipant(ctx context.Context, roomID string, claims *auth.Claims, participantID string, allowTeacher bool) (*models.LiveRoom, *models.LiveParticipant, error) {
	room, err := s.liveRepo.GetRoomByID(ctx, roomID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, models.NotFoundError("Трансляция не найдена")
		}
		return nil, nil, models.InternalError("Не удалось получить трансляцию", err)
	}

	if claims != nil && claims.Role == "teacher" {
		if !allowTeacher {
			return nil, nil, models.ForbiddenError("Недостаточно прав")
		}
		if claims.SchoolID != room.SchoolID || claims.UserID != room.TeacherID {
			return nil, nil, models.ForbiddenError("Недостаточно прав")
		}
		participant, err := s.ensureTeacherParticipant(ctx, room)
		if err != nil {
			return nil, nil, err
		}
		return room, participant, nil
	}

	participantID = strings.TrimSpace(participantID)
	if participantID == "" {
		return nil, nil, models.ValidationError("participant_id обязателен")
	}

	participant, err := s.liveRepo.GetParticipantByIDInRoom(ctx, room.ID, participantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, models.NotFoundError("Участник не найден")
		}
		return nil, nil, models.InternalError("Не удалось получить участника трансляции", err)
	}

	if claims != nil {
		if claims.SchoolID != room.SchoolID {
			return nil, nil, models.ForbiddenError("Недостаточно прав")
		}
		if participant.UserID == nil || *participant.UserID != claims.UserID || participant.Role != claims.Role {
			return nil, nil, models.ForbiddenError("Недостаточно прав")
		}
	}

	return room, participant, nil
}

func (s *LiveService) ensureTeacherParticipant(ctx context.Context, room *models.LiveRoom) (*models.LiveParticipant, error) {
	participant, err := s.liveRepo.GetTeacherParticipant(ctx, room.ID, room.TeacherID)
	if err == nil {
		return participant, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, models.InternalError("Не удалось получить участника преподавателя", err)
	}

	userID := room.TeacherID
	participant = &models.LiveParticipant{
		ID:          uuid.NewString(),
		RoomID:      room.ID,
		UserID:      &userID,
		DisplayName: "Учитель",
		Role:        "teacher",
		JoinedAt:    time.Now().UTC(),
	}
	if err := s.liveRepo.CreateParticipant(ctx, participant); err != nil {
		return nil, models.InternalError("Не удалось создать участника преподавателя", err)
	}
	return participant, nil
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}
