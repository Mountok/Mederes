package logger

import (
	"io"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
)

func New(logFilePath string) (*logrus.Logger, io.Closer, error) {
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetLevel(logrus.InfoLevel)

	if err := os.MkdirAll(filepath.Dir(logFilePath), 0o755); err != nil {
		return nil, nil, err
	}

	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, nil, err
	}

	logger.SetOutput(io.MultiWriter(os.Stdout, file))
	return logger, file, nil
}
