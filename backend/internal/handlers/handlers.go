package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/timebook/backend/internal/config"
	"github.com/timebook/backend/internal/notifications"
	"github.com/timebook/backend/internal/repositories"
	"github.com/timebook/backend/internal/services"
	"github.com/timebook/backend/internal/transaction"
	"gorm.io/gorm"
)

type Handlers struct {
	DB                  *gorm.DB
	Config              *config.Config
	AppointmentService  *services.AppointmentService
	MasterService       *services.MasterService
	Notifier            *notifications.Dispatcher
	VerificationService *services.VerificationService
}

func New(db *gorm.DB, cfg *config.Config) *Handlers {
	// Initialize transaction manager
	txManager := transaction.New(db)

	// Initialize repositories
	masterRepo := repositories.NewMasterRepository(db)
	appointmentRepo := repositories.NewAppointmentRepository(db)
	timeslotRepo := repositories.NewTimeslotRepository(db)

	// Initialize services
	appointmentService := services.NewAppointmentService(appointmentRepo, timeslotRepo, txManager)
	masterService := services.NewMasterService(masterRepo, txManager)

	// Initialize notification providers
	emailProvider := &notifications.EmailProvider{
		Host: cfg.SMTPHost,
		Port: cfg.SMTPPort,
		User: cfg.SMTPUser,
		Pass: cfg.SMTPPass,
		From: cfg.SMTPFrom,
	}
	telegramProvider := &notifications.TelegramProvider{BotToken: cfg.TelegramBotToken}
	whatsappProvider := &notifications.WhatsAppProvider{
		AccessToken:   cfg.WhatsAppAccessToken,
		PhoneNumberID: cfg.WhatsAppPhoneNumberID,
	}
	viberProvider := &notifications.ViberProvider{AuthToken: cfg.ViberAuthToken}

	notifier := notifications.NewDispatcher(db, emailProvider, telegramProvider, whatsappProvider, viberProvider)
	verificationService := services.NewVerificationService(db, emailProvider)

	return &Handlers{
		DB:                  db,
		Config:              cfg,
		AppointmentService:  appointmentService,
		MasterService:       masterService,
		Notifier:            notifier,
		VerificationService: verificationService,
	}
}

// HealthCheck returns the health status of the application
func (h *Handlers) HealthCheck(w http.ResponseWriter, r *http.Request) {
	// Check database connection
	sqlDB, err := h.DB.DB()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"status":   "unhealthy",
			"database": "error getting DB instance",
		})
		return
	}

	if err := sqlDB.Ping(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"status":   "unhealthy",
			"database": "down",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":   "healthy",
		"database": "connected",
		"version":  "1.0.0",
	})
}
