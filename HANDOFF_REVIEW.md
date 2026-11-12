# Orison ERP — Pre-handoff review (12 Nov 2026)

Scope: static review of `backend/server.py` (7,474 lines, ~215 routes), the frontend (`frontend/src`), config, docs and tests, plus two live checks against the running local servers. The backend test suite was **not** run, because it writes to the live database (see section 5).

Severity: **BLOCKER** = do not put real school/parent data online until fixed. **HIGH** = fix before launch. **MEDIUM** = fix soon. **LOW** = cleanup.

---

## 1. Security — BLOCKERS

### B1. Staff login has no password check (verified live)
`POST /api/auth/login` (`server.py:651`) only reads `role` from the request. `LoginReq` accepts `username` and `password`, but the handler never uses them. Verified: `curl -X POST /api/auth/login -d '{"role":"admin"}'` returns a valid admin token.
- The login screen shows an email + password form, so it looks secured, but it is not.
- `hash_password` / `password_matches` exist (`server.py:537-548`) but nothing calls them. There is no users/accounts collection.
- Fix: create a staff user collection (email, role, branch_ids, password hash, active flag). Login should verify the password, rate-limit attempts, and issue the token. Add forgot/reset password, change password and (ideally) 2FA for Admin/Director/Fee Manager.

### B2. Staff mobile OTP login is faked in the browser
`Login.jsx:75-84`: the OTP is generated and checked in the browser, and the code is printed on screen ("Test code: …"). No SMS is sent and the server does not verify it. Needs a real server-side OTP and SMS gateway (the parent flow already has the server-side logic to copy).

### B3. Parent OTP can leak
`PARENT_OTP_DEBUG=true` returns the OTP in the API response. It must be off in production (the README's `.env` template tells people to turn it on). No SMS provider is wired up: the OTP is only written to a `parent_notifications` queue with status "Queued", so real parents currently cannot receive a code.
- Parent OTP is 4 digits, so brute force is plausible. Attempts are capped at 5 per OTP, but a new OTP can be requested without limit. Add per-mobile and per-IP rate limits, and make the OTP 6 digits.

### B4. Role checks are missing or inconsistent on many endpoints
`KNOWN_ISSUES.md` still says the backend does not enforce roles. Many routes do now use `require_roles`, but my scan found about 66 staff routes with no `require_roles` call (the scan is approximate; some may check roles another way). Examples: `POST /students`, `PUT /students/{id}`, `POST /students/bulk`, `DELETE /exams`, `PUT /leaves/{id}/status`, `POST /branches`, `PUT /branches/{id}`, `PUT /branch-access-assignments/{role}`, `POST /academic-year-change-request`, `POST /student-promotion-request`, `DELETE /teacher-allocations/{id}`.
- Impact: any logged-in role (for example Librarian) could create branches, change branch access or promote students.
- Fix: audit every route and add an explicit allowed-roles check; add a test that loops over all routes and asserts a wrong role gets 403.

### B5. Uploaded files are public
`app.mount('/uploads', StaticFiles(...))` (`server.py:56`) serves homework, leave, admission, student-document and parent files with no login and no folder-level protection. File names include student documents (admission papers, certificates, payment proofs). Serve these through an authenticated endpoint or signed URLs.
- Stored URLs are hard-coded as `http://localhost:8001/uploads/...` (`server.py:1531, 1555, 4777, 6871`). They will break on any deployed server. Store relative paths and build the URL from a `PUBLIC_BASE_URL` setting.
- Add size limits and content-type checks consistently (some uploads validate extensions, some do not).

### B6. Secrets and config
- `backend/.env`: `JWT_SECRET` is a `dev-…` value and `CORS_ORIGINS=*`. The code reads `ALLOWED_ORIGINS`, not `CORS_ORIGINS`, so that line does nothing; CORS currently falls back to localhost only. Docs and `.env` disagree.
- The production guard (`APP_ENV=production` plus a 32+ character secret) is good, but `APP_ENV` is not set anywhere, so the guard is off by default.
- There is no `.env.example` in either folder, although the README tells people to `cp .env.example .env`.
- Tokens live in `localStorage` (XSS-readable) and last 12 hours with no refresh or server-side logout. Acceptable for an internal tool once B1 is fixed, but note it.

---

## 2. Payments and money — HIGH

- **Razorpay has no webhook.** The payment is only recorded when the parent's browser calls `/parent/payments/orders/{id}/verify`. If the parent pays and closes the tab, or the network drops, the school is paid but the fee stays unpaid. Add a `payment.captured` webhook endpoint (verify `X-Razorpay-Signature`) as the source of truth.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are not in `.env` or documented; the endpoint returns 503 until set. `TRANSPORT_TRACKER_KEY` is the same.
- `pay_fee` is called as `fee_manager` for gateway payments. It has no idempotency key, so a double click or a retry can record the same payment twice; concurrent payments on one fee are untested (listed in KNOWN_ISSUES).
- Fee reversal exists, but there is no refund flow to the gateway, no GST/receipt numbering rules, no PDF receipt download for staff (check), and no day-end cash closing / bank reconciliation beyond `/fees/reconciliation`.
- Late-fee / fine rules, sibling discounts, scholarships/concessions and fee-head wise reports: confirm with the school whether these are required; I did not find them.

---

## 3. Features that look finished but are not connected

| Area | State |
|---|---|
| SMS / WhatsApp / email / push | **Nothing is actually sent.** Everything is written to queue collections with status "Queued" (no SMTP, Twilio, MSG91, WhatsApp API or FCM code). Absence alerts, fee reminders, homework notices, visitor alerts and OTPs all depend on this. |
| Library, Hostel, Certificates, ID cards, Compliance (APAAR/UDISE+), Consents, Events, Surveys | Saved **in the browser only** (`useLocalRecords` in `pages/modules/SchoolServices.jsx`). Data is per device, lost when the browser data is cleared, not shared between staff, and not in backups. Needs backend collections and APIs. |
| HR, Biometric, Comms (conversations), Exams results grid, Academics2 (question bank), Facilities (visitors list), PeopleMgmt | Still import sample data from `mock.js` / `mock2.js`. Verify each screen reads real data before the school uses it. (The payroll API exists at `/hr/*`, but `HR.jsx` imports `PAYROLL` / `BIOMETRIC` mock data.) |
| Attendance analytics | Parts are derived or seeded, not real per-day data (KNOWN_ISSUES). |
| Inventory, Multi-branch, Transport | Backend exists; confirm each screen is wired end to end. |
| Parent mobile app | Only the API exists (`/parent/*`). There is no parent web or mobile client in this repo. |
| Language | Only menus/dialogs are translated (English/Telugu/Hindi); page content is English. |
| Transport tracker | Webhook exists; the GPS partner is not configured. |

---

## 4. Data, performance and reliability — MEDIUM

- **Indexes:** only about 12 are created (`ensure_indexes`). Missing: `students.admission_no` (unique, per branch), `students.branch_id`, `fees.student_id`, `fee_receipts.student_id/branch_id`, `attendance` (student, date), `marks_sets`, `leaves`, `visitors`. Queries will slow down as data grows.
- **Hard caps:** about 115 queries use `to_list(1000)` / `5000` / `100`. `GET /students` returns at most 1000 students with no pagination, so a school with more than 1000 students will silently lose records in lists, search and exports. Add pagination or raise the caps with server-side paging.
- **No transactions:** bulk CSV import, promotions, and fee payment + receipt + student balance updates are multi-step writes without a transaction (needs a MongoDB replica set), so a failure midway leaves inconsistent data.
- **Demo data seeding:** on an empty database the app inserts demo students/fees/teachers/marks/events. `seed()` also deletes demo exams/leaves on every start. For a real school, set the "demo data removed" flag (or remove seeding) so a fresh deploy does not show Rohan/Ananya/Diya. The showcase parent mobile `9876543210` is also hard-wired in `seed()`.
- **No backups:** no `mongodump` schedule documented; uploads live on local disk (not on the database backup path).
- **Audit trail:** many actions record `by`/`at` fields, but there is no immutable audit log collection for deletes/fee edits, and deletes are permanent (no soft-delete).
- **Rate limiting, request size limits, security headers (HSTS, CSP):** none in the app; handle at the reverse proxy or add middleware.
- **Single 7,474-line `server.py`** with no module split; hard to review and test. Planned P2 in the PRD.
- **Python 3.9** in `.venv` (README says 3.11+); `fastapi==0.110.1`, `uvicorn==0.25.0`, `motor==3.3.1` are pinned old versions. Check `pip-audit` / `npm audit` before launch.
- Health check endpoint for the load balancer: only `GET /api/` (check it also pings MongoDB).

---

## 5. Testing — HIGH

- Backend tests: 9 + 4 test functions in `backend/tests`, plus two large scripts at the repo root (`backend_test.py`, `backend_test_new_endpoints.py`, 32+ tests). Several tests log in with `{role}` only and point at the live server, so **running them against a real database creates and modifies real records**. Use a separate `DB_NAME` for tests.
- One test file reads `/app/frontend/.env` (an Emergent container path) and will fail on this machine unless `REACT_APP_BACKEND_URL` is exported.
- Frontend: no unit or end-to-end tests.
- Nothing covers the new login, the 7 roles, the branch boundary middleware, parent ownership checks or payment verification. Parent isolation (`owned_student`) looks correct in code; add tests to prove it.
- `npx craco build` passes, with lint warnings in `AcademicsTab.jsx`.

---

## 6. Repo hygiene and handoff package — MEDIUM

- Remove or move out of the repo: `_claude_backup_2026-11-11/` (180 MB of `.tgz` backups and old copies), the whole `handoff/` folder (a stale older copy of backend/frontend/docs), `test_result.md`, `test_reports/`, `verify_balance_sync.py`, root-level `backend_test*.py`, and the `.emergent/` folder (Emergent cron/webhook scripts you don't need).
- `backend/reset_school_data.py` and `keep_class_one_only.py` **permanently delete data** and are run by hand. Move them into a `scripts/` folder with a warning and a confirmation prompt; the developer must not run them on production.
- Git: only 2 commits (`first commit`, `Landing Page`) and **about 100 modified files uncommitted**, including all of the work from 11-12 Nov. Commit this state before handing over, ideally on a tagged branch, so the developer can see the diff. `frontend/build/` is gitignored but stale.
- `README.md` says `yarn` and Python 3.11, but the repo has `package-lock.json` only (npm). `KNOWN_ISSUES.md` is dated 2026-06 and contradicts the code (RBAC, HR payroll now exist). `docs/API.md` and `docs/DATABASE.md` predate most endpoints (parent center, admissions, branches, transport, collections intelligence). Update them or the developer will rely on wrong docs.
- Docker / docker-compose, a CI pipeline, a process manager (systemd/pm2) and an nginx example are missing. `docs/DEPLOYMENT.md` should say how to run uvicorn behind HTTPS.
- No licence file, no `CODEOWNERS`, no changelog beyond `CHANGES_2026-11-11.md`.

---

## 7. Product gaps worth confirming with the school

These are common in an Indian school ERP and I did not find them in the code; confirm which are in scope:
- Staff accounts and user management UI (create staff login, reset password, deactivate) — needed together with B1.
- Student admission → fee → class allocation flow is present; **online admission form** for parents and an **online fee receipt** (PDF) for parents: check.
- Transport fee, hostel fee and library fine linking into the fee ledger.
- Timetable auto-generation / clash check, attendance by period, biometric device integration (screen exists, backend does not).
- Report card templates per board (CBSE/State), grade rules, promotion rules, TC numbering rules.
- Data export / import for the whole school (backup, migration), and DPDP Act compliance items: consent records, data retention and deletion policy, privacy policy page, Aadhaar handling (`aadhaar_consent` is stored; confirm the number itself is not stored in plain text).
- Mobile-friendly parent portal or app; Director/KDM approval app (approvals currently depend on an OTP shown in a "Director App" that does not exist in this repo).
- Monitoring: error tracking (Sentry), uptime check, log retention.

---

## 8. Suggested order for the developer

1. Real authentication (B1, B2), user management, forgot/reset password.
2. Backend role audit on all routes (B4) with an automated test.
3. Protect uploads and remove hard-coded `localhost` URLs (B5); `.env.example`, production `JWT_SECRET`, `APP_ENV=production`, CORS (B6); turn off `PARENT_OTP_DEBUG`.
4. SMS/WhatsApp/email provider integration (B3 and section 3).
5. Razorpay webhook and payment idempotency (section 2).
6. Move browser-only modules and mock-data screens to the database (section 3).
7. Indexes, pagination, backups, tests on a separate test database, CI, Docker (sections 4-5).
8. Clean the repo and update the docs (section 6) — this can be done first, in an hour.
