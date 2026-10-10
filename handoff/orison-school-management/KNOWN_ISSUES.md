# Known Issues — Orison School Management

Last reviewed: 2026-06. Status reflects the **code in this package** (verified against a
fresh browser session on the preview build). Where the user reported a problem on the
**live/production** site, note that production was serving a **stale build**; the fix is
present in this code and simply needs to be (re)deployed.

---

## Reported on the live site — FIXED in this codebase, pending (re)deploy

These four items were reported as broken on the deployed app. They were reproduced
**only** on the stale production build; in the current source they are fixed and verified.
Re-deploying this code resolves them.

1. **Exams Management routing** — Sidebar → Exams navigates to real pages
   (`/exams/create`, `/exams/view`) rendering their own content. (Fixed)
2. **Marks Management routing** — `/marks/add`, `/marks/results`, `/marks/report-card`
   each render their own page. (Fixed)
3. **Leave Management routing** — `/leave/apply`, `/leave/requests`, `/leave/reports`
   each render their own page. Navigation no longer stays on Dashboard. (Fixed)
4. **Missing dashboard KPIs** — Admin dashboard shows Total Students, Fees Collected,
   Attendance Today, Active Teachers with persisted values plus loading/error states
   (no blank content). Fee Manager and Principal dashboards likewise. (Fixed)

> ⚠️ If you observe any of the above on a hosted instance, you are almost certainly
> running an **older build**. Rebuild the frontend and redeploy both services.

---

## Genuinely unverified / partially mocked flows — require QA before production

These have working "happy paths" in code but have **not been fully end-to-end verified**,
and some rely on seeded/demo data. Treat as needing hardening + test coverage.

1. **Payment / fee collection (`POST /api/fees/{id}/pay`)**
   - Partial and full payments update `paid`/`due`/`status` and sync student balance.
   - NOT verified: idempotency, concurrent payments on the same fee, negative/over-payment
     edge cases beyond the basic clamp, and receipt generation (no receipts exist yet).
   - Payment **method** is stored as a free string; there is **no real payment gateway**
     integration — collection is recorded, not actually charged.

2. **Payroll / HR (`/hr-payroll` module)**
   - UI screen only; **not backed by real endpoints or persisted data** (mocked/demo).

3. **CSV import (`POST /api/students/bulk`)**
   - Validates mandatory fields and skips duplicate admission numbers, returning a
     per-row error list.
   - NOT verified: very large files, encoding edge cases, malformed CSVs, and partial
     failure rollback (there is no transaction — inserted rows persist even if later rows fail).

4. **Delete flows (`DELETE /api/students/{id}`)**
   - Deletes the student and cascade-deletes its fee record.
   - NOT verified: cascading of related `marks_sets` rows and `events` (these are matched
     by name, not student id, so historical marks/notifications may remain).
   - No soft-delete / audit trail; deletes are permanent.

---

## Other notes / limitations

- **Demo authentication:** login is role-only (Admin/Principal/Fee Manager) with **no
  password**. JWT is issued per role. Replace with real auth before production.
- **Backend RBAC:** role menus are enforced in the **frontend** (Access Denied page for
  out-of-menu routes). Backend data endpoints authenticate the token but do **not**
  restrict by role — any authenticated role can call any endpoint. Add endpoint-level
  authorization if true RBAC is required.
- **Attendance analytics are seeded/derived**, not real per-day attendance. The
  "Attendance Today" KPI and several trend charts use demo values.
- **`admission_no` uniqueness** is enforced only in application code; add a MongoDB
  unique index (see `docs/DATABASE.md`) to be safe under concurrency.
- **CORS** is `*` with credentials in dev; tighten `CORS_ORIGINS` for production.
- **Some sidebar modules** (e.g. Inventory, Biometric, Multi-Branch, Visitor) are UI
  scaffolds with limited or no backend persistence.
