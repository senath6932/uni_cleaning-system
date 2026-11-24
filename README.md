<div align="center">

# 🏫 University Cleaning Management System

### A Role-Based Web Application for Managing University Cleaning Operations

A centralized platform for managing cleaning locations, daily evaluations, worker attendance, monthly performance reports, and payment approvals.

[![Next.js](https://img.shields.io/badge/Next.js-16.3.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.9.1-2D3748?logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_&_Auth-3ECF8E?logo=supabase)](https://supabase.com/)

**🌐 Live Application:** [uni-cleaning-system.vercel.app](https://uni-cleaning-system.vercel.app/)

</div>

---

## 📖 Table of Contents

1. [Overview](#-overview)
2. [Features](#-features)
3. [Built With](#-built-with)
4. [Installation & Setup](#-installation--setup)
5. [UI Screenshots](#-ui-screenshots)
6. [Database Design](#-database-design)
7. [Testing](#-testing)
8. [Future Enhancements](#-future-enhancements)
9. [License](#-license)

---

## 📖 Overview

The **University Cleaning Management System** is a web-based application developed to digitize and streamline cleaning operations within a university environment.

The system provides a centralized platform to manage university cleaning locations, cleaning tasks, staff assignments, daily cleaning evaluations, and worker attendance. It also supports monthly performance reporting and a structured payment approval workflow.

The application provides dedicated access for five user roles: General Administrative Assistant (GAA), Evaluating Officer, PHI, Administration Officer, and Vice Chancellor. Each role is provided with functions relevant to its responsibilities, helping maintain an organized and traceable cleaning management process.

---

## ✨ Features

### 🔑 User & Role Management

- User authentication using Supabase Auth.
- Five role-based user categories.
- Create and manage user accounts.
- Assign and update user roles.
- Activate or deactivate user accounts.
- Role-based access control for application functions.

### 🏢 Location & Cleaning Task Management

- Create and manage university cleaning locations.
- Set minimum worker requirements for locations.
- Define cleaning tasks with daily, weekly, and monthly frequencies.
- Assign cleaning tasks to specific locations.
- Configure allocated amounts for location-task assignments.
- Add additional cleaning tasks when required.
- Manage cleaning worker and officer assignments.

### 🧹 Daily Cleaning Evaluation

- Record daily cleaning quality evaluations.
- Evaluation results: Pass, Fail, and Not Applicable.
- Add remarks and feedback to evaluations.
- Support multiple task occurrences within a day.
- View evaluation history for assigned locations.
- Finalize and lock evaluation records.

### 👷 Worker Attendance Monitoring

- Record worker attendance as Present or Absent.
- Add attendance remarks.
- Monitor attendance at authorized locations.
- Maintain daily attendance records and history.
- Finalize and lock attendance records.
- Aggregate attendance information for monthly reports.

### 📊 Monthly Reports & Performance Analysis

- Generate monthly evaluation reports for each location.
- Summarize daily cleaning evaluation results.
- Calculate expected, passed, failed, and not-applicable occurrences.
- Calculate task completion percentages.
- Generate worker attendance summaries.
- Calculate allocated and recommended payment amounts.

### 💳 Payment Recommendation & Approval

- Review monthly reports through the Administration Officer dashboard.
- Approve, reject, or request corrections to reports.
- Generate payment recommendations based on performance.
- Modify payment calculations with recorded reasons.
- Submit payment recommendations for final review.
- Allow the Vice Chancellor to approve, reject, or request clarification.
- Maintain approval history.

### 🔔 Notifications & Activity History

- Generate notifications for report submissions and approval events.
- Notify users about approval, rejection, correction, and clarification requests.
- Track notification read status.
- Maintain activity logs for important system operations.
- Record timestamps and relevant changes for audit purposes.

---

## 🛠 Built With

The project is developed using the following technologies:

| Technology | Purpose |
|---|---|
| **Next.js 16.3.1** | Full-stack web application framework |
| **React 19** | Building the user interface |
| **TypeScript 5** | Application development with static typing |
| **Tailwind CSS 4** | UI styling |
| **Supabase Auth** | User authentication and session management |
| **PostgreSQL (Supabase)** | Relational database |
| **Prisma ORM 7.9.1** | Database access and schema management |
| **PDFKit** | PDF report generation |
| **ExcelJS** | Excel report generation |
| **Vitest 4.1.10** | Automated testing |
| **ESLint 9** | Code quality and linting |
| **Vercel** | Application deployment |

---

## ⚙️ Installation & Setup

Follow these steps to run the project locally.

### 1. Clone the Repository

```bash
git clone https://github.com/senath6932/uni_cleaning-system.git
cd uni_cleaning-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up the Database

Apply the existing Prisma migrations and generate the Prisma Client:

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Start the Development Server

```bash
npm run dev
```

### 5. Open the Application

Open the following address in your browser:

```text
http://localhost:3000
```

For authentication and initial account setup instructions, refer to [`LOGIN_SETUP_GUIDE.md`](./LOGIN_SETUP_GUIDE.md).

### Available Commands

```bash
npm run dev       # Start the development server
npm run build     # Generate Prisma Client and build the application
npm run start     # Start the production server
npm run lint      # Run ESLint
npm run test      # Run Vitest tests
npm run seed      # Run the Prisma seed script
```

---

## 📊 Database Design

The system uses **PostgreSQL** hosted through Supabase, with **Prisma ORM** for database schema management and data access.

The database is organized around the following main entities:

| Entity | Description |
|---|---|
| **User** | Stores user details, roles, and account status. |
| **Location** | Stores university cleaning location information and minimum worker requirements. |
| **CleaningTask** | Defines cleaning task categories and frequencies. |
| **LocationTask** | Connects cleaning tasks to locations and stores allocated amounts. |
| **CleaningWorker** | Stores cleaning worker information. |
| **WorkerLocationAssignment** | Connects workers with assigned locations and allocated payment amounts. |
| **EvaluatingOfficerAssignment** | Assigns evaluating officers to locations. |
| **PHIAssignment** | Defines the locations monitored by PHI users. |
| **DailyCleaningEvaluation** | Stores daily task evaluation results and remarks. |
| **WorkerAttendance** | Stores worker attendance records. |
| **DailyAttendanceEvaluation** | Stores daily attendance evaluation information. |
| **MonthlyEvaluationReport** | Stores monthly reports and their workflow status. |
| **MonthlyTaskSummary** | Stores task-level performance and payment summaries. |
| **MonthlyWorkerSummary** | Stores worker-level attendance and payment summaries. |
| **PaymentRecommendation** | Stores payment recommendation information. |
| **AdministrationReview** | Stores Administration Officer review decisions and feedback. |
| **VCApproval** | Stores Vice Chancellor approval decisions and feedback. |
| **ActivityLog** | Maintains a record of important system activities. |
| **Notification** | Stores user notifications and read status. |

### 📌 Report Approval Workflow

Monthly reports follow a defined status flow:

```text
DRAFT
  ↓
SUBMITTED
  ↓
ADMIN_APPROVED
  ↓
VC_APPROVED
```

The Administration Officer can approve, reject, or request corrections. The Vice Chancellor can approve, reject, or request clarification during the final review.

---

## 🧪 Testing

The project uses **Vitest** for automated unit testing.

The test suites cover the main business logic and application operations, including:

- User creation, updates, role changes, and activation.
- Location management and minimum worker requirements.
- Cleaning task management.
- Location-task assignments and allocated amounts.
- Evaluating officer assignments.
- Daily cleaning evaluation and monthly summary calculations.
- PHI attendance monitoring and monthly attendance summaries.
- Role-based task authorization.

Run the test suite using:

```bash
npm run test
```

---

## 🚀 Future Enhancements

Possible future improvements include:

- 📱 Develop a mobile-friendly companion application for field staff.
- 📈 Introduce more advanced dashboards and performance analytics.
- 📧 Add email notifications for important approval events.
- 📍 Explore location-based monitoring for cleaning operations.
- 📄 Improve report customization and export options.

---

## 📜 License

No license file is currently included in this repository. Please contact the repository owner for permission before using, modifying, or distributing this project.

---

<div align="center">

**University Cleaning Management System**

*Making university cleaning operations more organized, measurable, and accountable.*

</div>
