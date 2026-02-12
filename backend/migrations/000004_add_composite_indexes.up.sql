-- Add composite index for time slot queries by master and time range
CREATE INDEX IF NOT EXISTS idx_time_slots_master_time 
ON time_slots(master_id, start_time, end_time) 
WHERE deleted_at IS NULL;

-- Add composite index for appointment queries by master, status, and time
CREATE INDEX IF NOT EXISTS idx_appointments_master_status_time 
ON appointments(master_id, status, start_time) 
WHERE deleted_at IS NULL;

-- Add composite index for appointment queries by user and status
CREATE INDEX IF NOT EXISTS idx_appointments_user_status 
ON appointments(user_id, status) 
WHERE deleted_at IS NULL;

-- Add composite index for service queries by master
CREATE INDEX IF NOT EXISTS idx_services_master_deleted 
ON services(master_id) 
WHERE deleted_at IS NULL;
