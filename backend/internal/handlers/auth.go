package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/timebook/backend/internal/middleware"
	"github.com/timebook/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Role     string `json:"role"` // "user" or "master"
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

type RegisterVerificationResponse struct {
	RequiresVerification bool   `json:"requires_verification"`
	Email                string `json:"email"`
}

type VerifyEmailRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type ResendCodeRequest struct {
	Email string `json:"email"`
}

func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate role
	role := models.RoleUser
	if req.Role == "master" {
		role = models.RoleMaster
	} else if req.Role == "admin" {
		role = models.RoleAdmin
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	// Check for existing guest user (claim flow)
	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err == nil {
		if user.IsGuest {
			// Claim: update password and convert to full user
			user.Password = string(hashedPassword)
			user.Name = req.Name
			if req.Phone != "" {
				user.Phone = req.Phone
			}
			user.IsGuest = false
			if err := h.DB.Save(&user).Error; err != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to claim account")
				return
			}
			// Require email verification if not already verified
			if !user.EmailVerified {
				if _, err := h.VerificationService.GenerateAndSendCode(user.ID, user.Email); err != nil {
					respondWithError(w, http.StatusInternalServerError, "Failed to send verification email")
					return
				}
				respondWithJSON(w, http.StatusOK, RegisterVerificationResponse{
					RequiresVerification: true,
					Email:               user.Email,
				})
				return
			}
			// Already verified: generate token and return
			token, err := generateToken(user, h.Config.JWTSecret)
			if err != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
				return
			}
			user.Password = ""
			respondWithJSON(w, http.StatusOK, AuthResponse{Token: token, User: user})
			return
		}
		// Email already taken by non-guest user
		respondWithError(w, http.StatusBadRequest, "Email already registered")
		return
	}

	// New user (email_verified = false)
	user = models.User{
		Email:         req.Email,
		Password:      string(hashedPassword),
		Name:          req.Name,
		Phone:         req.Phone,
		Role:          role,
		EmailVerified: false,
	}

	if err := h.DB.Create(&user).Error; err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to create user: "+err.Error())
		return
	}

	// Create master profile if role is master
	if role == models.RoleMaster {
		masterProfile := models.MasterProfile{
			UserID: user.ID,
		}
		h.DB.Create(&masterProfile)
	}

	// Send verification code
	if _, err := h.VerificationService.GenerateAndSendCode(user.ID, user.Email); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to send verification email")
		return
	}

	respondWithJSON(w, http.StatusCreated, RegisterVerificationResponse{
		RequiresVerification: true,
		Email:               user.Email,
	})
}

func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Generate token
	token, err := generateToken(user, h.Config.JWTSecret)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	user.Password = "" // Don't send password back
	respondWithJSON(w, http.StatusOK, AuthResponse{
		Token: token,
		User:  user,
	})
}

func generateToken(user models.User, secret string) (string, error) {
	claims := &middleware.Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   string(user.Role),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}

func (h *Handlers) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Email == "" || req.Code == "" {
		respondWithError(w, http.StatusBadRequest, "Email and code are required")
		return
	}

	user, err := h.VerificationService.VerifyCode(req.Email, req.Code)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	token, err := generateToken(*user, h.Config.JWTSecret)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	user.Password = ""
	respondWithJSON(w, http.StatusOK, AuthResponse{Token: token, User: *user})
}

func (h *Handlers) ResendCode(w http.ResponseWriter, r *http.Request) {
	var req ResendCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Email == "" {
		respondWithError(w, http.StatusBadRequest, "Email is required")
		return
	}

	if err := h.VerificationService.ResendCode(req.Email); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Verification code sent"})
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}
