package services

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/timebook/backend/internal/models"
	"github.com/timebook/backend/internal/notifications"
	"gorm.io/gorm"
)

const (
	codeExpiryMinutes = 15
	resendCooldownSec = 60
)

// VerificationService handles email verification for registration
type VerificationService struct {
	db            *gorm.DB
	emailProvider *notifications.EmailProvider
}

// NewVerificationService creates a new verification service
func NewVerificationService(db *gorm.DB, emailProvider *notifications.EmailProvider) *VerificationService {
	return &VerificationService{
		db:            db,
		emailProvider: emailProvider,
	}
}

// GenerateAndSendCode generates a 6-digit code, stores it, and sends it via email.
// If SMTP is not configured, logs the code to console (dev fallback).
func (s *VerificationService) GenerateAndSendCode(userID uint, email string) (string, error) {
	code, err := generateCode()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(codeExpiryMinutes * time.Minute)
	vc := &models.VerificationCode{
		UserID:    userID,
		Email:     email,
		Code:      code,
		ExpiresAt: expiresAt,
	}

	if err := s.db.Create(vc).Error; err != nil {
		return "", err
	}

	// Delete any older codes for this email
	s.db.Where("email = ? AND id != ?", email, vc.ID).Delete(&models.VerificationCode{})

	body := fmt.Sprintf("Your Timebook verification code is: %s\n\nThis code expires in %d minutes.", code, codeExpiryMinutes)
	n := &notifications.Notification{
		UserEmail: email,
		Subject:   "Verify your Timebook account",
		PlainBody: body,
		Body:      body,
	}

	if s.emailProvider.Host != "" {
		if err := s.emailProvider.Send(n); err != nil {
			log.Printf("verification: failed to send email to %s: %v", email, err)
			return "", fmt.Errorf("failed to send verification email")
		}
	} else {
		log.Printf("verification: SMTP not configured, code for %s: %s", email, code)
	}

	return code, nil
}

// VerifyCode validates the code, marks the user as verified, and deletes the code.
func (s *VerificationService) VerifyCode(email, code string) (*models.User, error) {
	var vc models.VerificationCode
	err := s.db.Where("email = ? AND code = ? AND expires_at > ?", email, code, time.Now()).
		First(&vc).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("invalid or expired verification code")
		}
		return nil, err
	}

	var user models.User
	if err := s.db.Where("id = ?", vc.UserID).First(&user).Error; err != nil {
		return nil, err
	}

	user.EmailVerified = true
	if err := s.db.Save(&user).Error; err != nil {
		return nil, err
	}

	s.db.Delete(&vc)
	return &user, nil
}

// CanResend checks if a resend is allowed (rate limit: 1 per minute per email)
func (s *VerificationService) CanResend(email string) bool {
	var count int64
	cutoff := time.Now().Add(-resendCooldownSec * time.Second)
	s.db.Model(&models.VerificationCode{}).Where("email = ? AND created_at > ?", email, cutoff).Count(&count)
	return count == 0
}

// ResendCode generates and sends a new code. Returns error if rate limited.
func (s *VerificationService) ResendCode(email string) error {
	if !s.CanResend(email) {
		return fmt.Errorf("please wait %d seconds before requesting a new code", resendCooldownSec)
	}

	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("no account found for this email")
		}
		return err
	}

	_, err := s.GenerateAndSendCode(user.ID, email)
	return err
}

func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()+100000), nil
}
