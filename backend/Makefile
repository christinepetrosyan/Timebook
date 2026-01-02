.PHONY: run build test migrate-up migrate-down migrate-create migrate-force

# Database connection string (adjust as needed)
DB_URL ?= postgres://timebook:timebook@localhost:5432/timebook?sslmode=disable
MIGRATIONS_DIR = ./migrations

# Run the application
run:
	go run cmd/server/main.go

# Build the application
build:
	go build -o bin/server cmd/server/main.go

# Run tests
test:
	go test -v ./...

# Run migrations up
# If local PostgreSQL conflicts with Docker, use: make migrate-up-docker
migrate-up:
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" up

# Run migrations inside Docker container (use if local PostgreSQL is running)
migrate-up-docker:
	@echo "Running migrations inside Docker container..."
	docker cp $(MIGRATIONS_DIR) timebook-postgres:/migrations
	docker exec timebook-postgres sh -c 'if ! command -v migrate >/dev/null 2>&1; then \
		apk add --no-cache curl >/dev/null 2>&1 && \
		curl -sL https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.linux-amd64.tar.gz | tar xvz && \
		chmod +x migrate; \
	fi && \
	./migrate -path /migrations -database "postgres://timebook:timebook@localhost:5432/timebook?sslmode=disable" up'

# Run migrations down
migrate-down:
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" down 1

# Create new migration
migrate-create:
	@read -p "Enter migration name: " name; \
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $$name

# Force migration version (use with caution)
migrate-force:
	@read -p "Enter version to force: " version; \
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" force $$version

# Install dependencies
deps:
	go mod download
	go mod tidy

