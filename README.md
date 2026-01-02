# Timebook - Online Appointment Management System

Timebook is a web application for managing online appointments with support for three user roles: Users, Masters, and Admins.

## Architecture

### Backend
- **Language**: Go (standard library, no frameworks)
- **ORM**: GORM
- **Database**: PostgreSQL
- **Migrations**: Go migrate (command line)

### Frontend
- **Build Tool**: Vite
- **Framework**: React
- **Language**: TypeScript

### Deployment
- **Containerization**: Docker & Docker Compose
- **Hosting**: Hostinger

## Project Structure

```
Timebook/
├── backend/          # Go backend application
│   ├── cmd/         # Application entry points
│   ├── internal/    # Internal application code
│   │   ├── models/  # Database models
│   │   ├── handlers/# HTTP handlers
│   │   ├── middleware/# Middleware
│   │   ├── config/  # Configuration
│   │   └── db/      # Database connection
│   ├── migrations/  # Database migrations
│   └── Makefile     # Make commands
├── frontend/        # React frontend application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── .gitignore
```

## Getting Started

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- Go migrate CLI

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
go mod download
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Run migrations:
```bash
make migrate-up
```

5. Run the server:
```bash
make run
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

### Docker Setup

1. Build and start all services:
```bash
docker-compose up --build
```

## User Roles

### User
- Find services/organizations
- Select available time slots
- Book appointments
- Receive notifications on confirmation

### Master
- Register and list services
- Receive appointment requests
- Confirm/reject appointments
- Manage calendar

### Admin
- Manage masters' appointments
- Oversee organization operations

## Development

### Running Migrations
```bash
make migrate-up      # Apply all migrations
make migrate-down    # Rollback last migration
make migrate-create  # Create new migration
```

### Testing
```bash
make test           # Run backend tests
```

## CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that:
- Runs backend tests
- Runs frontend linting and build
- Builds Docker images
- Deploys to Hostinger (on main branch)

## Environment Variables

### Backend
Create a `.env` file in the `backend/` directory:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=timebook
DB_PASSWORD=timebook
DB_NAME=timebook
DB_SSLMODE=disable
SERVER_PORT=8080
SERVER_HOST=0.0.0.0
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION_HOURS=24
```

### Frontend
Create a `.env` file in the `frontend/` directory (optional):
```
VITE_API_URL=http://localhost:8080/api
```

## License

MIT
