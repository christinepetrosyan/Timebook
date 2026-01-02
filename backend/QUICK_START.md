# Quick Start - Running Backend Locally

## The Problem You Encountered

You have a **local PostgreSQL** running on port 5432, which conflicts with the Docker PostgreSQL. When you try to connect to `localhost:5432`, it connects to your local PostgreSQL instead of Docker.

## Solutions

### Option 1: Run Migrations Inside Docker (Recommended)

```bash
cd backend
make migrate-up-docker
```

This runs migrations inside the Docker container, avoiding the port conflict.

### Option 2: Stop Local PostgreSQL Temporarily

```bash
# Stop local PostgreSQL (macOS with Homebrew)
brew services stop postgresql@14
# or
brew services stop postgresql

# Then run migrations normally
cd backend
make migrate-up
```

### Option 3: Use Docker PostgreSQL on Different Port

Edit `docker-compose.yml` to use a different port:
```yaml
ports:
  - "5433:5432"  # Use 5433 instead
```

Then update your `.env`:
```
DB_PORT=5433
```

## Running the Server

Once migrations are done:

```bash
cd backend

# Make sure .env file exists
cp .env.example .env  # Edit if needed

# Run the server
make run
# or
go run cmd/server/main.go
```

The server will start on `http://localhost:8080`

## Verify Everything Works

```bash
# Test registration
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test User"}'
```

## Common Commands

```bash
make run              # Run server
make migrate-up       # Run migrations (if no local PostgreSQL)
make migrate-up-docker # Run migrations in Docker (if local PostgreSQL exists)
make migrate-down     # Rollback last migration
make test            # Run tests
```

