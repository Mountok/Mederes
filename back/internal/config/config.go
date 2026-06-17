package config

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Config struct {
	AppPort       string
	AppEnv        string
	DBHost        string
	DBPort        string
	DBName        string
	DBUser        string
	DBPassword    string
	DBSSLMode     string
	JWTSecret     string
	AdminAPIKey   string
	LogFilePath   string
	LiveKitURL    string
	LiveKitKey    string
	LiveKitSecret string
}

func Load() (Config, error) {
	if err := loadDotEnv(".env"); err != nil {
		return Config{}, err
	}

	cfg := Config{
		AppPort:       getenv("APP_PORT", "8000"),
		AppEnv:        getenv("APP_ENV", "development"),
		DBHost:        getenv("DB_HOST", "localhost"),
		DBPort:        getenv("DB_PORT", "5432"),
		DBName:        getenv("DB_NAME", "medrese"),
		DBUser:        getenv("DB_USER", "postgres"),
		DBPassword:    os.Getenv("DB_PASSWORD"),
		DBSSLMode:     getenv("DB_SSLMODE", "disable"),
		JWTSecret:     getenv("JWT_SECRET", "change-me-dev-secret"),
		AdminAPIKey:   getenv("ADMIN_API_KEY", "change-me-admin-key"),
		LogFilePath:   getenv("LOG_FILE_PATH", "logs/app.log"),
		LiveKitURL:    getenv("LIVEKIT_URL", "ws://localhost:7880"),
		LiveKitKey:    getenv("LIVEKIT_API_KEY", "devkey"),
		LiveKitSecret: getenv("LIVEKIT_API_SECRET", "secret"),
	}

	if strings.TrimSpace(cfg.DBName) == "" || strings.TrimSpace(cfg.DBUser) == "" {
		return Config{}, fmt.Errorf("database config is incomplete")
	}

	return cfg, nil
}

func (c Config) DatabaseDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s dbname=%s user=%s password=%s sslmode=%s",
		c.DBHost,
		c.DBPort,
		c.DBName,
		c.DBUser,
		c.DBPassword,
		c.DBSSLMode,
	)
}

func (c Config) HTTPServer(handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              ":" + c.AppPort,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

func getenv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func loadDotEnv(path string) error {
	filePath, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	file, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		if key == "" {
			continue
		}

		if _, exists := os.LookupEnv(key); exists {
			continue
		}

		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)
		if err := os.Setenv(key, value); err != nil {
			return err
		}
	}

	return scanner.Err()
}
