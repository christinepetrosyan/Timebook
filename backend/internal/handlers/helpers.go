package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// getContextUserID returns the authenticated user's ID from context.
// If missing or invalid, writes 401 and returns (0, false).
func getContextUserID(w http.ResponseWriter, r *http.Request) (uint, bool) {
	v := r.Context().Value("user_id")
	if v == nil {
		respondWithError(w, http.StatusUnauthorized, "Authorization required")
		return 0, false
	}
	userID, ok := v.(uint)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Invalid auth context")
		return 0, false
	}
	return userID, true
}

// getPathValue extracts a path parameter from the URL
// For Go 1.21 compatibility (PathValue is only in Go 1.22+)
// Extracts ID from patterns like /api/services/{id}/slots
func getPathValue(r *http.Request, key string) string {
	urlPath := r.URL.Path
	parts := strings.Split(strings.Trim(urlPath, "/"), "/")

	// For routes like /api/services/{id}/slots, find "services" and return next part
	// For routes like /api/master/appointments/{id}/confirm, find "appointments" and return next part
	// For routes like /api/master/time-slots/{id}, find "time-slots" and return next part
	if key == "id" {
		// Look for common patterns
		for i, part := range parts {
			if (part == "services" || part == "service-options" || part == "appointments" || part == "time-slots") && i+1 < len(parts) {
				return parts[i+1]
			}
		}
	}

	return ""
}

// getIDParam returns the numeric ID from the request path.
// It first tries Go 1.22's r.PathValue("id") for mux patterns like
// "DELETE /api/master/services/{id}", and falls back to getPathValue
// for older-style/manual patterns.
func getIDParam(r *http.Request) (uint, error) {
	idStr := r.PathValue("id")
	if idStr == "" {
		idStr = getPathValue(r, "id")
	}

	if idStr == "" {
		return 0, errors.New("id not found in path")
	}

	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return 0, err
	}

	return uint(id), nil
}

func parseTime(timeStr string) (time.Time, error) {
	// Support multiple time formats
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, timeStr); err == nil {
			return t, nil
		}
	}

	return time.Time{}, errors.New("invalid time format")
}

func minutesToDuration(minutes int) time.Duration {
	return time.Duration(minutes) * time.Minute
}

func generateSampleSlots(serviceID string, duration int) []map[string]interface{} {
	slots := []map[string]interface{}{}
	now := time.Now()

	// Generate slots for the next 7 days
	for day := 0; day < 7; day++ {
		date := now.AddDate(0, 0, day)
		// Generate slots from 9 AM to 6 PM, every hour
		for hour := 9; hour < 18; hour++ {
			startTime := time.Date(date.Year(), date.Month(), date.Day(), hour, 0, 0, 0, time.UTC)
			endTime := startTime.Add(minutesToDuration(duration))

			slots = append(slots, map[string]interface{}{
				"service_id": serviceID,
				"start_time": startTime.Format(time.RFC3339),
				"end_time":   endTime.Format(time.RFC3339),
				"available":  true,
			})
		}
	}

	return slots
}
