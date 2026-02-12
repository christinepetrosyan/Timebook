-- Remove composite indexes
DROP INDEX IF EXISTS idx_time_slots_master_time;
DROP INDEX IF EXISTS idx_appointments_master_status_time;
DROP INDEX IF EXISTS idx_appointments_user_status;
DROP INDEX IF EXISTS idx_services_master_deleted;
