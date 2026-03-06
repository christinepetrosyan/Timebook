package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	DBSSLMode          string
	ServerPort         string
	ServerHost         string
	JWTSecret          string
	JWTExpirationHours int
	CORSAllowedOrigins []string
	Environment        string

	// Email (SMTP)
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPass     string
	SMTPFrom     string
	SendGridKey  string // Alternative to SMTP
	AppBaseURL   string // For links in emails

	// Messaging
	TelegramBotToken       string
	TelegramBotUsername    string // e.g. TimebookBot (without @)
	WhatsAppAccessToken    string
	WhatsAppPhoneNumberID  string
	ViberAuthToken         string
}

func Load() (*Config, error) {
	env := getEnv("ENVIRONMENT", "development")
	jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")

	// Validate JWT secret in production
	if env == "production" && (jwtSecret == "" || jwtSecret == "change-me-in-production") {
		return nil, errors.New("JWT_SECRET must be set to a secure value in production")
	}

	// Parse CORS origins from environment variable
	corsOrigins := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
	allowedOrigins := strings.Split(corsOrigins, ",")
	for i := range allowedOrigins {
		allowedOrigins[i] = strings.TrimSpace(allowedOrigins[i])
	}

	return &Config{
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "timebook"),
		DBPassword:         getEnv("DB_PASSWORD", "timebook"),
		DBName:             getEnv("DB_NAME", "timebook"),
		DBSSLMode:          getEnv("DB_SSLMODE", "disable"),
		ServerPort:         getEnv("SERVER_PORT", "8080"),
		ServerHost:         getEnv("SERVER_HOST", "0.0.0.0"),
		JWTSecret:          jwtSecret,
		JWTExpirationHours: 24,
		CORSAllowedOrigins: allowedOrigins,
		Environment:        env,
		SMTPHost:           getEnv("SMTP_HOST", ""),
		SMTPPort:           getEnv("SMTP_PORT", "587"),
		SMTPUser:           getEnv("SMTP_USER", ""),
		SMTPPass:           getEnv("SMTP_PASS", ""),
		SMTPFrom:           getEnv("SMTP_FROM", "noreply@timebook.app"),
		SendGridKey:        getEnv("SENDGRID_API_KEY", ""),
		AppBaseURL:         getEnv("APP_BASE_URL", "http://localhost:5173"),
		TelegramBotToken:    getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramBotUsername: getEnv("TELEGRAM_BOT_USERNAME", ""),
		WhatsAppAccessToken:   getEnv("WHATSAPP_ACCESS_TOKEN", ""),
		WhatsAppPhoneNumberID: getEnv("WHATSAPP_PHONE_NUMBER_ID", ""),
		ViberAuthToken:     getEnv("VIBER_AUTH_TOKEN", ""),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
