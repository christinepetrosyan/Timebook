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
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
