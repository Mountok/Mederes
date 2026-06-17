package livekitclient

import (
	"context"
	"strings"

	lkauth "github.com/livekit/protocol/auth"
	lk "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

type Client struct {
	publicURL  string
	serviceURL string
	apiKey     string
	apiSecret  string
	roomClient *lksdk.RoomServiceClient
}

func NewClient(publicURL string, apiKey string, apiSecret string) *Client {
	serviceURL := strings.TrimSpace(publicURL)
	if strings.HasPrefix(serviceURL, "ws://") {
		serviceURL = "http://" + strings.TrimPrefix(serviceURL, "ws://")
	} else if strings.HasPrefix(serviceURL, "wss://") {
		serviceURL = "https://" + strings.TrimPrefix(serviceURL, "wss://")
	}

	return &Client{
		publicURL:  strings.TrimSpace(publicURL),
		serviceURL: serviceURL,
		apiKey:     strings.TrimSpace(apiKey),
		apiSecret:  strings.TrimSpace(apiSecret),
		roomClient: lksdk.NewRoomServiceClient(serviceURL, apiKey, apiSecret),
	}
}

func (c *Client) PublicURL() string {
	return c.publicURL
}

func (c *Client) IssueToken(roomName string, identity string, displayName string, role string) (string, error) {
	token := lkauth.NewAccessToken(c.apiKey, c.apiSecret)
	token.SetIdentity(identity)
	token.SetName(displayName)

	grant := &lkauth.VideoGrant{
		RoomJoin:     true,
		Room:         roomName,
		CanPublish:   boolPtr(role == "teacher"),
		CanSubscribe: boolPtr(true),
	}
	if role == "teacher" {
		grant.CanPublishData = boolPtr(true)
		grant.CanUpdateOwnMetadata = boolPtr(true)
	}

	token.SetVideoGrant(grant)
	return token.ToJWT()
}

func (c *Client) EndRoom(ctx context.Context, roomName string) error {
	if c.roomClient == nil || strings.TrimSpace(roomName) == "" {
		return nil
	}

	_, err := c.roomClient.DeleteRoom(ctx, &lk.DeleteRoomRequest{Room: roomName})
	return err
}

func boolPtr(value bool) *bool {
	return &value
}
