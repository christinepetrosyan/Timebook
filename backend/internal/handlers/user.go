package handlers

import (
	"encoding/json"
	"net/http"
	"sort"
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

	// Get date range from query params (default to next 7 days)
	now := time.Now()
	startDate := now
	endDate := now.AddDate(0, 0, 7)

	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		if t, err := parseTime(startDateStr); err == nil {
			startDate = t
		}
	}

	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		if t, err := parseTime(endDateStr); err == nil {
			endDate = t
		}
	}

	// Generate default time slots for each day in the range
	// Default schedule: 9 AM to 6 PM, slots every hour based on service duration
	slotMap := make(map[string]*models.TimeSlot) // Key: start_time-end_time

	// Generate slots for each day in the range
	currentDate := startDate
	for currentDate.Before(endDate) || currentDate.Equal(endDate) {
		// Generate slots from 9 AM to 6 PM
		for hour := 9; hour < 18; hour++ {
			slotStart := time.Date(currentDate.Year(), currentDate.Month(), currentDate.Day(), hour, 0, 0, 0, time.UTC)
			slotEnd := slotStart.Add(minutesToDuration(service.Duration))

			// Skip if slot end time is after endDate
			if slotEnd.After(endDate) {
				break
			}

			key := slotStart.Format(time.RFC3339) + "-" + slotEnd.Format(time.RFC3339)
			slotMap[key] = &models.TimeSlot{
				MasterID:  service.MasterID,
				ServiceID: service.ID,
				StartTime: slotStart,
				EndTime:   slotEnd,
				IsBooked:  false,
			}
		}
		// Move to next day
		currentDate = currentDate.AddDate(0, 0, 1)
		currentDate = time.Date(currentDate.Year(), currentDate.Month(), currentDate.Day(), 0, 0, 0, 0, currentDate.Location())
	}

	// Query existing time slots from database for the date range
	var existingSlots []models.TimeSlot
	if err := h.DB.Where(
		"service_id = ? AND deleted_at IS NULL AND start_time < ? AND end_time > ?",
		serviceID,
		endDate,
		startDate,
	).Order("start_time ASC").Find(&existingSlots).Error; err == nil {
		// Merge existing slots into the map (overwrite defaults)
		for i := range existingSlots {
			// Normalize to UTC to ensure consistent key matching
			key := existingSlots[i].StartTime.UTC().Format(time.RFC3339) + "-" + existingSlots[i].EndTime.UTC().Format(time.RFC3339)
			slotMap[key] = &existingSlots[i]
		}
	}

	// Check for confirmed/pending appointments that should mark slots as booked
	var appointments []models.Appointment
	if err := h.DB.Where(
		"service_id = ? AND deleted_at IS NULL AND status IN (?, ?) AND start_time < ? AND end_time > ?",
		serviceID,
		models.StatusPending,
		models.StatusConfirmed,
		endDate,
		startDate,
	).Order("start_time ASC").Find(&appointments).Error; err == nil {
		for _, apt := range appointments {
			// Normalize to UTC to ensure consistent key matching with default slots
			key := apt.StartTime.UTC().Format(time.RFC3339) + "-" + apt.EndTime.UTC().Format(time.RFC3339)
			if slot, exists := slotMap[key]; exists {
				// Mark slot as booked if appointment is confirmed
				if apt.Status == models.StatusConfirmed {
					slot.IsBooked = true
				}
			} else {
				// Create slot entry for appointment that doesn't match default schedule
				slotMap[key] = &models.TimeSlot{
					MasterID:  apt.MasterID,
					ServiceID: apt.ServiceID,
					StartTime: apt.StartTime,
					EndTime:   apt.EndTime,
					IsBooked:  apt.Status == models.StatusConfirmed,
				}
			}
		}
	}

	// Convert map to slice and sort
	timeSlots := make([]models.TimeSlot, 0, len(slotMap))
	for _, slot := range slotMap {
		timeSlots = append(timeSlots, *slot)
	}
	sort.Slice(timeSlots, func(i, j int) bool {
		return timeSlots[i].StartTime.Before(timeSlots[j].StartTime)
	})

	// Convert to response format
	slots := make([]map[string]interface{}, len(timeSlots))
	for i, slot := range timeSlots {
		slots[i] = map[string]interface{}{
			"id":         slot.ID,
			"service_id": slot.ServiceID,
			"start_time": slot.StartTime.Format(time.RFC3339),
			"end_time":   slot.EndTime.Format(time.RFC3339),
			"available":  !slot.IsBooked,
			"is_booked":  slot.IsBooked,
		}
	}

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
		UserID:    userID,
		MasterID:  service.MasterID,
		ServiceID: req.ServiceID,
		StartTime: startTime,
		EndTime:   endTime,
		Status:    models.StatusPending,
		Notes:     req.Notes,
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
