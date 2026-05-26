# Aarogya | Hospital Management System

A full-stack Hospital Management System built with Node.js, Express, and PostgreSQL (Supabase). Aarogya demonstrates a wide range of SQL and database concepts through a real-world application: patient registration, appointment booking, billing, and admin analytics.

> **Demo Video:** [Watch on YouTube](https://youtu.be/Astj3hWVKQk) or view [demo_video.mp4](demo_video.mp4) in the repo. The video walks through all major features including the live trigger validation that rejects past-date appointments.

---

## Project Structure

```
Aarogya_Hospital_Management/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── db.js                  # Supabase PostgreSQL connection pool
│   ├── .env                   # Environment variables (not committed)
│   ├── package.json
│   ├── package-lock.json
│   └── routes/
│       ├── analytics.js       # Advanced SQL routes (GROUP BY, CTEs, set ops, cursors)
│       ├── appointments.js    # Appointment CRUD
│       ├── billing.js         # Billing CRUD
│       ├── doctors.js         # Doctor CRUD
│       └── patients.js        # Patient CRUD
├── frontend/
│   ├── index.html             # Single-page application shell
│   ├── script.js              # All client-side logic
│   ├── style.css              # UI styles
│   └── serve_frontend.js      # Static file server for local development
├── sql/
│   ├── schema.sql             # Core table definitions
│   └── db_setup.pgsql         # Full DB setup: tables, views, functions, triggers
└── .gitignore
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, HTML5, CSS3, Chart.js |
| Backend | Node.js, Express.js |
| Database | PostgreSQL via Supabase |
| ORM/Driver | node-postgres (`pg`) |

---

## Database Concepts Demonstrated

This project was built to showcase a broad set of relational database concepts in a working application.

**Core SQL**
- `SELECT`, `INSERT`, `UPDATE`, `DELETE` with parameterized queries
- `JOIN` (INNER, LEFT) across patients, doctors, appointments, treatments, billing
- `WHERE`, `ORDER BY`, `GROUP BY`, `HAVING`
- `LIKE`, `UPPER`, `LENGTH`, `SUBSTR`, `COALESCE`, `TO_CHAR` (built-in functions)
- Aggregate functions: `COUNT`, `SUM`, `AVG`, `MAX`, `MIN`
- `CASE` expressions for conditional aggregation

**Advanced SQL**
- `UNION`, `INTERSECT`, `EXCEPT` (set operations)
- `WITH` clause (CTEs) for readable multi-step queries
- Derived relations (subqueries in `FROM`)
- `NOT EXISTS` subqueries for gap analysis
- `CROSS JOIN` for global averages

**Views**
- `patient_summary` - patient totals and outstanding balance, used in the Patient Portal
- `v_doctor_workload` - per-doctor appointment counts by status, used in Admin Panel

**PL/pgSQL**
- Stored functions: `get_patient_bill_total`, `classify_patient_spend`, `get_doctor_appt_count`, `top_patient_for_specialty`
- Explicit cursor: `get_unpaid_patients()` with `OPEN / FETCH / EXIT WHEN NOT FOUND / CLOSE`
- Parameterized cursor: `get_doctor_schedule(doctor_id)` for per-doctor schedules
- `IF / ELSIF / ELSE` branching, `EXCEPTION` handling

**Transactions**
- `BEGIN / SAVEPOINT / COMMIT / ROLLBACK` for safe appointment booking
- Auto-generated IDs (`P###`, `A###`) computed transactionally to avoid duplicates

**Triggers**
- `validate_appointment_date` (BEFORE INSERT on `appointments`) - raises an exception if the appointment date is in the past

---

## Features by Page

### Home
- Hospital overview with quick navigation buttons
- Live treatment statistics bar (count, average cost by type)
- Treatment breakdown modal with Chart.js bar chart

### Patient Portal
- Register new patients (auto-generated patient ID)
- Search by patient ID - shows today's, upcoming, and past appointments plus billing
- Search by name or email using `LIKE` with string function display (`UPPER`, `SUBSTR`, `TO_CHAR`, `COALESCE`)
- Outstanding balance pulled from `patient_summary` view

### Doctor Dashboard
- Search by doctor ID
- Availability badge (EXISTS check for upcoming appointments)
- Full schedule via parameterized PL/pgSQL cursor
- Appointment breakdown chart (Chart.js)

### Appointments
- Book new appointments with full transaction safety (`BEGIN / SAVEPOINT / COMMIT`)
- Trigger validation: dates before today are rejected with a clear error message
- Sortable appointments table (click headers to toggle `ORDER BY ASC / DESC`)
- Search appointments by appointment ID or patient ID

### Admin Panel
- Dashboard stats cards (total patients, doctors, revenue via `SUM`, `AVG`, `MAX`, `MIN`)
- Appointment trend chart (last 7 dates, `GROUP BY` date)
- Doctor load table (`GROUP BY` + `COUNT` with `CASE`, backed by `v_doctor_workload` view)
- Busy specialties (`GROUP BY specialization HAVING COUNT > threshold`)
- Missing billing alerts (`EXCEPT` - appointments with no billing record)
- Never-appointed patients (`NOT EXISTS` subquery)
- Available doctors with no upcoming appointments (`NOT EXISTS`)
- Outstanding bills list via explicit PL/pgSQL cursor (`get_unpaid_patients()`)

---

## Getting Started

### Prerequisites

- Node.js v18+
- A Supabase project (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/Aarogya_Hospital_Management.git
cd Aarogya_Hospital_Management
```

### 2. Set up the database

Open your Supabase project's SQL editor and run the contents of `sql/db_setup.pgsql`. This creates all tables, views, functions, cursors, and triggers in one shot.

### 3. Configure environment variables

Create `backend/.env`:

```env
DB_USER=postgres
DB_HOST=db.<your-project-ref>.supabase.co
DB_NAME=postgres
DB_PASSWORD=your_supabase_password
DB_PORT=5432
PORT=3001
```

### 4. Install dependencies and start the backend

```bash
cd backend
npm install
node server.js
```

The backend runs at `http://localhost:3001`. You should see:

```
✅ Connected to Supabase PostgreSQL
🚀 Server running on http://localhost:3001
```

### 5. Start the frontend

In a separate terminal:

```bash
cd frontend
node serve_frontend.js
```

Open `http://localhost:5500` in your browser.

---

## API Endpoints

### Patients
| Method | Route | Description |
|---|---|---|
| GET | `/api/patients` | All patients |
| GET | `/api/patients/:id` | Single patient |
| POST | `/api/patients` | Register patient (auto-ID) |
| PUT | `/api/patients/:id` | Update patient |
| DELETE | `/api/patients/:id` | Delete patient |

### Doctors
| Method | Route | Description |
|---|---|---|
| GET | `/api/doctors` | All doctors |
| GET | `/api/doctors/:id` | Single doctor |
| POST | `/api/doctors` | Add doctor |

### Appointments
| Method | Route | Description |
|---|---|---|
| GET | `/api/appointments` | All appointments |
| GET | `/api/appointments/:id` | Single appointment |
| GET | `/api/appointments/patient/:id` | By patient |
| GET | `/api/appointments/doctor/:id` | By doctor |
| POST | `/api/appointments` | Book appointment |
| PATCH | `/api/appointments/:id/status` | Update status |

### Billing
| Method | Route | Description |
|---|---|---|
| GET | `/api/billing` | All billing records |
| GET | `/api/billing/:id` | Single record |
| GET | `/api/billing/patient/:id` | By patient |
| POST | `/api/billing` | Create bill |
| PATCH | `/api/billing/:id/payment` | Update payment status |
| DELETE | `/api/billing/:id` | Delete record |

### Analytics
| Method | Route | Description |
|---|---|---|
| GET | `/api/analytics/stats/dashboard` | Aggregate stats |
| GET | `/api/analytics/stats/doctor-load` | Doctor workload (GROUP BY) |
| GET | `/api/analytics/stats/busy-specialties` | Specialties (HAVING) |
| GET | `/api/analytics/stats/top-revenue-specialty` | CTE revenue analysis |
| GET | `/api/analytics/stats/above-avg-spenders` | Derived relation |
| GET | `/api/analytics/stats/treatments-summary` | Treatment breakdown |
| GET | `/api/analytics/appointments/sorted` | Sortable appointments |
| POST | `/api/analytics/appointments/book-safe` | Transactional booking |
| GET | `/api/analytics/admin/patients-missing-billing` | EXCEPT |
| GET | `/api/analytics/admin/patients-fully-active` | INTERSECT |
| GET | `/api/analytics/admin/patients-with-any-activity` | UNION |
| GET | `/api/analytics/admin/patients-never-appointed` | NOT EXISTS |
| GET | `/api/analytics/admin/doctors-available` | NOT EXISTS |
| GET | `/api/analytics/patients/search` | LIKE name search |
| GET | `/api/analytics/view/patient-summary/:id` | patient_summary VIEW |
| GET | `/api/analytics/view/doctor-workload` | v_doctor_workload VIEW |
| GET | `/api/analytics/cursor/unpaid-patients` | Explicit cursor |
| GET | `/api/analytics/cursor/doctor-schedule/:id` | Parameterized cursor |

---

## Trigger Demo

The `validate_appointment_date` trigger fires **before every INSERT** on the `appointments` table. If the date is earlier than `CURRENT_DATE`, it raises:

```
Appointment date (YYYY-MM-DD) cannot be in the past. Please choose a future date.
```

This is demonstrated in the video: with today's date set to 27 May 2026, any date before that is rejected immediately at the database level, regardless of how the request is made.

---

## .gitignore

The `.env` file containing database credentials is excluded from version control. Never commit it.

---

## License

This project was built for academic and demonstration purposes.
