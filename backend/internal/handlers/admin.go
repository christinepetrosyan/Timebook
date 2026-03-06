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

	// Send notification to client
	if h.Notifier != nil {
		h.DB.Preload("User").Preload("Service").Preload("Master").Preload("Master.User").First(confirmedAppointment, confirmedAppointment.ID)
		if confirmedAppointment.User.ID != 0 {
			pref, _ := h.Notifier.GetOrCreatePreferences(confirmedAppointment.User.ID)
			masterName := ""
			if confirmedAppointment.Master.ID != 0 && confirmedAppointment.Master.User.Name != "" {
				masterName = confirmedAppointment.Master.User.Name
			}
			body := "Your appointment has been confirmed."
			if confirmedAppointment.Service.ID != 0 {
				body = "Your appointment for " + confirmedAppointment.Service.Name + " has been confirmed."
			}
			if masterName != "" {
				body += " Master: " + masterName + "."
			}
			h.Notifier.SendAppointmentNotification(&confirmedAppointment.User, "Appointment Confirmed", body, pref)
		}
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

	// Send notification to client
	if h.Notifier != nil {
		h.DB.Preload("User").Preload("Service").Preload("Master").Preload("Master.User").First(rejectedAppointment, rejectedAppointment.ID)
		if rejectedAppointment.User.ID != 0 {
			pref, _ := h.Notifier.GetOrCreatePreferences(rejectedAppointment.User.ID)
			body := "Your appointment has been declined."
			if rejectedAppointment.Service.ID != 0 {
				body = "Your appointment for " + rejectedAppointment.Service.Name + " has been declined."
			}
			h.Notifier.SendAppointmentNotification(&rejectedAppointment.User, "Appointment Declined", body, pref)
		}
	}

	respondWithJSON(w, http.StatusOK, rejectedAppointment)
}
