package models

type Reader struct {
	ID           string `db:"id"`
	Email        string `db:"email"`
	PasswordHash string `db:"password_hash"`
	Name         string `db:"name"`
}

type ReaderAuthRequest struct {
	Email          string `json:"email"`
	Password       string `json:"password"`
	Name           string `json:"name"`
	PrivacyConsent bool   `json:"privacyConsent"`
	TermsAccepted  bool   `json:"termsAccepted"`
	AdultConfirmed bool   `json:"adultConfirmed"`
}

type ReaderAuthResponse struct {
	Token string   `json:"token"`
	User  UserInfo `json:"user"`
}
