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

	var appointment models.Appointment
	if err := h.DB.First(&appointment, appointmentID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Appointment not found")
		return
	}

	appointment.Status = models.StatusConfirmed
	if err := h.DB.Save(&appointment).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to confirm appointment")
		return
	}

	// Mark corresponding time slot as booked (create if doesn't exist)
	var timeSlot models.TimeSlot
	if err := h.DB.Where(
		"master_id = ? AND service_id = ? AND start_time = ? AND end_time = ?",
		appointment.MasterID,
		appointment.ServiceID,
		appointment.StartTime,
		appointment.EndTime,
	).First(&timeSlot).Error; err != nil {
		// Time slot doesn't exist, create it as booked
		timeSlot = models.TimeSlot{
			MasterID:  appointment.MasterID,
			ServiceID: appointment.ServiceID,
			StartTime: appointment.StartTime,
			EndTime:   appointment.EndTime,
			IsBooked:  true,
		}
		h.DB.Create(&timeSlot)
	} else {
		// Time slot exists, mark it as booked
		timeSlot.IsBooked = true
		h.DB.Save(&timeSlot)
	}

	h.DB.Preload("User").Preload("Service").Preload("Master").First(&appointment, appointment.ID)
	respondWithJSON(w, http.StatusOK, appointment)
}

func (h *Handlers) AdminRejectAppointment(w http.ResponseWriter, r *http.Request) {
	appointmentID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid appointment ID")
		return
	}

	var appointment models.Appointment
	if err := h.DB.First(&appointment, appointmentID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Appointment not found")
		return
	}

	appointment.Status = models.StatusRejected
	if err := h.DB.Save(&appointment).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to reject appointment")
		return
	}

	// Unbook the time slot if it was booked
	var timeSlot models.TimeSlot
	if err := h.DB.Where(
		"master_id = ? AND service_id = ? AND start_time = ? AND end_time = ? AND is_booked = ?",
		appointment.MasterID,
		appointment.ServiceID,
		appointment.StartTime,
		appointment.EndTime,
		true,
	).First(&timeSlot).Error; err == nil {
		timeSlot.IsBooked = false
		h.DB.Save(&timeSlot)
	}

	respondWithJSON(w, http.StatusOK, appointment)
}
