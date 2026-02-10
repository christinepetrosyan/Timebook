-- Create time_slots table
CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    master_id INTEGER NOT NULL REFERENCES master_profiles(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_booked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_time_slots_deleted_at ON time_slots(deleted_at);
CREATE INDEX IF NOT EXISTS idx_time_slots_master_id ON time_slots(master_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_service_id ON time_slots(service_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_start_time ON time_slots(start_time);
CREATE INDEX IF NOT EXISTS idx_time_slots_end_time ON time_slots(end_time);
CREATE INDEX IF NOT EXISTS idx_time_slots_is_booked ON time_slots(is_booked);

-- Add constraint to ensure end_time is after start_time
ALTER TABLE time_slots ADD CONSTRAINT check_time_order CHECK (end_time > start_time);
