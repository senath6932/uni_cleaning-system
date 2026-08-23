# University Cleaning System - Project Build Summary

**Project**: University Cleaning System  
**Framework**: Next.js 16.3.1 with TypeScript  
**Database**: PostgreSQL (Supabase)  
**ORM**: Prisma v7.9.1  
**Authentication**: Supabase Auth  
**Styling**: Tailwind CSS v4  

---

## 📋 Table of Contents
1. [Database Schema](#database-schema)
2. [Pages & Routing](#pages--routing)
3. [API Routes & Endpoints](#api-routes--endpoints)
4. [Business Logic & Libraries](#business-logic--libraries)
5. [User Roles & Permissions](#user-roles--permissions)
6. [Features & Functionality](#features--functionality)
7. [Testing](#testing)
8. [Configuration Files](#configuration-files)

---

## Database Schema

### Enums (Type Definitions)

#### User Roles
- `GAA` - General Administrative Assistant
- `EVALUATING_OFFICER` - Officer who evaluates cleaning tasks
- `PHI` - Presumably Premises/Hygiene Inspector
- `ADMINISTRATION_OFFICER` - Administrative roles
- `VICE_CHANCELLOR` - Vice Chancellor for final approvals

#### Task Management
- **TaskCategory**: DAILY, WEEKLY, MONTHLY
- **TaskFrequency**: DAILY, WEEKLY, MONTHLY
- **EvaluationResult**: P (Pass), X (Fail), NA (Not Applicable)

#### Attendance & Reports
- **AttendanceStatus**: PRESENT, ABSENT
- **ReportStatus**: DRAFT → SUBMITTED → ADMIN_APPROVED → VC_APPROVED (workflow states)
- **AdministrationDecision**: APPROVE, CORRECTION, REJECT
- **VCDecision**: APPROVE, REJECT, CLARIFICATION

#### Activity Tracking
- **ActivityAction**: 30+ activity types (LOGIN, LOGOUT, USER_CREATED, USER_UPDATED, etc.)
- **NotificationEvent**: MONTHLY_REPORT_AUTOMATICALLY_SUBMITTED, APPROVAL_NOTIFICATIONS, etc.

### Core Models

#### User
- `id`, `name`, `email`, `role`, `active`
- Relationships: Assignments, PHI assignments, evaluations, attendances, reviews, recommendations
- Tracks all user activities and notifications

#### Location
- `id`, `code`, `name`, `minimumWorkers`, `active`
- Core entity representing cleaning locations on campus
- Tracks location tasks, worker assignments, evaluations, attendance

#### CleaningTask
- `id`, `name`, `category`, `frequency`, `active`
- Definition of cleaning task types
- Linked to multiple locations via LocationTask

#### LocationTask
- `id`, `locationId`, `taskId`, `frequency`, `allocatedAmount`, `isAdditional`
- Connects tasks to locations with allocated budget
- Tracks evaluation history and payment calculations

#### CleaningWorker
- `id`, `name`, `active`
- Individual cleaning worker records
- Tracks location assignments and attendance history

#### Assignment Models
- **EvaluatingOfficerAssignment**: Links evaluating officers to locations
- **PHIAssignment**: Links PHI users to locations
- **WorkerLocationAssignment**: Links workers to locations with allocated amounts

#### Evaluation & Monitoring
- **DailyCleaningEvaluation**: Records daily cleaning quality evaluations
  - Stores evaluation results (Pass/Fail/NA), remarks
  - Can be finalized and locked
  - Unique per task, date, and occurrence

- **WorkerAttendance**: Records worker attendance at locations
  - Tracks presence/absence with remarks
  - Can be finalized and locked

- **DailyAttendanceEvaluation**: PHI's evaluation of total worker attendance
  - Aggregates presence counts
  - Can be finalized and locked

#### Monthly Reporting
- **MonthlyEvaluationReport**: Generated monthly report for each location
  - Status workflow from DRAFT to VC_APPROVED
  - Tracks when generated, submitted, processed
  - Summarizes task and worker performance

- **MonthlyTaskSummary**: Per-task summary in monthly report
  - Performance metrics: completion %, expected/passed/failed occurrences
  - Payment calculation: allocated vs recommended amount
  - Stores evaluation history and task remarks as JSON

- **MonthlyWorkerSummary**: Per-worker summary in monthly report
  - Attendance metrics and payment calculation

#### Payment & Approval
- **PaymentRecommendation**: Created for approved reports
  - Recommends payment allocation to workers/tasks
  - Tracks tasks added, payment allocation updates

- **PaymentTaskCalculation**: Task-level payment calculation
  - Stores original and modified amounts, reasons for changes
  - Tracks who made the calculation

- **PaymentWorkerCalculation**: Worker-level payment calculation
  - Similar to task calculation with worker-specific data

- **AdministrationReview**: Administration's review of monthly report
  - Decision: APPROVE, CORRECTION, REJECT
  - Feedback and recommendations

- **VCApproval**: Vice Chancellor's final approval
  - Decision: APPROVE, REJECT, CLARIFICATION
  - Feedback

#### Audit & Notifications
- **ActivityLog**: Comprehensive audit trail
  - Logs all user actions with timestamps
  - Stores entity IDs, previous/new values, details as JSON

- **Notification**: User notifications
  - Event-driven notifications for approvals, rejections, submissions
  - Tracks read status

- **AdditionalCleaningTask**: Extra tasks added beyond planned tasks
  - Can be associated with workers and included in payment

---

## Pages & Routing

### Public Pages
- **`/`**: Home/Landing page
- **`/login`**: User login page (Supabase Auth)

### Dashboard
- **`/dashboard`**: Main dashboard (role-based access)

### GAA (General Administrative Assistant)
- **`/gaa`**: GAA dashboard
- **`/gaa/users`**: User management
- **`/gaa/locations`**: Location management
- **`/gaa/tasks`**: Task definition management
- **`/gaa/location-tasks`**: Assign tasks to locations
- **`/gaa/evaluating-officer-assignments`**: Assign evaluating officers to locations
- **`/daily-monitoring`**: Shared daily monitoring entry point for Evaluating Officer and PHI roles

### Evaluating Officer
- **`/evaluating-officer`**: Evaluating officer dashboard
- **`/daily-monitoring`**: Record daily cleaning evaluations
  - Client-side component: `evaluating-officer-daily-monitoring-client.tsx`
- **`/evaluating-officer/history`**: View evaluation history

### PHI (Premises/Hygiene Inspector)
- **`/phi`**: PHI dashboard
- **`/daily-monitoring`**: Record total-present attendance evaluations
- **`/phi/attendance-history`**: View attendance history

### Administration
- **`/administration`**: Administration dashboard
  - Review monthly reports
  - Approve or request corrections
  - Generate payment recommendations

### Vice Chancellor
- **`/vice-chancellor`**: Vice Chancellor dashboard
  - Final approval of payment recommendations
  - View approval history

---

## API Routes & Endpoints

### Evaluating Officer API
- **`POST /api/evaluating-officer/daily-monitoring`**
  - Submit daily cleaning evaluations

### PHI API
- **`POST /api/phi/daily-monitoring`**
  - Submit daily attendance evaluations

### GAA Admin API
- **`GET /api/gaa/users`** - List all users
- **`POST /api/gaa/users`** - Create new user
- **`GET /api/gaa/users/[id]`** - Get user details
- **`PUT /api/gaa/users/[id]`** - Update user

- **`GET /api/gaa/locations`** - List all locations
- **`POST /api/gaa/locations`** - Create new location
- **`GET /api/gaa/locations/[id]`** - Get location details
- **`PUT /api/gaa/locations/[id]`** - Update location

- **`GET /api/gaa/tasks`** - List all cleaning tasks
- **`POST /api/gaa/tasks`** - Create new task
- **`GET /api/gaa/tasks/[id]`** - Get task details
- **`PUT /api/gaa/tasks/[id]`** - Update task

- **`GET /api/gaa/location-tasks`** - List location-task assignments
- **`POST /api/gaa/location-tasks`** - Create location-task assignment
- **`GET /api/gaa/location-tasks/[id]`** - Get assignment details
- **`PUT /api/gaa/location-tasks/[id]`** - Update assignment

- **`GET /api/gaa/evaluating-officer-assignments`** - List EO assignments
- **`POST /api/gaa/evaluating-officer-assignments`** - Create EO assignment
- **`GET /api/gaa/evaluating-officer-assignments/[id]`** - Get assignment details
- **`PUT /api/gaa/evaluating-officer-assignments/[id]`** - Update assignment

---

## Business Logic & Libraries

### Authentication & Authorization
- **`lib/auth.ts`**: Supabase authentication setup and session management
- **`lib/application-roles.ts`**: Role-based access control logic

### User Management
- **`lib/user-management.ts`**
  - User creation, updates, role changes
  - User activation/deactivation
  - Audit logging for user actions

### Location Management
- **`lib/location-management.ts`**
  - CRUD operations for locations
  - Location activation/deactivation
  - Audit logging for location changes

### Task Management
- **`lib/task-management.ts`**
  - Task definition CRUD
  - Task activation/deactivation
  - Task authorization (role-based)
  - Audit logging

### Location-Task Management
- **`lib/location-task-management.ts`**
  - Assign tasks to locations with allocated budgets
  - Manage task-location relationships
  - Calculate performance and recommendations

### Evaluating Officer Management
- **`lib/evaluating-officer-assignments.ts`**
  - Assign evaluating officers to locations
  - Manage officer assignments
  - Audit logging for assignment changes

### Evaluating Officer Monitoring
- **`lib/evaluating-officer-monitoring.ts`**
  - Record daily cleaning evaluations
  - Generate monthly evaluation summaries
  - Calculate completion percentages and recommendations
  - Finalize and lock evaluations

### PHI Management
- **`lib/phi-assignments.ts`**
  - Location access helper for PHI monitoring

### PHI Attendance Monitoring
- **`lib/phi-attendance-monitoring.ts`**
  - Record location-level total-present attendance
  - Enforce PHI access for authorized locations
  - Generate monthly attendance summaries
  - Finalize and lock attendance records

### Business Date Management
- **`lib/business-date.ts`**
  - Handles business date logic for evaluations
  - Determines reporting periods

### Supabase Integration
- **`lib/supabase/admin.ts`**: Server-side admin client
- **`lib/supabase/server.ts`**: Server-side client for authenticated requests
- **`lib/supabase/client.ts`**: Client-side SDK integration

### Prisma Configuration
- **`lib/prisma.ts`**: Prisma Client singleton for database access
- **`prisma.config.ts`**: Prisma configuration with PostgreSQL adapter

---

## User Roles & Permissions

### 1. GAA (General Administrative Assistant)
- Manage all users
- Create and manage locations
- Define cleaning tasks
- Assign tasks to locations
- Assign evaluating officers to locations
- Keep PHI access scoped to existing location monitoring records
- View reports and payment recommendations

### 2. Evaluating Officer
- View assigned locations
- Record daily cleaning evaluations for their assigned locations
- View evaluation history
- Finalize evaluations for submitted reports

### 3. PHI (Premises/Hygiene Inspector)
- View authorized locations
- Record daily attendance evaluations
- View attendance history
- Finalize attendance records for submitted reports

### 4. Administration Officer
- View generated monthly reports
- Review task and worker performance
- Approve or request corrections on reports
- Generate payment recommendations
- Manage additional cleaning tasks
- View activity logs

### 5. Vice Chancellor
- Review payment recommendations from Administration
- Approve or reject payment recommendations
- Request clarifications
- View approval history
- Make final financial decisions

---

## Features & Functionality

### 1. User Management System
- ✅ User registration and authentication via Supabase
- ✅ Role-based access control (5 roles)
- ✅ User activation/deactivation
- ✅ User role assignment and changes
- ✅ Audit logging for all user actions

### 2. Location Management
- ✅ Create and manage cleaning locations
- ✅ Set minimum worker requirements per location
- ✅ Location activation/deactivation
- ✅ Assign multiple workers per location
- ✅ Track location-specific data

### 3. Task Management
- ✅ Define cleaning tasks with categories (Daily, Weekly, Monthly)
- ✅ Set task frequency
- ✅ Task activation/deactivation
- ✅ Assign tasks to specific locations
- ✅ Set allocated budgets per location-task combination
- ✅ Support for additional ad-hoc tasks

### 4. Staff Assignments
- ✅ Assign evaluating officers to locations
- ✅ Assign PHI staff to locations
- ✅ Assign cleaning workers to locations
- ✅ Set allocated payment amounts per worker
- ✅ Manage active/inactive assignments

### 5. Daily Monitoring
- ✅ **Evaluating Officer Dashboard**: Record daily cleaning quality evaluations
  - Pass/Fail/Not Applicable results
  - Add remarks and feedback
  - Handle multiple evaluations per day (occurrences)
  - Finalize and lock evaluations

- ✅ **PHI Dashboard**: Record daily worker attendance
  - Mark workers as Present/Absent
  - Add attendance remarks
  - Aggregate daily attendance totals
  - Finalize and lock attendance

### 6. Monthly Reporting
- ✅ Automatic monthly report generation for each location
- ✅ Aggregate daily evaluations into monthly summaries
- ✅ Calculate completion percentages:
  - Expected, passed, failed, not-applicable, missing occurrences
- ✅ Generate payment recommendations based on performance:
  - Calculate allocated vs recommended amounts
  - Adjust for task completion rates
- ✅ Monthly worker performance summaries:
  - Attendance statistics
  - Payment calculations
- ✅ Report status workflow:
  - DRAFT → SUBMITTED → ADMIN_APPROVED → VC_APPROVED

### 7. Approval Workflow
- ✅ **Administration Review**:
  - Review monthly reports
  - Approve, request corrections, or reject
  - Add feedback and recommendations
  - Generate payment recommendations

- ✅ **Vice Chancellor Approval**:
  - Final review of payment recommendations
  - Approve, reject, or request clarifications
  - Track approval history

### 8. Audit & Logging
- ✅ Comprehensive activity logging:
  - 30+ activity types tracked
  - User actions (login, logout, create, update, delete)
  - Role changes
  - Evaluation updates
  - Attendance changes
  - Report submissions
  - Approval decisions
- ✅ Store previous and new values for changes
- ✅ Store additional details as JSON
- ✅ Timestamp all activities

### 9. Notifications
- ✅ Event-driven notification system
- ✅ Notification types:
  - Monthly report automatically submitted
  - Administration approval/rejection/correction requests
  - Payment recommendation created
  - Vice Chancellor approval/rejection/clarification requests
- ✅ Track notification read status

### 10. Additional Features
- ✅ Add additional cleaning tasks after month start
- ✅ Modify payment calculations with reasoning
- ✅ Business date logic for period determination
- ✅ Lock evaluations and attendance for data integrity
- ✅ Handle evaluation occurrences (multiple per day)

---

## Testing

### Test Files
The project includes comprehensive unit tests using Vitest:

1. **`evaluating-officer-assignments.test.ts`**
   - Tests for assigning evaluating officers to locations
   - Validates assignment creation, updates, deactivation

2. **`evaluating-officer-monitoring.test.ts`**
   - Tests for daily cleaning evaluation recording
   - Validates monthly summary generation
   - Tests completion percentage calculations

3. **`location-management.test.ts`**
   - Tests for location CRUD operations
   - Location activation/deactivation
   - Minimum worker requirement handling

4. **`location-task-management.test.ts`**
   - Tests for assigning tasks to locations
   - Budget allocation management
   - Task-location relationship handling

5. **`phi-attendance-monitoring.test.ts`**
   - Tests for attendance recording
   - Daily attendance aggregation
   - Monthly summary generation

6. **`task-auth.test.ts`**
   - Tests for task authorization based on user roles
   - Permission validation

7. **`task-management.test.ts`**
   - Tests for task CRUD operations
   - Task activation/deactivation

8. **`user-management.test.ts`**
   - Tests for user creation, updates, role changes
   - User activation/deactivation
   - Audit logging verification

**Run tests**:
```bash
npm run test
```

---

## Configuration Files

### Build & Runtime Config
- **`next.config.ts`**: Next.js configuration with Turbopack
- **`tsconfig.json`**: TypeScript configuration
- **`prisma.config.ts`**: Prisma ORM configuration
- **`package.json`**: Dependencies and scripts

### Development Tools
- **`eslint.config.mjs`**: ESLint configuration for code quality
- **`postcss.config.mjs`**: PostCSS configuration for CSS processing
- **`vitest.config.cjs`**: Vitest configuration for testing
- **`tailwindcss`**: CSS framework for styling

### Environment Variables
- **`.env`**: PostgreSQL connection strings (Supabase)
  - `DATABASE_URL`: Session-mode pooler for normal queries
  - `DIRECT_URL`: Direct connection for migrations

### Migrations
Located in `prisma/migrations/`:
- `20260816_add_cleaning_task_audit_actions`
- `20260816_add_daily_monitoring`
- `20260816_add_evaluating_officer_assignment_audit_actions`
- `20260816_add_location_audit_actions`
- `20260816_add_location_task_audit_actions`
- `20260816_add_phi_assignment_audit_actions`
- `20260816_merge_admin_into_gaa`
- `20260816_replace_firebase_uid_with_supabase_id`

---

## Technology Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend Framework** | Next.js 16.3.1 |
| **Language** | TypeScript 5 |
| **Runtime** | Node.js with React 19 |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma 7.9.1 |
| **Authentication** | Supabase Auth |
| **Styling** | Tailwind CSS 4 |
| **Testing** | Vitest 4.1.10 |
| **Linting** | ESLint 9 |
| **Build Tool** | Turbopack |

---

## Project Scripts

```bash
# Development
npm run dev          # Start development server on http://localhost:3001

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint

# Testing
npm run test         # Run Vitest tests
```

---

## Key Statistics

- **Database Models**: 20+ tables
- **Enums**: 8 main enums with 60+ values
- **API Routes**: 12+ endpoints
- **Pages**: 15+ pages across 5 role-based modules
- **Business Logic Libraries**: 13 core modules
- **Test Files**: 8 test suites
- **User Roles**: 5 distinct roles with different permissions

---

## Project Status

✅ **Complete Core Features**:
- User management and authentication
- Location and task management
- Staff assignments
- Daily monitoring (evaluations and attendance)
- Monthly report generation
- Approval workflows (Administration and VC)
- Audit logging and notifications
- Comprehensive test coverage

This is a fully functional university cleaning management system with role-based access, comprehensive audit trails, and a complete workflow from daily monitoring to payment approval.
