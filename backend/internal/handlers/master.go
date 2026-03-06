package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/timebook/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
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
	userID, ok := getContextUserID(w, r)
	if !ok {
		return
	}

	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		// Lazy-create master profile for users with role master (e.g. legacy accounts)
		var user models.User
		if err := h.DB.First(&user, userID).Error; err != nil {
			respondWithError(w, http.StatusNotFound, "User not found")
			return
		}
		if user.Role != models.RoleMaster {
			respondWithError(w, http.StatusNotFound, "Master profile not found")
			return
		}
		masterProfile = models.MasterProfile{UserID: userID}
		if err := h.DB.Create(&masterProfile).Error; err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to create master profile")
			return
		}
	}

	var services []models.Service
	if err := h.DB.Preload("Options").Where("master_id = ?", masterProfile.ID).Find(&services).Error; err != nil {
		// If the service_options table hasn't been migrated yet, log and fall back
		// to loading services without options so the master dashboard still works.
		if strings.Contains(err.Error(), `relation "service_options" does not exist`) {
			log.Printf("%s: %v", r.URL.Path, err)
			if err2 := h.DB.Where("master_id = ?", masterProfile.ID).Find(&services).Error; err2 != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to fetch services")
				return
			}
		} else {
			respondWithError(w, http.StatusInternalServerError, "Failed to fetch services")
			return
		}
	}

	respondWithJSON(w, http.StatusOK, services)
}

// UpdateService allows a master to edit their existing service
func (h *Handlers) UpdateService(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	serviceID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid service ID")
		return
	}

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	// Find service and ensure it belongs to master
	var service models.Service
	if err := h.DB.Where("id = ? AND master_id = ?", serviceID, masterProfile.ID).First(&service).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found")
		return
	}

	var req struct {
		Name        *string  `json:"name"`
		Description *string  `json:"description"`
		Duration    *int     `json:"duration"`
		Price       *float64 `json:"price"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name != nil {
		service.Name = *req.Name
	}
	if req.Description != nil {
		service.Description = *req.Description
	}
	if req.Duration != nil {
		service.Duration = *req.Duration
	}
	if req.Price != nil {
		service.Price = *req.Price
	}

	if err := h.DB.Save(&service).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update service")
		return
	}

	respondWithJSON(w, http.StatusOK, service)
}

// DeleteService allows a master to remove one of their services
func (h *Handlers) DeleteService(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	serviceID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid service ID")
		return
	}

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	// Ensure service belongs to master
	var service models.Service
	if err := h.DB.Where("id = ? AND master_id = ?", serviceID, masterProfile.ID).First(&service).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found")
		return
	}

	if err := h.DB.Delete(&service).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete service")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Service deleted"})
}

// CreateServiceOption adds a new sub-category/variant to a service
func (h *Handlers) CreateServiceOption(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	serviceID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid service ID")
		return
	}

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	// Ensure service belongs to master
	var service models.Service
	if err := h.DB.Where("id = ? AND master_id = ?", serviceID, masterProfile.ID).First(&service).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found")
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

	option := models.ServiceOption{
		ServiceID:   service.ID,
		Name:        req.Name,
		Description: req.Description,
		Duration:    req.Duration,
		Price:       req.Price,
	}

	if err := h.DB.Create(&option).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create service option")
		return
	}

	respondWithJSON(w, http.StatusCreated, option)
}

// UpdateServiceOption updates an existing sub-category/variant
func (h *Handlers) UpdateServiceOption(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	optionID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid service option ID")
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

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	// Ensure option belongs to a service owned by this master
	var option models.ServiceOption
	if err := h.DB.Preload("Service").Where("id = ?", optionID).First(&option).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service option not found")
		return
	}

	if option.Service.MasterID != masterProfile.ID {
		respondWithError(w, http.StatusForbidden, "Not allowed to modify this option")
		return
	}

	// Update fields
	if req.Name != "" {
		option.Name = req.Name
	}
	option.Description = req.Description
	if req.Duration > 0 {
		option.Duration = req.Duration
	}
	if req.Price >= 0 {
		option.Price = req.Price
	}

	if err := h.DB.Save(&option).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update service option")
		return
	}

	respondWithJSON(w, http.StatusOK, option)
}

// DeleteServiceOption removes a sub-category/variant
func (h *Handlers) DeleteServiceOption(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	optionID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid service option ID")
		return
	}

	// Get master profile
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	// Ensure option belongs to a service owned by this master
	var option models.ServiceOption
	if err := h.DB.Preload("Service").Where("id = ?", optionID).First(&option).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service option not found")
		return
	}

	if option.Service.MasterID != masterProfile.ID {
		respondWithError(w, http.StatusForbidden, "Not allowed to modify this option")
		return
	}

	if err := h.DB.Delete(&option).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete service option")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Service option deleted"})
}

func (h *Handlers) GetMasterAppointments(w http.ResponseWriter, r *http.Request) {
	userID, ok := getContextUserID(w, r)
	if !ok {
		return
	}

	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		// Lazy-create master profile for users with role master (e.g. legacy accounts)
		var user models.User
		if err := h.DB.First(&user, userID).Error; err != nil {
			respondWithError(w, http.StatusNotFound, "User not found")
			return
		}
		if user.Role != models.RoleMaster {
			respondWithError(w, http.StatusNotFound, "Master profile not found")
			return
		}
		masterProfile = models.MasterProfile{UserID: userID}
		if err := h.DB.Create(&masterProfile).Error; err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to create master profile")
			return
		}
	}

	var appointments []models.Appointment
	if err := h.DB.Preload("User").Preload("Service").Preload("ServiceOption").Where("master_id = ?", masterProfile.ID).Find(&appointments).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch appointments")
		return
	}

	respondWithJSON(w, http.StatusOK, appointments)
}

func (h *Handlers) ConfirmAppointment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	appointmentID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid appointment ID")
		return
	}

	// Verify master profile exists
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	// Verify appointment belongs to this master
	var appointment models.Appointment
	if err := h.DB.Where("id = ? AND master_id = ?", appointmentID, masterProfile.ID).First(&appointment).Error; err != nil {
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

func (h *Handlers) RejectAppointment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(uint)
	appointmentID, err := getIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid appointment ID")
		return
	}

	// Verify master profile exists
	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", userID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	// Verify appointment belongs to this master
	var appointment models.Appointment
	if err := h.DB.Where("id = ? AND master_id = ?", appointmentID, masterProfile.ID).First(&appointment).Error; err != nil {
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

// CreateAppointmentForClient allows a master to create an appointment on behalf of a client.
// Used for the "Work" flow when booking from the master calendar.
// Accepts either user_id (existing client) OR guest_name, guest_email, guest_phone (new guest).
func (h *Handlers) CreateAppointmentForClient(w http.ResponseWriter, r *http.Request) {
	masterUserID, ok := getContextUserID(w, r)
	if !ok {
		return
	}

	var masterProfile models.MasterProfile
	if err := h.DB.Where("user_id = ?", masterUserID).First(&masterProfile).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Master profile not found")
		return
	}

	var req struct {
		UserID          uint   `json:"user_id"`
		GuestName       string `json:"guest_name"`
		GuestEmail      string `json:"guest_email"`
		GuestPhone      string `json:"guest_phone"`
		ServiceID       uint   `json:"service_id"`
		ServiceOptionID *uint  `json:"service_option_id,omitempty"`
		StartTime       string `json:"start_time"`
		Notes           string `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Verify service belongs to this master
	var service models.Service
	if err := h.DB.Preload("Master").Preload("Options").Where("id = ? AND master_id = ?", req.ServiceID, masterProfile.ID).First(&service).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Service not found")
		return
	}

	var client models.User

	if req.UserID != 0 {
		// Existing client
		if err := h.DB.Where("id = ? AND role = ?", req.UserID, models.RoleUser).First(&client).Error; err != nil {
			respondWithError(w, http.StatusNotFound, "Client not found")
			return
		}
	} else if req.GuestEmail != "" && req.GuestName != "" {
		// New guest: create placeholder user
		req.GuestEmail = strings.TrimSpace(strings.ToLower(req.GuestEmail))
		req.GuestName = strings.TrimSpace(req.GuestName)
		if len(req.GuestEmail) < 3 {
			respondWithError(w, http.StatusBadRequest, "Valid guest email is required")
			return
		}

		// Check if email already exists
		if err := h.DB.Where("email = ?", req.GuestEmail).First(&client).Error; err == nil {
			if client.IsGuest {
				// Reuse existing guest
			} else {
				respondWithError(w, http.StatusConflict, "A user with this email already exists. Search for them instead.")
				return
			}
		} else {
			// Create new guest user with random password
			b := make([]byte, 32)
			if _, err := rand.Read(b); err != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to create guest")
				return
			}
			randomPass := base64.URLEncoding.EncodeToString(b)
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(randomPass), bcrypt.DefaultCost)
			if err != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to create guest")
				return
			}
			client = models.User{
				Email:    req.GuestEmail,
				Password: string(hashedPassword),
				Name:     req.GuestName,
				Phone:    strings.TrimSpace(req.GuestPhone),
				Role:     models.RoleUser,
				IsGuest:  true,
			}
			if err := h.DB.Create(&client).Error; err != nil {
				respondWithError(w, http.StatusBadRequest, "Failed to create guest: "+err.Error())
				return
			}
		}
	} else {
		respondWithError(w, http.StatusBadRequest, "Provide either user_id or guest_name and guest_email")
		return
	}

	duration := service.Duration
	if len(service.Options) > 0 {
		if req.ServiceOptionID == nil {
			respondWithError(w, http.StatusBadRequest, "This service has sub-categories. Please select one.")
			return
		}
		var option models.ServiceOption
		if err := h.DB.Where("id = ? AND service_id = ?", *req.ServiceOptionID, req.ServiceID).First(&option).Error; err != nil {
			respondWithError(w, http.StatusNotFound, "Service sub-category not found")
			return
		}
		duration = option.Duration
	}

	startTime, err := parseTime(req.StartTime)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid time format")
		return
	}

	endTime := startTime.Add(minutesToDuration(duration))

	// Check for conflicts (master-wide: any overlapping appointment blocks the slot)
	var conflictingAppointment models.Appointment
	if err := h.DB.Where(
		"master_id = ? AND deleted_at IS NULL AND status IN (?, ?) AND start_time < ? AND end_time > ?",
		masterProfile.ID,
		models.StatusPending,
		models.StatusConfirmed,
		endTime, startTime,
	).First(&conflictingAppointment).Error; err == nil {
		respondWithError(w, http.StatusConflict, "Time slot conflicts with existing appointment")
		return
	}

	// Mark matching time slot as booked if it exists
	var timeSlot models.TimeSlot
	if err := h.DB.Where(
		"master_id = ? AND service_id = ? AND start_time = ? AND end_time = ? AND is_booked = ? AND deleted_at IS NULL",
		masterProfile.ID,
		req.ServiceID,
		startTime,
		endTime,
		false,
	).First(&timeSlot).Error; err == nil {
		timeSlot.IsBooked = true
		h.DB.Save(&timeSlot)
	}

	appointment := models.Appointment{
		UserID:          client.ID,
		MasterID:        masterProfile.ID,
		ServiceID:       req.ServiceID,
		ServiceOptionID: req.ServiceOptionID,
		StartTime:       startTime,
		EndTime:         endTime,
		Status:          models.StatusConfirmed, // Master-created appointments are auto-confirmed
		Notes:           req.Notes,
	}

	if err := h.DB.Create(&appointment).Error; err != nil {
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
