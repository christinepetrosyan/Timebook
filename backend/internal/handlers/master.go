package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/timebook/backend/internal/models"
)

func (h *Handlers) GetMasterProfile(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	var user models.User
	if err := h.DB.Preload("MasterProfile").Preload("MasterProfile.Services").First(&user, userID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	user.Password = ""
	respondWithJSON(w, http.StatusOK, user)
}

func (h *Handlers) CreateService(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var req struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		Duration    int     `json:"duration"`
		Price       float64 `json:"price"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := models.Service{
		MasterID:    masterProfile.ID,
		Name:        req.Name,
		Description: req.Description,
		Duration:    req.Duration,
		Price:       req.Price,
	}

	if err := h.DB.Create(&service).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create service")
		return
	}

	respondWithJSON(w, http.StatusCreated, service)
}

func (h *Handlers) GetMasterServices(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var services []models.Service
	if err := h.DB.Where("master_id = ?", masterProfile.ID).Find(&services).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch services")
		return
	}

	respondWithJSON(w, http.StatusOK, services)
}

func (h *Handlers) GetMasterAppointments(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var appointments []models.Appointment
	if err := h.DB.Preload("User").Preload("Service").Where("master_id = ?", masterProfile.ID).Find(&appointments).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch appointments")
		return
	}

	respondWithJSON(w, http.StatusOK, appointments)
}

func (h *Handlers) ConfirmAppointment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	appointmentID := getPathValue(r, "id")

	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var appointment models.Appointment
	if err := h.DB.Where("id = ? AND master_id = ?", appointmentID, masterProfile.ID).First(&appointment).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Appointment not found")
		return
	}

	appointment.Status = models.StatusConfirmed
	if err := h.DB.Save(&appointment).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to confirm appointment")
		return
	}

	h.DB.Preload("User").Preload("Service").First(&appointment, appointment.ID)
	respondWithJSON(w, http.StatusOK, appointment)
}

func (h *Handlers) RejectAppointment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	appointmentID := getPathValue(r, "id")

	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var appointment models.Appointment
	if err := h.DB.Where("id = ? AND master_id = ?", appointmentID, masterProfile.ID).First(&appointment).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Appointment not found")
		return
	}

	appointment.Status = models.StatusRejected
	if err := h.DB.Save(&appointment).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to reject appointment")
		return
	}

	respondWithJSON(w, http.StatusOK, appointment)
}

