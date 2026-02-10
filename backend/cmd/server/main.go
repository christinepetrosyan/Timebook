package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/timebook/backend/internal/config"
	"github.com/timebook/backend/internal/db"
	"github.com/timebook/backend/internal/handlers"
	"github.com/timebook/backend/internal/middleware"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize database
	database, err := db.Initialize(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize handlers
	h := handlers.New(database, cfg)

	// Setup routes
	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("POST /api/auth/register", h.Register)
	mux.HandleFunc("POST /api/auth/login", h.Login)
	mux.HandleFunc("GET /api/services", h.GetServices)
	mux.HandleFunc("GET /api/services/{id}/slots", h.GetAvailableSlots)

	// Apply middleware
	authMiddleware := middleware.AuthMiddleware(cfg.JWTSecret)
	userMiddleware := middleware.RoleMiddleware("user")
	masterMiddleware := middleware.RoleMiddleware("master")
	adminMiddleware := middleware.RoleMiddleware("admin")

	// User routes (protected)
	mux.HandleFunc("GET /api/user/profile", authMiddleware(userMiddleware(http.HandlerFunc(h.GetUserProfile))).ServeHTTP)
	mux.HandleFunc("POST /api/appointments", authMiddleware(userMiddleware(http.HandlerFunc(h.CreateAppointment))).ServeHTTP)
	mux.HandleFunc("GET /api/appointments", authMiddleware(userMiddleware(http.HandlerFunc(h.GetAppointments))).ServeHTTP)

	// Master routes (protected)
	mux.HandleFunc("GET /api/master/profile", authMiddleware(masterMiddleware(http.HandlerFunc(h.GetMasterProfile))).ServeHTTP)
	mux.HandleFunc("POST /api/master/services", authMiddleware(masterMiddleware(http.HandlerFunc(h.CreateService))).ServeHTTP)
	mux.HandleFunc("GET /api/master/services", authMiddleware(masterMiddleware(http.HandlerFunc(h.GetMasterServices))).ServeHTTP)
	mux.HandleFunc("PUT /api/master/services/{id}", authMiddleware(masterMiddleware(http.HandlerFunc(h.UpdateService))).ServeHTTP)
	mux.HandleFunc("DELETE /api/master/services/{id}", authMiddleware(masterMiddleware(http.HandlerFunc(h.DeleteService))).ServeHTTP)
	mux.HandleFunc("GET /api/master/appointments", authMiddleware(masterMiddleware(http.HandlerFunc(h.GetMasterAppointments))).ServeHTTP)
	mux.HandleFunc("PUT /api/master/appointments/{id}/confirm", authMiddleware(masterMiddleware(http.HandlerFunc(h.ConfirmAppointment))).ServeHTTP)
	mux.HandleFunc("PUT /api/master/appointments/{id}/reject", authMiddleware(masterMiddleware(http.HandlerFunc(h.RejectAppointment))).ServeHTTP)

	// Master time slot routes (protected)
	mux.HandleFunc("POST /api/master/time-slots", authMiddleware(masterMiddleware(http.HandlerFunc(h.CreateTimeSlot))).ServeHTTP)
	mux.HandleFunc("GET /api/master/time-slots", authMiddleware(masterMiddleware(http.HandlerFunc(h.GetTimeSlots))).ServeHTTP)
	mux.HandleFunc("PUT /api/master/time-slots/{id}", authMiddleware(masterMiddleware(http.HandlerFunc(h.UpdateTimeSlot))).ServeHTTP)
	mux.HandleFunc("PUT /api/master/time-slots/{id}/toggle-booking", authMiddleware(masterMiddleware(http.HandlerFunc(h.ToggleTimeSlotBooking))).ServeHTTP)
	mux.HandleFunc("DELETE /api/master/time-slots/{id}", authMiddleware(masterMiddleware(http.HandlerFunc(h.DeleteTimeSlot))).ServeHTTP)

	// Master service options (sub-categories) routes (protected)
	mux.HandleFunc("POST /api/master/services/{id}/options", authMiddleware(masterMiddleware(http.HandlerFunc(h.CreateServiceOption))).ServeHTTP)
	mux.HandleFunc("DELETE /api/master/service-options/{id}", authMiddleware(masterMiddleware(http.HandlerFunc(h.DeleteServiceOption))).ServeHTTP)

	// Admin routes (protected)
	mux.HandleFunc("GET /api/admin/masters", authMiddleware(adminMiddleware(http.HandlerFunc(h.GetMasters))).ServeHTTP)
	mux.HandleFunc("GET /api/admin/appointments", authMiddleware(adminMiddleware(http.HandlerFunc(h.GetAllAppointments))).ServeHTTP)
	mux.HandleFunc("PUT /api/admin/appointments/{id}/confirm", authMiddleware(adminMiddleware(http.HandlerFunc(h.AdminConfirmAppointment))).ServeHTTP)
	mux.HandleFunc("PUT /api/admin/appointments/{id}/reject", authMiddleware(adminMiddleware(http.HandlerFunc(h.AdminRejectAppointment))).ServeHTTP)

	// CORS middleware
	handler := middleware.CORSMiddleware(mux)

	// Start server
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = cfg.ServerPort
	}

	log.Printf("Server starting on %s:%s", cfg.ServerHost, port)
	if err := http.ListenAndServe(cfg.ServerHost+":"+port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
