# Timebook Data Model

Overview of database tables and Go models used in the Timebook application.

---

## Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   users     │────────<│ master_profiles  │>────────│  services   │
└─────────────┘   1:1   └──────────────────┘   1:N  └─────────────┘
      │                            │                       │
      │                            │                       │
      │ 1:N                        │ 1:N                   │ 1:N
      ▼                            ▼                       ▼
┌─────────────────┐         ┌─────────────────┐    ┌──────────────────┐
│  appointments   │         │  time_slots     │    │ service_options  │
└─────────────────┘         └─────────────────┘    └──────────────────┘
      │                            │
      └────────────────────────────┘
         (references master_id, service_id)
```

---

## Tables

### `users`

| Column     | Type         | Constraints       | Description                    |
|------------|--------------|-------------------|--------------------------------|
| id         | SERIAL       | PRIMARY KEY       | Auto-increment ID              |
| created_at | TIMESTAMP    | NOT NULL, DEFAULT | Creation timestamp             |
| updated_at | TIMESTAMP    | NOT NULL, DEFAULT | Last update timestamp          |
| deleted_at | TIMESTAMP    | nullable          | Soft delete (GORM)            |
| email      | VARCHAR(255) | UNIQUE, NOT NULL  | User email                    |
| password   | VARCHAR(255) | NOT NULL          | Hashed password               |
| name       | VARCHAR(255) | NOT NULL          | Display name                  |
| role       | VARCHAR(20)  | NOT NULL, DEFAULT | `user`, `master`, or `admin`  |
| phone      | VARCHAR(50) | nullable          | Phone number                  |

**Indexes:** `deleted_at`, `email`

---

### `master_profiles`

| Column     | Type      | Constraints       | Description                 |
|------------|-----------|-------------------|-----------------------------|
| id         | SERIAL    | PRIMARY KEY       | Auto-increment ID           |
| created_at | TIMESTAMP | NOT NULL, DEFAULT | Creation timestamp          |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT | Last update timestamp       |
| deleted_at | TIMESTAMP | nullable          | Soft delete                 |
| user_id    | INTEGER   | UNIQUE, NOT NULL  | FK → users.id, ON DELETE CASCADE |
| bio        | TEXT      | nullable          | Master bio                  |
| specialty  | VARCHAR(255) | nullable       | Master specialty            |
| experience | INTEGER   | nullable          | Years of experience         |

**Indexes:** `deleted_at`, `user_id`

**Relations:** One user can have one master profile (1:1). A master has many services and appointments.

---

### `services`

| Column     | Type         | Constraints       | Description                    |
|------------|--------------|-------------------|--------------------------------|
| id         | SERIAL       | PRIMARY KEY       | Auto-increment ID              |
| created_at | TIMESTAMP    | NOT NULL, DEFAULT | Creation timestamp             |
| updated_at | TIMESTAMP    | NOT NULL, DEFAULT | Last update timestamp          |
| deleted_at | TIMESTAMP    | nullable          | Soft delete                    |
| master_id  | INTEGER      | NOT NULL          | FK → master_profiles.id, CASCADE |
| name       | VARCHAR(255) | NOT NULL          | Service name                   |
| description| TEXT         | nullable          | Service description           |
| duration   | INTEGER      | NOT NULL          | Duration in minutes            |
| price      | DECIMAL(10,2)| NOT NULL          | Price                          |

**Indexes:** `deleted_at`, `master_id`

**Relations:** A master has many services. A service has many appointments, time slots, and service options.

---

### `appointments`

| Column     | Type         | Constraints       | Description                    |
|------------|--------------|-------------------|--------------------------------|
| id         | SERIAL       | PRIMARY KEY       | Auto-increment ID              |
| created_at | TIMESTAMP    | NOT NULL, DEFAULT | Creation timestamp             |
| updated_at | TIMESTAMP    | NOT NULL, DEFAULT | Last update timestamp          |
| deleted_at | TIMESTAMP    | nullable          | Soft delete                    |
| user_id    | INTEGER      | NOT NULL          | FK → users.id, CASCADE        |
| master_id  | INTEGER      | NOT NULL          | FK → master_profiles.id, CASCADE |
| service_id | INTEGER      | NOT NULL          | FK → services.id, CASCADE     |
| start_time | TIMESTAMP    | NOT NULL          | Appointment start              |
| end_time   | TIMESTAMP    | NOT NULL          | Appointment end                |
| status     | VARCHAR(20)  | NOT NULL, DEFAULT | `pending`, `confirmed`, `rejected`, `cancelled` |
| notes      | TEXT         | nullable          | Customer notes                 |

**Indexes:** `deleted_at`, `user_id`, `master_id`, `service_id`, `status`

**Relations:** Links user (client), master, and service. Status flow: pending → confirmed or rejected.

---

### `time_slots`

| Column     | Type      | Constraints       | Description                    |
|------------|-----------|-------------------|--------------------------------|
| id         | SERIAL    | PRIMARY KEY       | Auto-increment ID              |
| created_at | TIMESTAMP | NOT NULL, DEFAULT | Creation timestamp             |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT | Last update timestamp          |
| deleted_at | TIMESTAMP | nullable          | Soft delete                    |
| master_id  | INTEGER   | NOT NULL          | FK → master_profiles.id, CASCADE |
| service_id | INTEGER   | NOT NULL          | FK → services.id, CASCADE     |
| start_time | TIMESTAMP | NOT NULL          | Slot start                     |
| end_time   | TIMESTAMP | NOT NULL          | Slot end                       |
| is_booked  | BOOLEAN   | NOT NULL, DEFAULT | Whether slot is blocked (e.g. lunch) |

** Constraints:** `CHECK (end_time > start_time)`

**Indexes:** `deleted_at`, `master_id`, `service_id`, `start_time`, `end_time`, `is_booked`

**Relations:** Master defines availability. One master, one calendar, so overlapping slots are blocked across all services.

---

### `service_options`

| Column     | Type         | Constraints       | Description                    |
|------------|--------------|-------------------|--------------------------------|
| id         | SERIAL       | PRIMARY KEY       | Auto-increment ID              |
| created_at | TIMESTAMP    | NOT NULL, DEFAULT | Creation timestamp             |
| updated_at | TIMESTAMP    | NOT NULL, DEFAULT | Last update timestamp          |
| deleted_at | TIMESTAMP    | nullable          | Soft delete                    |
| service_id | INTEGER      | NOT NULL          | FK → services.id, CASCADE     |
| name       | VARCHAR(255) | NOT NULL          | Option name (e.g. sub-category) |
| description| TEXT         | nullable          | Option description            |
| duration   | INTEGER      | NOT NULL          | Duration in minutes            |
| price      | DECIMAL(10,2)| NOT NULL          | Price                          |

**Indexes:** `deleted_at`, `service_id`

**Relations:** Sub-categories or variants of a service (e.g. "Haircut – Short" vs "Haircut – Long") with their own duration and price.

---

## Go Models

Models live in `backend/internal/models/`:

| File           | Structs                         | Description                          |
|----------------|---------------------------------|--------------------------------------|
| `user.go`      | `User`, `MasterProfile`         | User accounts and master profiles    |
| `appointment.go` | `Appointment`, `AppointmentStatus` | Bookings and status enum          |
| `service.go`   | `Service`, `TimeSlot`, `ServiceOption` | Services, availability, options |

---

## Enums

- **User role:** `user` | `master` | `admin`
- **Appointment status:** `pending` | `confirmed` | `rejected` | `cancelled`

---

## Migrations

- `000001_init.up.sql` – users, master_profiles, services, appointments
- `000002_add_time_slots.up.sql` – time_slots
- `000003_add_service_options.up.sql` – service_options
