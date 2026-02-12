package handlers

import (
	"net/http"

	"github.com/timebook/backend/internal/models"
)

func (h *Handlers) GetMasters(w http.ResponseWriter, r *http.Request) {
	var masters []models.MasterProfile
	if err := h.DB.Preload("User").Preload("Services").Find(&masters).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch masters")
		return
	}

	respondWithJSON(w, http.StatusOK, masters)
}

func (h *Handlers) GetAllAppointments(w http.ResponseWriter, r *http.Request) {
	var appointments []models.Appointment
	query := h.DB.Preload("User").Preload("Service").Preload("Master").Preload("Master.User")

	// Filter by master if provided
	if masterID := r.URL.Query().Get("master_id"); masterID != "" {
		query = query.Where("master_id = ?", masterID)
	}

	// Filter by status if provided
	if status := r.URL.Query().Get("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&appointments).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch appointments")
		return
	}

	respondWithJSON(w, http.StatusOK, appointments)
}

func (h *Handlers) AdminConfirmAppointment(w http.ResponseWriter, r *http.Request) {
	appointmentID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid appointment ID")
		return
	}

	// Verify appointment exists
	var appointment models.Appointment
	if err := h.DB.First(&appointment, appointmentID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Appointment not found")
		return
	}

	// Use service layer to confirm appointment with transaction
	confirmedAppointment, err := h.AppointmentService.ConfirmAppointment(r.Context(), appointmentID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to confirm appointment")
		return
	}

	respondWithJSON(w, http.StatusOK, confirmedAppointment)
}

func (h *Handlers) AdminRejectAppointment(w http.ResponseWriter, r *http.Request) {
	appointmentID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid appointment ID")
		return
	}

	// Verify appointment exists
	var appointment models.Appointment
	if err := h.DB.First(&appointment, appointmentID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Appointment not found")
		return
	}

	// Use service layer to reject appointment with transaction
	rejectedAppointment, err := h.AppointmentService.RejectAppointment(r.Context(), appointmentID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to reject appointment")
		return
	}

	respondWithJSON(w, http.StatusOK, rejectedAppointment)
}
