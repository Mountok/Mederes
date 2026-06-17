package realtime

import (
	"sync"

	"github.com/gorilla/websocket"

	"medrese-back/internal/models"
)

type LiveClient struct {
	conn          *websocket.Conn
	roomID        string
	participantID string
	mu            sync.Mutex
}

func (c *LiveClient) WriteJSON(payload interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(payload)
}

func (c *LiveClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.Close()
}

type LiveHub struct {
	mu    sync.RWMutex
	rooms map[string]map[*LiveClient]struct{}
}

func NewLiveHub() *LiveHub {
	return &LiveHub{
		rooms: make(map[string]map[*LiveClient]struct{}),
	}
}

func (h *LiveHub) Register(roomID string, participantID string, conn *websocket.Conn) *LiveClient {
	client := &LiveClient{
		conn:          conn,
		roomID:        roomID,
		participantID: participantID,
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.rooms[roomID]; !ok {
		h.rooms[roomID] = make(map[*LiveClient]struct{})
	}
	h.rooms[roomID][client] = struct{}{}

	return client
}

func (h *LiveHub) Unregister(client *LiveClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients, ok := h.rooms[client.roomID]
	if !ok {
		return
	}

	delete(clients, client)
	if len(clients) == 0 {
		delete(h.rooms, client.roomID)
	}
}

func (h *LiveHub) Broadcast(roomID string, event models.LiveWSEvent) {
	h.mu.RLock()
	clients := h.snapshot(roomID)
	h.mu.RUnlock()

	for _, client := range clients {
		_ = client.WriteJSON(event)
	}
}

func (h *LiveHub) CloseRoom(roomID string) {
	h.mu.Lock()
	clientsMap, ok := h.rooms[roomID]
	if !ok {
		h.mu.Unlock()
		return
	}

	clients := make([]*LiveClient, 0, len(clientsMap))
	for client := range clientsMap {
		clients = append(clients, client)
	}
	delete(h.rooms, roomID)
	h.mu.Unlock()

	for _, client := range clients {
		_ = client.Close()
	}
}

func (h *LiveHub) snapshot(roomID string) []*LiveClient {
	clientsMap, ok := h.rooms[roomID]
	if !ok {
		return nil
	}

	clients := make([]*LiveClient, 0, len(clientsMap))
	for client := range clientsMap {
		clients = append(clients, client)
	}

	return clients
}
