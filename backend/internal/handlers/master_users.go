package handlers

import (
	"net/http"
	"strings"

	"github.com/timebook/backend/internal/models"
)

// SearchUsers allows masters to search for clients by name or email.
// Used when booking appointments on behalf of clients ("Work" flow).
// Returns users with role "user" (clients) matching the query.
func (h *Handlers) SearchUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := getContextUserID(w, r); !ok {
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 {
		respondWithError(w, http.StatusBadRequest, "Search query must be at least 2 characters")
		return
	}

	searchPattern := "%" + q + "%"
	var users []models.User
	if err := h.DB.Select("id", "name", "email", "phone").
		Where("role = ? AND deleted_at IS NULL", models.RoleUser).
		Where("name ILIKE ? OR email ILIKE ?", searchPattern, searchPattern).
		Limit(20).
		Find(&users).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to search users")
		return
	}

	respondWithJSON(w, http.StatusOK, users)
}
