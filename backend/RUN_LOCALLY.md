# Running Backend Locally

## Prerequisites

1. **Go 1.22+** installed
2. **PostgreSQL** running (or use Docker for just the database)
3. **go-migrate** CLI tool installed

## Quick Start

### Option 1: Using Docker for Database Only

```bash
# Start only PostgreSQL
docker run -d \
  --name timebook-postgres \
  -e POSTGRES_USER=timebook \
  -e POSTGRES_PASSWORD=timebook \
  -e POSTGRES_DB=timebook \
  -p 5432:5432 \
  postgres:14-alpine
```

### Option 2: Use Existing Docker PostgreSQL

If you already have the database running via docker-compose:
```bash
# The database is already running on port 5432
```

## Step-by-Step Setup

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Install Dependencies

```bash
make deps
# or manually:
go mod download
go mod tidy
```

### 3. Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your database credentials
# If using Docker PostgreSQL, the defaults should work
```

### 4. Run Database Migrations

```bash
# Make sure go-migrate is installed
# macOS: brew install golang-migrate
# Linux: See https://github.com/golang-migrate/migrate

# Run migrations
make migrate-up
```

### 5. Run the Server

```bash
# Using Makefile
make run

# Or directly with Go
go run cmd/server/main.go
```

The server will start on `http://localhost:8080`

## Common Commands

```bash
# Run server
make run

# Build binary
make build

# Run tests
make test

# Run migrations
make migrate-up

# Rollback last migration
make migrate-down

# Create new migration
make migrate-create
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
psql -U timebook -d timebook -h localhost

# Or check Docker container
docker ps | grep postgres
```

### Port Already in Use

```bash
# Change SERVER_PORT in .env file
# Or kill the process using port 8080
lsof -ti:8080 | xargs kill
```

### Migration Issues

```bash
# Check migration status
migrate -path ./migrations -database "postgres://timebook:timebook@localhost:5432/timebook?sslmode=disable" version

# Force migration version (if needed)
make migrate-force
```

## Environment Variables

The backend uses these environment variables (from `.env` file):

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database user (default: timebook)
- `DB_PASSWORD` - Database password (default: timebook)
- `DB_NAME` - Database name (default: timebook)
- `SERVER_PORT` - Server port (default: 8080)
- `JWT_SECRET` - JWT secret key (change in production!)

## Testing the API

Once the server is running, test it:

```bash
# Register a user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

