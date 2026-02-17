-- Remove service_option_id column from appointments table
DROP INDEX IF EXISTS idx_appointments_service_option_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS service_option_id;
