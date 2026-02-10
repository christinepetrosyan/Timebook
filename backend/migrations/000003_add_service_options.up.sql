-- Create service_options table (sub-categories / variants for services)
CREATE TABLE IF NOT EXISTS service_options (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_options_deleted_at ON service_options(deleted_at);
CREATE INDEX IF NOT EXISTS idx_service_options_service_id ON service_options(service_id);

