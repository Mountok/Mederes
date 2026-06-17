package models

import "net/http"

type AppError struct {
	Code       string
	Message    string
	HTTPStatus int
	Err        error
}

func (e *AppError) Error() string {
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

func ValidationError(message string) *AppError {
	return &AppError{Code: "validation_error", Message: message, HTTPStatus: http.StatusBadRequest}
}

func UnauthorizedError(message string) *AppError {
	return &AppError{Code: "unauthorized", Message: message, HTTPStatus: http.StatusUnauthorized}
}

func ForbiddenError(message string) *AppError {
	return &AppError{Code: "forbidden", Message: message, HTTPStatus: http.StatusForbidden}
}

func NotFoundError(message string) *AppError {
	return &AppError{Code: "not_found", Message: message, HTTPStatus: http.StatusNotFound}
}

func ConflictError(message string) *AppError {
	return &AppError{Code: "conflict", Message: message, HTTPStatus: http.StatusConflict}
}

func RoomEndedError(message string) *AppError {
	return &AppError{Code: "room_ended", Message: message, HTTPStatus: http.StatusConflict}
}

func InternalError(message string, err error) *AppError {
	return &AppError{Code: "internal_error", Message: message, HTTPStatus: http.StatusInternalServerError, Err: err}
}

func AsAppError(err error) *AppError {
	if err == nil {
		return nil
	}

	appErr, ok := err.(*AppError)
	if ok {
		return appErr
	}

	return InternalError("Внутренняя ошибка сервера", err)
}
