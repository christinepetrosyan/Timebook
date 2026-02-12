package errors

import (
	"encoding/json"
	"net/http"
)

// AppError represents an application error with code, message, and HTTP status
type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"-"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	return e.Message
}

// Predefined application errors
var (
	ErrNotFound       = &AppError{Code: "NOT_FOUND", Message: "Resource not found", Status: http.StatusNotFound}
	ErrUnauthorized   = &AppError{Code: "UNAUTHORIZED", Message: "Unauthorized", Status: http.StatusUnauthorized}
	ErrForbidden      = &AppError{Code: "FORBIDDEN", Message: "Forbidden", Status: http.StatusForbidden}
	ErrValidation     = &AppError{Code: "VALIDATION_ERROR", Message: "Invalid input", Status: http.StatusBadRequest}
	ErrConflict       = &AppError{Code: "CONFLICT", Message: "Resource conflict", Status: http.StatusConflict}
	ErrInternalServer = &AppError{Code: "INTERNAL_ERROR", Message: "Internal server error", Status: http.StatusInternalServerError}
	ErrBadRequest     = &AppError{Code: "BAD_REQUEST", Message: "Bad request", Status: http.StatusBadRequest}
)

// New creates a new AppError
func New(code string, message string, status int) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  status,
	}
}

// RespondWithError writes an error response to the HTTP response writer
func RespondWithError(w http.ResponseWriter, err error) {
	appErr, ok := err.(*AppError)
	if !ok {
		appErr = ErrInternalServer
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(appErr.Status)
	json.NewEncoder(w).Encode(appErr)
}

// RespondWithJSON writes a JSON response to the HTTP response writer
func RespondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
