package handlers

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/realtime"
	"medrese-back/internal/services"
	"medrese-back/pkg/auth"
)

type LiveHandler struct {
	service    *services.LiveService
	jwtManager *auth.JWTManager
	hub        *realtime.LiveHub
	logger     *logrus.Logger
	upgrader   websocket.Upgrader
}

func NewLiveHandler(service *services.LiveService, jwtManager *auth.JWTManager, hub *realtime.LiveHub, logger *logrus.Logger) *LiveHandler {
	return &LiveHandler{
		service:    service,
		jwtManager: jwtManager,
		hub:        hub,
		logger:     logger,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (h *LiveHandler) CreateRoom(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	var request models.LiveCreateRoomRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, err := h.service.CreateRoom(c.Request.Context(), claims, request)
	if err != nil {
		appErr := models.AsAppError(err)
		h.logger.WithFields(logrus.Fields{
			"user_id":   claims.UserID,
			"school_id": claims.SchoolID,
			"role":      claims.Role,
			"action":    "live room create",
			"result":    "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"user_id":   claims.UserID,
		"school_id": claims.SchoolID,
		"role":      claims.Role,
		"room_id":   response.ID,
		"action":    "live room created",
		"result":    "success",
	}).Info("live room created")

	c.JSON(http.StatusOK, response)
}

func (h *LiveHandler) GetRoom(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	response, err := h.service.GetRoom(c.Request.Context(), claims, c.Param("id"))
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *LiveHandler) JoinRoom(c *gin.Context) {
	claims, err := h.optionalClaims(c)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	var request models.LiveJoinRoomRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, serviceErr := h.service.JoinRoom(c.Request.Context(), claims, request)
	if serviceErr != nil {
		appErr := models.AsAppError(serviceErr)
		h.logger.WithFields(logrus.Fields{
			"join_code": strings.ToUpper(strings.TrimSpace(request.JoinCode)),
			"action":    "live room join",
			"result":    "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, serviceErr)
		return
	}

	h.logger.WithFields(logrus.Fields{
		"room_id":          response.Room.ID,
		"participant_id":   response.Participant.ID,
		"participant_role": response.Participant.Role,
		"action":           "live participant joined",
		"result":           "success",
	}).Info("live participant joined")

	c.JSON(http.StatusOK, response)
}

func (h *LiveHandler) GetToken(c *gin.Context) {
	claims, err := h.optionalClaims(c)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	var request models.LiveTokenRequest
	if err := bindOptionalJSON(c, &request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	response, serviceErr := h.service.IssueToken(c.Request.Context(), c.Param("id"), claims, request.ParticipantID)
	if serviceErr != nil {
		appErr := models.AsAppError(serviceErr)
		h.logger.WithFields(logrus.Fields{
			"room_id":        c.Param("id"),
			"participant_id": strings.TrimSpace(request.ParticipantID),
			"action":         "live token issue",
			"result":         "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, serviceErr)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *LiveHandler) EndRoom(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		respondError(c, h.logger, models.UnauthorizedError("Требуется авторизация"))
		return
	}

	roomID := c.Param("id")
	if err := h.service.EndRoom(c.Request.Context(), claims, roomID); err != nil {
		appErr := models.AsAppError(err)
		h.logger.WithFields(logrus.Fields{
			"user_id":   claims.UserID,
			"school_id": claims.SchoolID,
			"room_id":   roomID,
			"action":    "live room ended",
			"result":    "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, err)
		return
	}

	h.hub.Broadcast(roomID, models.LiveWSEvent{
		Type: "room_ended",
		Payload: gin.H{
			"room_id": roomID,
		},
	})
	h.hub.CloseRoom(roomID)

	h.logger.WithFields(logrus.Fields{
		"user_id":   claims.UserID,
		"school_id": claims.SchoolID,
		"room_id":   roomID,
		"action":    "live room ended",
		"result":    "success",
	}).Info("live room ended")

	c.JSON(http.StatusOK, models.LiveEndRoomResponse{
		Success: true,
		Message: "Трансляция завершена",
	})
}

func (h *LiveHandler) ListMessages(c *gin.Context) {
	claims, err := h.optionalClaims(c)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	limit := 50
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil {
			respondError(c, h.logger, models.ValidationError("Некорректный limit"))
			return
		}
		limit = parsed
	}

	response, serviceErr := h.service.ListMessages(c.Request.Context(), c.Param("id"), claims, c.Query("participant_id"), limit)
	if serviceErr != nil {
		respondError(c, h.logger, serviceErr)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *LiveHandler) SendMessage(c *gin.Context) {
	claims, err := h.optionalClaims(c)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	var request models.LiveSendMessageRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректный JSON"))
		return
	}

	message, serviceErr := h.service.SendMessage(c.Request.Context(), c.Param("id"), claims, request)
	if serviceErr != nil {
		appErr := models.AsAppError(serviceErr)
		h.logger.WithFields(logrus.Fields{
			"room_id":        c.Param("id"),
			"participant_id": strings.TrimSpace(request.ParticipantID),
			"action":         "live chat message",
			"result":         "error",
		}).Warn(appErr.Message)
		respondError(c, h.logger, serviceErr)
		return
	}

	h.hub.Broadcast(c.Param("id"), models.LiveWSEvent{
		Type:    "chat_message",
		Payload: message,
	})

	c.JSON(http.StatusOK, message)
}

func (h *LiveHandler) WebSocket(c *gin.Context) {
	claims, err := h.optionalClaims(c)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}

	room, participant, serviceErr := h.service.ResolveWebsocketParticipant(c.Request.Context(), c.Param("id"), claims, c.Query("participant_id"))
	if serviceErr != nil {
		respondError(c, h.logger, serviceErr)
		return
	}

	conn, upgradeErr := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if upgradeErr != nil {
		h.logger.WithError(upgradeErr).Warn("live websocket upgrade failed")
		return
	}

	client := h.hub.Register(room.ID, participant.ID, conn)
	h.hub.Broadcast(room.ID, models.LiveWSEvent{
		Type: "participant_joined",
		Payload: models.LiveParticipantPresence{
			ParticipantID: participant.ID,
			DisplayName:   participant.DisplayName,
			Role:          participant.Role,
		},
	})

	defer func() {
		h.hub.Unregister(client)
		_ = h.service.MarkParticipantLeft(c.Request.Context(), participant.ID)
		h.hub.Broadcast(room.ID, models.LiveWSEvent{
			Type: "participant_left",
			Payload: models.LiveParticipantPresence{
				ParticipantID: participant.ID,
				DisplayName:   participant.DisplayName,
				Role:          participant.Role,
			},
		})
		_ = conn.Close()
	}()

	for {
		var incoming models.LiveWSClientMessage
		if err := conn.ReadJSON(&incoming); err != nil {
			h.logger.WithFields(logrus.Fields{
				"room_id":        room.ID,
				"participant_id": participant.ID,
				"action":         "live websocket read",
				"result":         "error",
			}).Warn("live websocket disconnected")
			return
		}

		if incoming.Type != "chat_message" {
			continue
		}

		message, err := h.service.SendMessage(c.Request.Context(), room.ID, claims, models.LiveSendMessageRequest{
			ParticipantID: participant.ID,
			Message:       incoming.Message,
		})
		if err != nil {
			appErr := models.AsAppError(err)
			h.logger.WithFields(logrus.Fields{
				"room_id":        room.ID,
				"participant_id": participant.ID,
				"action":         "live websocket message",
				"result":         "error",
			}).Warn(appErr.Message)
			_ = conn.WriteJSON(models.LiveWSEvent{
				Type: "error",
				Payload: models.ErrorBody{
					Code:    appErr.Code,
					Message: appErr.Message,
				},
			})
			continue
		}

		h.hub.Broadcast(room.ID, models.LiveWSEvent{
			Type:    "chat_message",
			Payload: message,
		})
	}
}

func (h *LiveHandler) optionalClaims(c *gin.Context) (*auth.Claims, error) {
	header := strings.TrimSpace(c.GetHeader("Authorization"))
	if header == "" {
		return nil, nil
	}

	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer"))
	if token == header || token == "" {
		return nil, models.UnauthorizedError("Некорректный токен")
	}

	claims, err := h.jwtManager.ParseToken(token)
	if err != nil {
		return nil, models.UnauthorizedError("Некорректный токен")
	}

	return claims, nil
}

func bindOptionalJSON(c *gin.Context, target interface{}) error {
	if c.Request.Body == nil {
		return nil
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return err
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))

	if len(bytes.TrimSpace(body)) == 0 {
		return nil
	}

	return c.ShouldBindJSON(target)
}
