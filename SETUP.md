# Timebook Setup Guide

This guide will help you set up the Timebook application for development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Go** 1.21 or higher
- **Node.js** 18 or higher
- **Docker** and **Docker Compose**
- **PostgreSQL** 14 or higher (if running locally without Docker)
- **Go migrate** CLI tool

## Quick Start with Docker

The easiest way to get started is using Docker Compose:

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd Timebook

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Build and start all services
docker-compose up --build

# The application will be available at:
# - Frontend: http://localhost
# - Backend API: http://localhost:8080
```

## Manual Setup

### 1. Database Setup

If not using Docker, set up PostgreSQL:

```bash
# Create database
createdb timebook

# Or using psql
psql -U postgres
CREATE DATABASE timebook;
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
go mod download

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Install go-migrate (if not already installed)
# macOS
brew install golang-migrate

# Linux
curl -L https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/migrate

# Run migrations
make migrate-up

# Run the server
make run
```

The backend will be available at `http://localhost:8080`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Creating Your First Admin User

Admin users need to be created manually in the database or through a migration. To create an admin user:

```sql
-- Connect to your database
psql -U timebook -d timebook

-- Insert admin user (password: admin123 - change this!)
INSERT INTO users (email, password, name, role, created_at, updated_at)
VALUES (
  'admin@timebook.com',
  '$2a$10$YourHashedPasswordHere', -- Use bcrypt to hash your password
  'Admin User',
  'admin',
  NOW(),
  NOW()
);
```

Or use a tool to hash your password and insert it.

## Testing the Application

1. **Register a User:**
   - Go to http://localhost:5173/register
   - Register as a regular user

2. **Register a Master:**
   - Go to http://localhost:5173/register
   - Select "Master" role
   - After registration, login and add services

3. **Book an Appointment:**
   - Login as a user
   - Search for services
   - Book an appointment

4. **Confirm Appointment:**
   - Login as the master
   - View appointment requests
   - Confirm or reject appointments

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify database exists

### Migration Issues

- Ensure go-migrate is installed
- Check database connection string
- Verify migration files exist in `backend/migrations/`

### Port Conflicts

- Backend default port: 8080
- Frontend default port: 5173
- PostgreSQL default port: 5432

Change ports in configuration files if needed.

## Development Workflow

1. Make changes to code
2. For backend: Restart the server (`make run`)
3. For frontend: Hot reload is automatic
4. Run tests: `make test` (backend) or `npm test` (frontend)
5. Create migrations: `make migrate-create` (backend)

## Production Deployment

See the README.md for deployment instructions to Hostinger.

