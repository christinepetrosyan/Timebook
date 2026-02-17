package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

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

	respondWithJSON(w, http.StatusOK, rejectedAppointment)
}
