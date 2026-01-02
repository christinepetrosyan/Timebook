# Timebook Architecture

## Overview

Timebook is a full-stack web application for managing online appointments with three distinct user roles: Users, Masters, and Admins.

## System Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTP/HTTPS
       │
┌──────▼─────────────────────────────────────┐
│         Frontend (React + Vite)            │
│  - User Interface                          │
│  - Authentication                          │
│  - API Communication                       │
└──────┬─────────────────────────────────────┘
       │ REST API
       │
┌──────▼─────────────────────────────────────┐
│         Backend (Go)                       │
│  - HTTP Server (net/http)                  │
│  - JWT Authentication                      │
│  - Role-based Authorization                │
│  - Business Logic                          │
└──────┬─────────────────────────────────────┘
       │
┌──────▼─────────────────────────────────────┐
│      Database (PostgreSQL)                 │
│  - Users                                    │
│  - Masters                                 │
│  - Services                                │
│  - Appointments                            │
└────────────────────────────────────────────┘
```

## Backend Architecture

### Directory Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go          # Application entry point
├── internal/
│   ├── config/             # Configuration management
│   ├── db/                 # Database connection
│   ├── handlers/           # HTTP request handlers
│   │   ├── auth.go         # Authentication handlers
│   │   ├── user.go         # User handlers
│   │   ├── master.go       # Master handlers
│   │   ├── admin.go        # Admin handlers
│   │   └── helpers.go      # Helper functions
│   ├── middleware/         # HTTP middleware
│   │   ├── auth.go         # JWT authentication
│   │   └── cors.go         # CORS handling
│   └── models/             # Database models
│       ├── user.go         # User & MasterProfile models
│       ├── service.go      # Service & TimeSlot models
│       └── appointment.go  # Appointment model
├── migrations/             # Database migrations
│   ├── 000001_init.up.sql
│   └── 000001_init.down.sql
├── Makefile                # Build commands
└── go.mod                  # Go dependencies
```

### Key Components

#### 1. Models
- **User**: Base user model with roles (user, master, admin)
- **MasterProfile**: Extended profile for service providers
- **Service**: Services offered by masters
- **Appointment**: Booking requests and confirmations

#### 2. Handlers
- **Auth**: Registration and login
- **User**: Service browsing and appointment booking
- **Master**: Service management and appointment confirmation
- **Admin**: Oversight of all appointments and masters

#### 3. Middleware
- **AuthMiddleware**: Validates JWT tokens
- **RoleMiddleware**: Enforces role-based access control
- **CORSMiddleware**: Handles cross-origin requests

## Frontend Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── components/         # Reusable components
│   │   ├── Layout.tsx
│   │   └── ProtectedRoute.tsx
│   ├── contexts/           # React contexts
│   │   └── AuthContext.tsx
│   ├── pages/              # Page components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── user/
│   │   │   └── Dashboard.tsx
│   │   ├── master/
│   │   │   └── Dashboard.tsx
│   │   └── admin/
│   │       └── Dashboard.tsx
│   ├── services/           # API services
│   │   └── api.ts
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── package.json
└── vite.config.ts
```

### Key Features

- **React Router**: Client-side routing
- **Context API**: Global state management (auth)
- **Axios**: HTTP client with interceptors
- **TypeScript**: Type safety

## API Endpoints

### Public Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/services` - List services
- `GET /api/services/{id}/slots` - Get available time slots

### User Endpoints (Protected)
- `GET /api/user/profile` - Get user profile
- `POST /api/appointments` - Create appointment
- `GET /api/appointments` - List user's appointments

### Master Endpoints (Protected)
- `GET /api/master/profile` - Get master profile
- `POST /api/master/services` - Create service
- `GET /api/master/services` - List master's services
- `GET /api/master/appointments` - List appointment requests
- `PUT /api/master/appointments/{id}/confirm` - Confirm appointment
- `PUT /api/master/appointments/{id}/reject` - Reject appointment

### Admin Endpoints (Protected)
- `GET /api/admin/masters` - List all masters
- `GET /api/admin/appointments` - List all appointments
- `PUT /api/admin/appointments/{id}/confirm` - Confirm appointment (admin)
- `PUT /api/admin/appointments/{id}/reject` - Reject appointment (admin)

## Database Schema

### Users Table
- id, email, password, name, role, phone
- Soft deletes supported

### Master Profiles Table
- id, user_id, bio, specialty, experience
- One-to-one with Users

### Services Table
- id, master_id, name, description, duration, price
- Many-to-one with Master Profiles

### Appointments Table
- id, user_id, master_id, service_id, start_time, end_time, status, notes
- Status: pending, confirmed, rejected, cancelled

## Security

1. **Authentication**: JWT tokens with expiration
2. **Authorization**: Role-based access control
3. **Password Hashing**: bcrypt with default cost
4. **CORS**: Configurable allowed origins
5. **SQL Injection**: Protected by GORM parameterized queries

## Deployment

### Docker Architecture

```
docker-compose.yml
├── postgres (Database)
├── backend (Go API)
└── frontend (Nginx + React)
```

### CI/CD Pipeline

1. **Test**: Run backend tests and frontend linting
2. **Build**: Create Docker images
3. **Deploy**: Push to Hostinger (on main branch)

## Development Workflow

1. **Local Development**:
   - Backend: `make run` (port 8080)
   - Frontend: `npm run dev` (port 5173)
   - Database: PostgreSQL (port 5432)

2. **Migrations**:
   - Create: `make migrate-create`
   - Apply: `make migrate-up`
   - Rollback: `make migrate-down`

3. **Testing**:
   - Backend: `make test`
   - Frontend: `npm test`

## Future Enhancements

- Email notifications
- Calendar integration
- Payment processing
- Real-time updates (WebSockets)
- Mobile app (React Native)
- Advanced search and filtering
- Recurring appointments
- Reviews and ratings

