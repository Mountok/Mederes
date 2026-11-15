package services

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"medrese-back/internal/models"
	"medrese-back/pkg/auth"
)

type memoryReaderStore struct{ byEmail map[string]models.Reader }

func (s *memoryReaderStore) Create(_ context.Context, reader models.Reader) error {
	s.byEmail[reader.Email] = reader
	return nil
}
func (s *memoryReaderStore) ByEmail(_ context.Context, email string) (*models.Reader, error) {
	reader, ok := s.byEmail[email]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return &reader, nil
}
func (s *memoryReaderStore) ByID(_ context.Context, id string) (*models.Reader, error) {
	for _, reader := range s.byEmail {
		if reader.ID == id {
			return &reader, nil
		}
	}
	return nil, sql.ErrNoRows
}

func TestReaderRegistrationLoginAndIdentity(t *testing.T) {
	store := &memoryReaderStore{byEmail: map[string]models.Reader{}}
	jwt := auth.NewJWTManager("test-only-secret", time.Hour)
	service := NewReaderService(store, jwt)
	ctx := context.Background()
	registered, err := service.Register(ctx, models.ReaderAuthRequest{Name: "Амина", Email: "  AMINA@example.com ", Password: "correct horse battery", PrivacyConsent: true, TermsAccepted: true, AdultConfirmed: true})
	if err != nil {
		t.Fatal(err)
	}
	if registered.User.Role != "reader" || registered.User.Login != "amina@example.com" {
		t.Fatalf("unexpected user: %+v", registered.User)
	}
	claims, err := jwt.ParseToken(registered.Token)
	if err != nil || claims.Role != "reader" || claims.SchoolID != "" {
		t.Fatalf("unexpected claims: %+v, %v", claims, err)
	}
	if _, err := service.Login(ctx, models.ReaderAuthRequest{Email: "amina@example.com", Password: "incorrect-password"}); err == nil {
		t.Fatal("wrong password accepted")
	}
	loggedIn, err := service.Login(ctx, models.ReaderAuthRequest{Email: "amina@example.com", Password: "correct horse battery"})
	if err != nil || loggedIn.User.ID != registered.User.ID {
		t.Fatalf("login failed: %+v, %v", loggedIn, err)
	}
	current, err := service.Me(ctx, claims.UserID)
	if err != nil || current.User.ID != registered.User.ID {
		t.Fatalf("identity failed: %+v, %v", current, err)
	}
}

func TestReaderRegistrationRejectsInvalidInput(t *testing.T) {
	service := NewReaderService(&memoryReaderStore{byEmail: map[string]models.Reader{}}, auth.NewJWTManager("test", time.Hour))
	for _, request := range []models.ReaderAuthRequest{
		{Name: "Амина", Email: "invalid", Password: "correct horse battery"},
		{Name: "Амина", Email: "amina@example.com", Password: "short"},
		{Name: "", Email: "amina@example.com", Password: "correct horse battery"},
		{Name: "Амина", Email: "amina@example.com", Password: "correct horse battery", PrivacyConsent: true, TermsAccepted: true},
	} {
		if _, err := service.Register(context.Background(), request); err == nil {
			t.Fatalf("accepted invalid request: %+v", request)
		}
	}
}
