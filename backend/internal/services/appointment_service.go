package services

import (
	"context"

	"github.com/timebook/backend/internal/models"
	"github.com/timebook/backend/internal/repositories"
	"github.com/timebook/backend/internal/transaction"
	"gorm.io/gorm"
)

// AppointmentService handles business logic for appointment operations
type AppointmentService struct {
	appointmentRepo repositories.AppointmentRepository
	timeslotRepo    repositories.TimeslotRepository
	txManager       *transaction.Manager
}

// NewAppointmentService creates a new appointment service
func NewAppointmentService(
	appointmentRepo repositories.AppointmentRepository,
	timeslotRepo repositories.TimeslotRepository,
	txManager *transaction.Manager,
) *AppointmentService {
	return &AppointmentService{
		appointmentRepo: appointmentRepo,
		timeslotRepo:    timeslotRepo,
		txManager:       txManager,
	}
}

// ConfirmAppointment confirms an appointment within a transaction
func (s *AppointmentService) ConfirmAppointment(ctx context.Context, appointmentID uint) (*models.Appointment, error) {
	result, err := s.txManager.WithTransaction(ctx, func(tx *gorm.DB) (interface{}, error) {
		// Get the appointment
		appointment, err := s.appointmentRepo.GetByID(ctx, tx, appointmentID)
		if err != nil {
			return nil, err
		}

		// Update status to confirmed
		appointment.Status = models.StatusConfirmed
		if err := s.appointmentRepo.Update(ctx, tx, appointment); err != nil {
			return nil, err
		}

		// Mark ALL time slots at this time as booked (master has unified calendar)
		if err := s.timeslotRepo.BookAllSlotsAtTime(ctx, tx, appointment.MasterID, appointment.StartTime, appointment.EndTime); err != nil {
			return nil, err
		}

		// Ensure a slot exists for this service/time
		if err := s.timeslotRepo.EnsureSlotExists(ctx, tx, appointment); err != nil {
			return nil, err
		}

		// Reload appointment with associations
		appointment, err = s.appointmentRepo.GetByID(ctx, tx, appointmentID)
		if err != nil {
			return nil, err
		}

		return appointment, nil
	})

	if err != nil {
		return nil, err
	}
	return result.(*models.Appointment), nil
}

// RejectAppointment rejects an appointment
func (s *AppointmentService) RejectAppointment(ctx context.Context, appointmentID uint) (*models.Appointment, error) {
	result, err := s.txManager.WithTransaction(ctx, func(tx *gorm.DB) (interface{}, error) {
		// Get the appointment
		appointment, err := s.appointmentRepo.GetByID(ctx, tx, appointmentID)
		if err != nil {
			return nil, err
		}

		// Update status to rejected
		appointment.Status = models.StatusRejected
		if err := s.appointmentRepo.Update(ctx, tx, appointment); err != nil {
			return nil, err
		}

		// Reload appointment with associations
		appointment, err = s.appointmentRepo.GetByID(ctx, tx, appointmentID)
		if err != nil {
			return nil, err
		}

		return appointment, nil
	})

	if err != nil {
		return nil, err
	}
	return result.(*models.Appointment), nil
}
