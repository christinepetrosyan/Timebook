package handlers

import (
	"encoding/json"
	"net/http"
	"time"

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
	query := h.DB.Preload("Master").Preload("Master.User").Preload("Options")

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
	serviceID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid service ID")
		return
	}

	var service models.Service
	if err := h.DB.First(&service, serviceID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found")
		return
	}

	now := time.Now()
	startDate := now
	endDate := now.AddDate(0, 0, 1)

	if s := r.URL.Query().Get("start_date"); s != "" {
		if t, err := parseTime(s); err == nil {
			startDate = t
		}
	}
	if s := r.URL.Query().Get("end_date"); s != "" {
		if t, err := parseTime(s); err == nil {
			endDate = t
		}
	}

	// Fetch ALL booked DB time slots for this master (unified calendar —
	// a slot blocked on any service blocks the hour for every service).
	var bookedDbSlots []models.TimeSlot
	h.DB.Where(
		"master_id = ? AND deleted_at IS NULL AND is_booked = ? AND start_time < ? AND end_time > ?",
		service.MasterID, true, endDate, startDate,
	).Find(&bookedDbSlots)

	// Fetch pending/confirmed appointments for this master (all services).
	var appointments []models.Appointment
	h.DB.Where(
		"master_id = ? AND deleted_at IS NULL AND status IN (?, ?) AND start_time < ? AND end_time > ?",
		service.MasterID, models.StatusPending, models.StatusConfirmed, endDate, startDate,
	).Find(&appointments)

	// Generate 1-hour working-hour slots (8 AM – 10 PM in the client's
	// local timezone). The frontend sends startDate as local-midnight
	// expressed in UTC, so startDate + 8 h = 8 AM local.
	workStart := startDate.Add(8 * time.Hour)

	slots := []map[string]interface{}{}
	for hour := 0; hour < 14; hour++ {
		slotStart := workStart.Add(time.Duration(hour) * time.Hour)
		slotEnd := slotStart.Add(time.Hour)

		// Mark past slots as unavailable; always return them so the grid is complete.
		isPast := slotEnd.Before(now)

		isBooked := false

		// Check master-wide booked DB slots (manually blocked by master).
		for _, dbSlot := range bookedDbSlots {
			if dbSlot.StartTime.Before(slotEnd) && dbSlot.EndTime.After(slotStart) {
				isBooked = true
				break
			}
		}

		// Check appointments (pending or confirmed on any service).
		if !isBooked {
			for _, apt := range appointments {
				if apt.StartTime.Before(slotEnd) && apt.EndTime.After(slotStart) {
					isBooked = true
					break
				}
			}
		}

		slots = append(slots, map[string]interface{}{
			"id":         0,
			"service_id": serviceID,
			"start_time": slotStart.Format(time.RFC3339),
			"end_time":   slotEnd.Format(time.RFC3339),
			"available":  !isBooked && !isPast,
			"is_booked":  isBooked,
			"is_past":    isPast,
		})
	}

	respondWithJSON(w, http.StatusOK, slots)
}

func (h *Handlers) CreateAppointment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	var req struct {
		ServiceID       uint   `json:"service_id"`
		ServiceOptionID *uint  `json:"service_option_id,omitempty"`
		StartTime       string `json:"start_time"`
		Notes           string `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get service
	var service models.Service
	if err := h.DB.Preload("Master").Preload("Options").First(&service, req.ServiceID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found")
		return
	}

	// Determine the duration to use
	duration := service.Duration

	// If the service has sub-categories (options), a selection is required
	if len(service.Options) > 0 {
		if req.ServiceOptionID == nil {
			respondWithError(w, http.StatusBadRequest, "This service has sub-categories. Please select one.")
			return
		}
		// Verify the option belongs to this service
		var option models.ServiceOption
		if err := h.DB.Where("id = ? AND service_id = ?", *req.ServiceOptionID, req.ServiceID).First(&option).Error; err != nil {
			respondWithError(w, http.StatusNotFound, "Service sub-category not found")
			return
		}
		duration = option.Duration
	}

	// Parse start time
	startTime, err := parseTime(req.StartTime)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid time format")
		return
	}

	// Calculate end time using the resolved duration
	endTime := startTime.Add(minutesToDuration(duration))

	// Check for conflicting appointments (pending or confirmed)
	var conflictingAppointment models.Appointment
	if err := h.DB.Where(
		"master_id = ? AND service_id = ? AND deleted_at IS NULL AND status IN (?, ?) AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))",
		service.MasterID,
		req.ServiceID,
		models.StatusPending,
		models.StatusConfirmed,
		startTime, startTime,
		endTime, endTime,
		startTime, endTime,
	).First(&conflictingAppointment).Error; err == nil {
		respondWithError(w, http.StatusConflict, "Time slot conflicts with existing appointment")
		return
	}

	// Check if there's a matching time slot and mark it as booked
	var timeSlot models.TimeSlot
	if err := h.DB.Where(
		"master_id = ? AND service_id = ? AND start_time = ? AND end_time = ? AND is_booked = ? AND deleted_at IS NULL",
		service.MasterID,
		req.ServiceID,
		startTime,
		endTime,
		false,
	).First(&timeSlot).Error; err == nil {
		// Found matching time slot, mark it as booked
		timeSlot.IsBooked = true
		if err := h.DB.Save(&timeSlot).Error; err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to book time slot")
			return
		}
	}

	appointment := models.Appointment{
		UserID:          userID,
		MasterID:        service.MasterID,
		ServiceID:       req.ServiceID,
		ServiceOptionID: req.ServiceOptionID,
		StartTime:       startTime,
		EndTime:         endTime,
		Status:          models.StatusPending,
		Notes:           req.Notes,
	}

	if err := h.DB.Create(&appointment).Error; err != nil {
		// If appointment creation fails, unbook the slot if we booked it
		if timeSlot.ID != 0 {
			timeSlot.IsBooked = false
			h.DB.Save(&timeSlot)
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to create appointment")
		return
	}

	h.DB.Preload("Service").Preload("Master").Preload("User").Preload("ServiceOption").First(&appointment, appointment.ID)
	respondWithJSON(w, http.StatusCreated, appointment)
}

func (h *Handlers) GetAppointments(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	var appointments []models.Appointment
	if err := h.DB.Preload("Service").Preload("Master").Preload("Master.User").Preload("ServiceOption").Where("user_id = ?", userID).Find(&appointments).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch appointments")
		return
	}

	respondWithJSON(w, http.StatusOK, appointments)
}
