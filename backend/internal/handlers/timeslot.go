package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/timebook/backend/internal/models"
)

// CreateTimeSlot creates a new time slot for a master's service
func (h *Handlers) CreateTimeSlot(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var req struct {
		ServiceID uint   `json:"service_id"`
		StartTime string `json:"start_time"`
		EndTime   string `json:"end_time"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Verify service belongs to master
	var service models.Service
	if err := h.DB.Where("id = ? AND master_id = ?", req.ServiceID, masterProfile.ID).First(&service).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found or does not belong to you")
		return
	}

	// Parse times
	startTime, err := parseTime(req.StartTime)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid start time format")
		return
	}

	endTime, err := parseTime(req.EndTime)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid end time format")
		return
	}

	// Validate time order
	if !endTime.After(startTime) {
		respondWithError(w, http.StatusBadRequest, "End time must be after start time")
		return
	}

	// Check for overlapping slots
	var existingSlot models.TimeSlot
	if err := h.DB.Where(
		"master_id = ? AND service_id = ? AND deleted_at IS NULL AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))",
		masterProfile.ID,
		req.ServiceID,
		startTime, startTime,
		endTime, endTime,
		startTime, endTime,
	).First(&existingSlot).Error; err == nil {
		respondWithError(w, http.StatusConflict, "Time slot overlaps with existing slot")
		return
	}

	// Check for overlapping appointments
	var existingAppointment models.Appointment
	if err := h.DB.Where(
		"master_id = ? AND service_id = ? AND deleted_at IS NULL AND status IN (?, ?) AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))",
		masterProfile.ID,
		req.ServiceID,
		models.StatusPending,
		models.StatusConfirmed,
		startTime, startTime,
		endTime, endTime,
		startTime, endTime,
	).First(&existingAppointment).Error; err == nil {
		respondWithError(w, http.StatusConflict, "Time slot overlaps with existing appointment")
		return
	}

	timeSlot := models.TimeSlot{
		MasterID:  masterProfile.ID,
		ServiceID: req.ServiceID,
		StartTime: startTime,
		EndTime:   endTime,
		IsBooked:  false,
	}

	if err := h.DB.Create(&timeSlot).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create time slot")
		return
	}

	h.DB.Preload("Service").Preload("Master").First(&timeSlot, timeSlot.ID)
	respondWithJSON(w, http.StatusCreated, timeSlot)
}

// GetTimeSlots retrieves time slots for a master's service
func (h *Handlers) GetTimeSlots(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	serviceIDStr := r.URL.Query().Get("service_id")

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	query := h.DB.Where("master_id = ?", masterProfile.ID)

	// Filter by service if provided
	if serviceIDStr != "" {
		serviceID, err := strconv.ParseUint(serviceIDStr, 10, 32)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid service_id")
			return
		}

		// Verify service belongs to master
		var service models.Service
		if err := h.DB.Where("id = ? AND master_id = ?", serviceID, masterProfile.ID).First(&service).Error; err != nil {
			respondWithError(w, http.StatusNotFound, "Service not found or does not belong to you")
			return
		}

		query = query.Where("service_id = ?", serviceID)
	}

	// Filter by date range if provided
	if startDate := r.URL.Query().Get("start_date"); startDate != "" {
		if t, err := parseTime(startDate); err == nil {
			query = query.Where("start_time >= ?", t)
		}
	}

	if endDate := r.URL.Query().Get("end_date"); endDate != "" {
		if t, err := parseTime(endDate); err == nil {
			query = query.Where("end_time <= ?", t)
		}
	}

	// Filter by booked status if provided
	if bookedStr := r.URL.Query().Get("is_booked"); bookedStr != "" {
		isBooked := bookedStr == "true"
		query = query.Where("is_booked = ?", isBooked)
	}

	var timeSlots []models.TimeSlot
	if err := query.Preload("Service").Order("start_time ASC").Find(&timeSlots).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch time slots")
		return
	}

	respondWithJSON(w, http.StatusOK, timeSlots)
}

// UpdateTimeSlot updates an existing time slot
func (h *Handlers) UpdateTimeSlot(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	timeSlotID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid time slot ID")
		return
	}

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var timeSlot models.TimeSlot
	if err := h.DB.Where("id = ? AND master_id = ?", timeSlotID, masterProfile.ID).First(&timeSlot).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Time slot not found")
		return
	}

	// Don't allow updating booked slots
	if timeSlot.IsBooked {
		respondWithError(w, http.StatusBadRequest, "Cannot update booked time slot")
		return
	}

	var req struct {
		StartTime *string `json:"start_time"`
		EndTime   *string `json:"end_time"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	startTime := timeSlot.StartTime
	endTime := timeSlot.EndTime

	if req.StartTime != nil {
		t, err := parseTime(*req.StartTime)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid start time format")
			return
		}
		startTime = t
	}

	if req.EndTime != nil {
		t, err := parseTime(*req.EndTime)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid end time format")
			return
		}
		endTime = t
	}

	// Validate time order
	if !endTime.After(startTime) {
		respondWithError(w, http.StatusBadRequest, "End time must be after start time")
		return
	}

	// Check for overlapping slots (excluding current slot)
	var existingSlot models.TimeSlot
	if err := h.DB.Where(
		"id != ? AND master_id = ? AND service_id = ? AND deleted_at IS NULL AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))",
		timeSlotID,
		masterProfile.ID,
		timeSlot.ServiceID,
		startTime, startTime,
		endTime, endTime,
		startTime, endTime,
	).First(&existingSlot).Error; err == nil {
		respondWithError(w, http.StatusConflict, "Time slot overlaps with existing slot")
		return
	}

	timeSlot.StartTime = startTime
	timeSlot.EndTime = endTime

	if err := h.DB.Save(&timeSlot).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update time slot")
		return
	}

	h.DB.Preload("Service").Preload("Master").First(&timeSlot, timeSlot.ID)
	respondWithJSON(w, http.StatusOK, timeSlot)
}

// DeleteTimeSlot deletes a time slot
func (h *Handlers) DeleteTimeSlot(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	timeSlotID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid time slot ID")
		return
	}

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var timeSlot models.TimeSlot
	if err := h.DB.Where("id = ? AND master_id = ?", timeSlotID, masterProfile.ID).First(&timeSlot).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Time slot not found")
		return
	}

	// Don't allow deleting booked slots
	if timeSlot.IsBooked {
		respondWithError(w, http.StatusBadRequest, "Cannot delete booked time slot")
		return
	}

	if err := h.DB.Delete(&timeSlot).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete time slot")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Time slot deleted successfully"})
}

// ToggleTimeSlotBooking toggles the booking status of a time slot
// Masters can use this to mark slots as booked (for lunch, phone appointments, etc.) or unbooked
func (h *Handlers) ToggleTimeSlotBooking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	timeSlotID, _ := getIDParam(r) // ID is optional here; fall back to creating a slot if not found

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var req struct {
		ServiceID uint   `json:"service_id"`
		StartTime string `json:"start_time"`
		EndTime   string `json:"end_time"`
		IsBooked  bool   `json:"is_booked"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Try to find existing time slot by ID first
	var timeSlot models.TimeSlot
	if timeSlotID != 0 {
		if err := h.DB.Where("id = ? AND master_id = ?", timeSlotID, masterProfile.ID).First(&timeSlot).Error; err == nil {
			// Update existing time slot
			timeSlot.IsBooked = req.IsBooked
			if err := h.DB.Save(&timeSlot).Error; err != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to update time slot")
				return
			}
			h.DB.Preload("Service").Preload("Master").First(&timeSlot, timeSlot.ID)
			respondWithJSON(w, http.StatusOK, timeSlot)
			return
		}
	}

	// Time slot doesn't exist, create it
	// Verify service belongs to master
	var service models.Service
	if err := h.DB.Where("id = ? AND master_id = ?", req.ServiceID, masterProfile.ID).First(&service).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found or does not belong to you")
		return
	}

	// Parse times
	startTime, err := parseTime(req.StartTime)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid start time format")
		return
	}

	endTime, err := parseTime(req.EndTime)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid end time format")
		return
	}

	// Check if slot already exists with same time
	if err := h.DB.Where(
		"master_id = ? AND service_id = ? AND start_time = ? AND end_time = ?",
		masterProfile.ID,
		req.ServiceID,
		startTime,
		endTime,
	).First(&timeSlot).Error; err == nil {
		// Update existing slot
		timeSlot.IsBooked = req.IsBooked
		h.DB.Save(&timeSlot)
	} else {
		// Create new time slot
		timeSlot = models.TimeSlot{
			MasterID:  masterProfile.ID,
			ServiceID: req.ServiceID,
			StartTime: startTime,
			EndTime:   endTime,
			IsBooked:  req.IsBooked,
		}
		if err := h.DB.Create(&timeSlot).Error; err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to create time slot")
			return
		}
	}

	h.DB.Preload("Service").Preload("Master").First(&timeSlot, timeSlot.ID)
	respondWithJSON(w, http.StatusOK, timeSlot)
}
