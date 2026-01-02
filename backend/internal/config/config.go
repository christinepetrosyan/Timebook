package config

import (
	"os"
)

type Config struct {
	DBHost            string
	DBPort            string
	DBUser            string
	DBPassword        string
	DBName            string
	DBSSLMode         string
	ServerPort        string
	ServerHost        string
	JWTSecret         string
	JWTExpirationHours int
	CORSAllowedOrigins []string
}

func Load() *Config {
	return &Config{
		DBHost:            getEnv("DB_HOST", "localhost"),
		DBPort:            getEnv("DB_PORT", "5432"),
		DBUser:            getEnv("DB_USER", "timebook"),
		DBPassword:        getEnv("DB_PASSWORD", "timebook"),
		DBName:            getEnv("DB_NAME", "timebook"),
		DBSSLMode:         getEnv("DB_SSLMODE", "disable"),
		ServerPort:        getEnv("SERVER_PORT", "8080"),
		ServerHost:        getEnv("SERVER_HOST", "0.0.0.0"),
		JWTSecret:         getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpirationHours: 24,
		CORSAllowedOrigins: []string{"http://localhost:5173", "http://localhost:3000"},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

