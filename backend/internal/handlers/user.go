package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/timebook/backend/internal/models"
)

func (h *Handlers) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	var user models.User
	if err := h.DB.Preload("Appointments").Preload("Appointments.Service").Preload("Appointments.Master").First(&user, userID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	user.Password = ""
	respondWithJSON(w, http.StatusOK, user)
}

func (h *Handlers) GetServices(w http.ResponseWriter, r *http.Request) {
	var services []models.Service
	query := h.DB.Preload("Master").Preload("Master.User")

	// Filter by master if provided
	if masterID := r.URL.Query().Get("master_id"); masterID != "" {
		query = query.Where("master_id = ?", masterID)
	}

	// Search by name
	if search := r.URL.Query().Get("search"); search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}

	if err := query.Find(&services).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch services")
		return
	}

	respondWithJSON(w, http.StatusOK, services)
}

func (h *Handlers) GetAvailableSlots(w http.ResponseWriter, r *http.Request) {
	serviceID := getPathValue(r, "id")

	var service models.Service
	if err := h.DB.First(&service, serviceID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found")
		return
	}

	// For MVP, we'll return a simple list of available slots
	// In production, this would query actual time slots from the database
	// For now, we'll generate sample slots for the next 7 days
	slots := generateSampleSlots(serviceID, service.Duration)

	respondWithJSON(w, http.StatusOK, slots)
}

func (h *Handlers) CreateAppointment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	var req struct {
		ServiceID uint   `json:"service_id"`
		StartTime string `json:"start_time"`
		Notes     string `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get service
	var service models.Service
	if err := h.DB.Preload("Master").First(&service, req.ServiceID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found")
		return
	}

	// Parse start time
	startTime, err := parseTime(req.StartTime)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid time format")
		return
	}

	// Calculate end time
	endTime := startTime.Add(minutesToDuration(service.Duration))

	appointment := models.Appointment{
		UserID:    userID,
		MasterID:  service.MasterID,
		ServiceID: req.ServiceID,
		StartTime: startTime,
		EndTime:   endTime,
		Status:    models.StatusPending,
		Notes:     req.Notes,
	}

	if err := h.DB.Create(&appointment).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create appointment")
		return
	}

	h.DB.Preload("Service").Preload("Master").Preload("User").First(&appointment, appointment.ID)
	respondWithJSON(w, http.StatusCreated, appointment)
}

func (h *Handlers) GetAppointments(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	var appointments []models.Appointment
	if err := h.DB.Preload("Service").Preload("Master").Preload("Master.User").Where("user_id = ?", userID).Find(&appointments).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch appointments")
		return
	}

	respondWithJSON(w, http.StatusOK, appointments)
}

