<div align="center">

# University Cleaning Management System

A role-based web application for managing university cleaning operations, daily monitoring, worker attendance, monthly performance reports, and payment approvals.

[![Next.js](https://img.shields.io/badge/Next.js-16.3.1-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Auth-Supabase-3ECF8E?logo=supabase)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

**Live Application:** [uni-cleaning-system.vercel.app](https://uni-cleaning-system.vercel.app/)

</div>

---

## Overview

The University Cleaning Management System is designed to support the administration and monitoring of cleaning activities across university locations. It provides separate role-based workspaces for administrative staff, evaluating officers, PHI inspectors, administration officers, and the Vice Chancellor.

The system brings together location and task allocation, daily cleaning evaluations, worker attendance, monthly reporting, payment recommendations, and approval workflows.

## Key Features

### User and Access Management
- User registration and authentication through Supabase Auth.
- Five application roles with role-based access control.
- User creation, role assignment, activation, and deactivation.
- Role-specific dashboards and access restrictions.

### Location and Cleaning Task Management
- Create and manage university cleaning locations.
- Define cleaning tasks with daily, weekly, or monthly frequencies.
- Assign tasks to locations and allocate amounts.
- Manage cleaning workers and their location assignments.
- Assign evaluating officers and PHI inspectors to authorized locations.
- Support additional cleaning tasks.

### Daily Monitoring
- Record cleaning quality evaluations as Pass, Fail, or Not Applicable.
- Add remarks to evaluations.
- Record worker attendance as Present or Absent.
- Review daily monitoring history.
- Finalize and lock evaluation and attendance records.

### Monthly Reports and Approvals
- Generate monthly reports for each location.
- Summarize cleaning task completion and worker attendance.
- Calculate performance percentages and payment recommendations.
- Allow Administration Officers to review reports and approve, reject, or request corrections.
- Support final payment recommendation review by the Vice Chancellor.
- Track approval decisions and clarification requests.

### Audit Trail and Notifications
- Record important user and system activities with timestamps.
- Maintain change history for relevant operations.
- Notify users about report submissions, review decisions, and approval events.
- Track notification read status.

### Report and Data Outputs
- Monthly task and worker summaries.
- Payment calculation records and recommendations.
- PDF and Excel report-generation support.

## User Roles

| Role | Main Responsibilities |
|---|---|
| **GAA** (General Administrative Assistant) | Manage users, locations, cleaning tasks, assignments, and operational records. |
| **Evaluating Officer** | Monitor assigned locations and record daily cleaning quality evaluations. |
| **PHI** | Monitor authorized locations and record worker attendance evaluations. |
| **Administration Officer** | Review monthly reports, request corrections, and prepare payment recommendations. |
| **Vice Chancellor** | Review and make final decisions on payment recommendations. |

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend and application framework | Next.js 16, React 19 |
| Programming language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Supabase) |
| ORM and database access | Prisma 7 |
| Authentication | Supabase Auth |
| PDF generation | PDFKit |
| Excel generation | ExcelJS |
| Testing | Vitest |
| Code quality | ESLint |
| Deployment | Vercel |

## Application Workflow

1. **Setup and assignment:** GAA manages users, university locations, cleaning tasks, and staff assignments.
2. **Daily monitoring:** Evaluating Officers record cleaning evaluations, while PHI inspectors record worker attendance for their assigned locations.
3. **Monthly reporting:** The system consolidates daily records into monthly location reports and performance summaries.
4. **Administrative review:** Administration Officers review reports, request corrections when necessary, and prepare payment recommendations.
5. **Final approval:** The Vice Chancellor reviews payment recommendations and records the final decision.
6. **Traceability:** Activity logs and notifications help track important actions and workflow updates.

## Project Structure

```text
uni_cleaning-system/
├── app/                    # Next.js application pages and API routes
├── lib/                    # Authentication, business logic, and integrations
├── prisma/                 # Prisma schema, migrations, and seed scripts
├── public/                 # Static assets
├── tests/                  # Vitest test suites
├── .agents/                # Project agent skills
├── package.json            # Dependencies and npm scripts
├── prisma.config.ts        # Prisma configuration
├── vitest.config.cjs        # Vitest configuration
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (compatible with the installed Next.js version)
- npm
- A Supabase project with a PostgreSQL database
- Supabase project API credentials

### 1. Clone the repository

```bash
git clone https://github.com/senath6932/uni_cleaning-system.git
cd uni_cleaning-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root and add the credentials for your own Supabase project:

```env
DATABASE_URL="your-supabase-pooled-database-url"
DIRECT_URL="your-supabase-direct-database-url"

NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"

SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

Keep all real credentials private. Never commit `.env` files or expose the Supabase service-role key in client-side code or public repositories.

### 4. Prepare the database

Configure the database connection values for your Supabase PostgreSQL project. Apply the Prisma migrations and generate the Prisma Client:

```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The root page redirects to the dashboard. Sign in through the login page using an account configured for your Supabase project.

## Authentication and Initial Users

The project includes a login setup guide and supports Supabase authentication. The repository's setup guide describes an initialization page for creating test users and a signup endpoint.

For local setup, follow [`LOGIN_SETUP_GUIDE.md`](./LOGIN_SETUP_GUIDE.md). Use your own Supabase project credentials. The service-role key is highly sensitive and must never be shared or committed.

Do not rely on sample credentials in documentation for a production deployment. Create and manage secure accounts for your own environment.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Generate the Prisma Client and build the application. |
| `npm run start` | Start the production server. |
| `npm run lint` | Run ESLint. |
| `npm run test` | Run the Vitest test suite. |
| `npm run seed` | Run the Prisma seed script. |

## Testing

The project uses Vitest for unit testing. The test suites cover user management, location management, cleaning task management, location-task assignments, evaluating officer assignments and monitoring, PHI attendance monitoring, and role-based task authorization.

Run the tests with:

```bash
npm run test
```

## Deployment

The project is configured with a live Vercel deployment:

[https://uni-cleaning-system.vercel.app/](https://uni-cleaning-system.vercel.app/)

To deploy your own instance, connect the repository to Vercel and configure the required environment variables and Supabase database settings in the deployment environment.

## Documentation

- [`PROJECT_BUILD_SUMMARY.md`](./PROJECT_BUILD_SUMMARY.md) – project modules, features, roles, API routes, and technical details.
- [`LOGIN_SETUP_GUIDE.md`](./LOGIN_SETUP_GUIDE.md) – authentication and initial user setup instructions.

---

<div align="center">

**University Cleaning Management System**

Built to support structured, transparent, and accountable university cleaning operations.

</div>
