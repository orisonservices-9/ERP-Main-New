# API Reference — Orison School Management

Base URL: `${REACT_APP_BACKEND_URL}/api`
All routes (except `POST /api/auth/login` and `GET /api/`) require a Bearer JWT:

```
Authorization: Bearer <token>
```

The token is obtained from `POST /api/auth/login` and expires after 7 days.

---

## Auth

### POST /api/auth/login
Role-based demo login (no password).
```json
Request:  { "role": "admin" | "principal" | "fee_manager" }
Response: { "token": "<jwt>", "role": "admin", "name": "Admin", "menu": null | [ "dashboard", ... ] }
```
`menu = null` means all modules (admin). Otherwise it is the list of allowed module keys.

### GET /api/auth/me
Returns `{ role, name, menu }` for the current token.

---

## Students

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/api/students` | List all students |
| GET    | `/api/students/{id}` | Single student |
| POST   | `/api/students` | Create. **422** if a required field is missing; **409** if `admission_no` already exists |
| PUT    | `/api/students/{id}` | Update (upsert) |
| DELETE | `/api/students/{id}` | Delete student **and** cascade-delete its fee record |
| GET    | `/api/students/{id}/detail` | Aggregated profile: student, fees, marks, GPA, standing, attendance |

**Required fields on create:** `name`, `admission_no`, `class_name`, `section`,
`academic_year`, `gender`, `father_name`, `mobile`.

Creating a student auto-creates an associated fee record (total 45000, due 45000, Overdue)
and emits a notification event.

### Bulk import
| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/students-template` | Downloads a CSV template with headers + a sample row |
| POST | `/api/students/bulk` | multipart `file` (CSV). Skips rows with missing mandatory fields **or duplicate admission numbers**; returns `{ inserted, errors: [{row, error}] }` |

---

## Fees

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/fees` | List fee records |
| GET  | `/api/fees/summary` | `{ collected, pending, total, invoices }` |
| POST | `/api/fees/{id}/pay` | Body `{ method, amount? }`. Supports **partial** payments; if `amount` omitted, pays full due. Updates status to Paid/Partial and syncs student balance |

---

## Exams

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/exams` | List exams |
| POST | `/api/exams` | Create exam |
| PUT  | `/api/exams/{id}` | Update exam |

## Marks & Results

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/marks` | Save a marks set (rows of written/practical; total computed) |
| GET  | `/api/results` | Latest marks set ranked, with class average / highest / pass rate |

## Leaves

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/leaves` | List leave requests |
| GET  | `/api/leaves/summary` | `{ total, approved, rejected, pending }` |
| POST | `/api/leaves` | Create a leave request |
| PUT  | `/api/leaves/{id}/status?status=Approved` | Approve/Reject/etc. |

## Teachers

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/teachers` | List teachers |

---

## Search

### GET /api/search?q=<term>
Global search across students, teachers, and derived class names.
Returns `{ students: [...], teachers: [...], classes: [...] }`.

---

## Analytics (dashboards)

| Method | Path | Used by |
|--------|------|---------|
| GET | `/api/analytics/dashboard` | Admin dashboard — `stats.students / fees_collected / attendance / teachers`, attendance & fee trends |
| GET | `/api/analytics/fee` | Fee Manager dashboard — collected/pending/total/invoices, monthly, method split, top dues |
| GET | `/api/analytics/academic` | Principal dashboard — pass rate, class avg, attendance, subject scores, top performers |
| GET | `/api/analytics/ai` | AI Analytics module — KPIs, performance trend, subject scores, risk distribution |

> NOTE: `attendance` figures and several trend arrays are currently **seeded/derived
> demo values**, not real per-day attendance. See `KNOWN_ISSUES.md`.

---

## Notifications

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/notifications` | Recent events + derived overdue-fee alerts, with relative timestamps |
| POST | `/api/notifications/read-all` | Marks all events read |

---

## Role-based access

Menu keys per role are defined in `server.py` → `ROLE_CONFIG`. The **frontend**
additionally guards routes: visiting a route outside the current role's menu renders
an "Access Denied" page. The **backend** endpoints themselves are currently not
per-role restricted (any authenticated role may call any data endpoint) — see
`KNOWN_ISSUES.md` if you need endpoint-level RBAC.
