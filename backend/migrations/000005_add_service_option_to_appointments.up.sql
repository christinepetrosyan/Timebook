-- Add service_option_id column to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_option_id INTEGER REFERENCES service_options(id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_appointments_service_option_id ON appointments(service_option_id) WHERE service_option_id IS NOT NULL;
