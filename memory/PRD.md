# Orison School Management — PRD

## Problem Statement
Pixel-perfect Figma clone of the Orison school management dashboard (24 sidebar modules),
backed by a live FastAPI + MongoDB API with persistent data, role-based access, global
search, partial fee collection, and live analytics.

## Stack
- Frontend: React, TailwindCSS, React-Router-DOM, Recharts, Axios. `/app/frontend/src`
- Backend: FastAPI + Motor (MongoDB) + PyJWT. Monolith at `/app/backend/server.py`
- Auth: role-based login (Admin / Principal / Fee Manager) via `POST /api/auth/login {role}` -> JWT.
  Credentials/roles documented in `/app/memory/test_credentials.md`.

## Roles (ROLE_CONFIG in server.py)
- admin: all modules (menu = null)
- principal: academics, exams, marks, attendance, leave, teachers, staff, homework, timetable, etc. (no fee/expenses/inventory/hr/biometric/multibranch)
- fee_manager: dashboard, student, fee, expenses, notifications, communications, ai, settings

## Implemented (as of 2026-06)
- 24 sidebar modules, role-tailored dashboards (Admin/Principal/Fee Manager)
- Student CRUD, profile syncing (fees/marks/attendance), global search, CSV export/print
- Partial fee collection with manual amount entry
- **[This fork, 2026-06]** Production-blocker batch fixes — all verified by testing_agent (100%):
  - Add Student form: inline field-level validation (NO window.alert), required fields enforced,
    duplicate admission inline error, success redirects to student profile.
  - Backend POST /api/students: 422 on missing required fields, 409 on duplicate admission_no.
    Bulk CSV upload skips duplicate admission numbers.
  - Sidebar typo fixed ("Promote Student"); submenu auto-opens/stays active on navigation.
  - Dashboards: proper loading skeletons + error state with retry + empty states (no "—" placeholders).
  - Role-based route protection: direct-URL access to out-of-menu routes shows Access Denied page.
  - Minor: Fee Manager greeting now shows full role name; delete_student cascades fee deletion.

## Key files
- `server.py` — all API + seeding. create_student (validation/dedup), delete_student (cascade), analytics/*
- `src/App.js` — routing + Protected(requiredKey) role guard + AccessDenied
- `src/pages/AddStudent.jsx` — inline validation form
- `src/pages/Dashboard.jsx` — useAnalytics hook, loading/error/empty states
- `src/components/Sidebar.jsx` — submenu open sync
- `src/mock.js` — NAV_ITEMS

## Backlog / Future (P1/P2)
- P1: Final UI polish vs original Figma constraints.
- P2: Split server.py into route modules (students/fees/analytics).
- P2: Tighten CORS origins for production (currently allow_origins=['*'] with credentials).
- P2: Wire remaining module screens (inventory/hr/biometric/multibranch) to real backend data.

## Testing
- Backend pytest suite: `/app/backend/tests/backend_test.py` (10 tests). Report: `/app/test_reports/iteration_1.json`.
