# Orison School ERP — Developer roadmap (multi-school SaaS)

Read `HANDOFF_REVIEW.md` first (security findings and gaps). This file is the order of work.
Source documents (business team, 12 Nov 2026): *Orison_ERP_Plans_Feature_Split.pdf* and *Orison_ERP_WhatsApp_Integration_Map.pdf*. If this file and those PDFs disagree, the PDFs win; tell the business team.

## 1. How the business works

- **One shared server for all schools.** Each school buys a plan; features and limits differ per agreement.
- Clients: the web ERP (this repo) and three Flutter apps: **parent**, **teacher**, **director**.
- Today the code is built for **one school** (it has branches, but no school/tenant concept). Making it multi-school is step 0.
- **No amount is hard-coded.** Prices, minimum fees, setup fee, message limits and overage rates are all settings the business team edits.

## 2. Plans (final split, from the owner's handwritten notes of 12 Nov 2026)

These notes **replace** the plan split in the earlier PDF (for example, Fee Manager is no longer an Essential login, and Collection Intelligence is now in Essential). Each plan includes everything in the plan before it. ★ = not built yet. The same lists are in `FEATURE_CATALOG` and `PLAN_LOGINS` in `backend/platform_admin.py`, which is the one place to change them.

| | Essential | Pro | Premium |
|---|---|---|---|
| Logins | Admin, Academic Coordinator, Class Teacher (that is all) | + Fee Manager, Director | + Stock Manager, Librarian (all 7) |
| Apps | Parent app, Teacher app | + Director app | all |
| WhatsApp messages | 10 / student / month | 20 | 30 |

**Essential (27 features):** Dashboard; Student management (add, view, promote, profile; **no transfer of students**); Admission management; Academic management (setup, Action Center, syllabus, student health, support plans, classroom observations); Attendance; Teachers; Staff directory; Fee management and Fee Control Center; Collection Intelligence; Exams; Marks and report cards; Homework; Hall tickets; Leave management; Timetables; Notices and notifications; Communications; Settings; Parent app; Teacher app.

**Pro adds (4):** Transport; Visitor management; Parent App Center; Director app. (Settings is also listed under Pro in the notes; it is already in Essential.)

**Premium adds (20), "Pro and all the rest":** Transfer students (TC and branch transfer); Question bank; Online fee payment link ★; Expenses; HR and payroll; Purchase and stock; Library; Certificates; ID cards; Consent forms; Compliance (APAAR, PEN, UDISE+); Multi-branch; Management Action Center; Automatic fee-reminder schedule ★; Advanced reports and Tally export ★; School logo and letterhead ★; Hostel; Events and photo gallery; Surveys; Biometric attendance.

**To confirm with the owner:** the notes do not say which plan has *Transfer students*, *Question bank* or the *Management Action Center*; they are placed in Premium because they are not listed under Essential or Pro. Move them in `FEATURE_CATALOG` if that is wrong. Because Essential has no Fee Manager login, an Essential school cannot keep fees away from its Admin; the system refuses that change (they need Pro).

### Feature keys
The server blocks a disabled feature with 403; menus and the Flutter apps hide it. Keys are the first value of each row in `FEATURE_CATALOG`.

## 3. Billing and plan controls to build

| Control | What to build |
|---|---|
| Plan per school | Plan and enabled keys on the school record. Upgrade or downgrade switches features immediately; **no data is deleted** (disabled data is hidden, not removed). |
| Per-student billing | Rate per student per year per plan (configurable). Snapshot of active student count at the start of the academic year. |
| Minimum yearly fee | Configurable per plan. Invoice = larger of (students × rate) and the minimum. |
| One-time setup fee | Configurable line on the first invoice, can be waived (waived by default on Premium). |
| WhatsApp limit | Per-school monthly counter against the plan limit. Alert the admin at 80% and 100%; then bill extra at a configurable rate or fall back to SMS. |
| Discounts | Configurable discount on a subscription (e.g. multi-year). |
| Logins per plan | Creating a user with a role outside the plan is refused. |

## 4. Order of work

### Phase 0 — Multi-school foundation (do first)
1. `schools` collection (id, code, name, status, plan, enabled keys, limits, contract dates, branding, WhatsApp sender settings).
2. Data isolation. Recommended: **one MongoDB database per school** (`orison_<code>`), chosen from the login token, so no query can cross schools. Keep `branch_id` for branches inside a school.
3. Token carries `school_id`, `user_id`, `role`, `branch_ids`. A forged `X-Branch-ID` must never reach another school.
4. **Platform admin** (Orison staff only, separate login): create/suspend schools, set plan, billing settings, extend contract, see usage and message counts. Full feature list in section 5.
5. Test: log in as school A, call every route with school B ids; expect 403/404.

### Phase 1 — Real accounts and login
1. Staff users per school (email, role, branches, password hash, active flag). `/auth/login` must verify the password (today it ignores it).
2. Forgot/reset/change password, lockout, optional 2FA for Admin, Director, Fee Manager. Fingerprint login in the app.
3. Server-side OTP for staff mobile login and for parents: 6 digits, rate limited per mobile and IP, sent as a WhatsApp **Authentication** template with SMS fallback.
4. Same auth for the three Flutter apps; refresh tokens; server-side logout.
5. Backend role check on every route (about 66 have none) plus a test that loops over all routes with a wrong role.

### Phase 2 — Plan enforcement
1. Return `features`, `limits` and `plan` at login and in `/auth/me`.
2. `require_feature('transport')` on each module's routes, next to the existing `require_roles`.
3. Web and Flutter hide disabled modules; direct links show an upgrade message.
4. Enforce limits (students, branches, logins per plan).

### Phase 3 — Notification service and WhatsApp (see WhatsApp map)
1. **One notification service**: event → template → recipients → send → store status. Every module calls it; replace the per-module "Queued" records.
2. Provider: a WhatsApp Business Solution Provider on Meta's Cloud API with pay-as-you-go pricing and delivery webhooks (Gupshup, AiSensy, MSG91 or Interakt). Business team picks one.
3. Templates: each message needs a Meta-approved template in English, Telugu and Hindi (sent in the parent's preferred language). **Submit templates early; approval takes days.**
4. SMS fallback through a DLT-registered route (DLT template registration is mandatory and slow).
5. Consent and opt-out (STOP) per parent and per message type; record opt-in at admission.
6. Delivery tracking (sent / delivered / read / failed) on the student timeline and in Notifications.
7. Quiet hours: no non-urgent messages between 9 pm and 7 am.
8. Monthly counter per school with the 80% / 100% alerts and overage handling.
9. Sender number decision: one Orison number for all schools (fast) or each school's own (Premium option).

**Messages by plan** (all Utility category, about ₹0.115–0.145 each, unless noted):
- **Essential:** login OTP (Authentication), absent alert, late alert, fee receipt, manual fee reminder, homework, notice/circular, exam schedule / hall ticket ready, results published, leave status, PTM invite.
- **Pro:** fee reminder with pay link, ★ online payment link, payment-promise follow-up, instalment due, admission enquiry follow-up, transport (bus started / near stop / delayed, needs GPS partner), visitor and gate pass, library overdue, consent request, certificate/ID card ready, stock issued, payslip, expense approval request.
- **Premium:** ★ automatic fee-reminder schedule, daily leadership summary, hostel events, staff late/absent (biometric), survey link, event invitation, admission campaign broadcast (**Marketing category, about ₹0.86–1.09 each, 7–8× Utility; bill separately**).
- Already in code: absence rule `attendance_absent`, `fee_due` rule, `pay_fee` queue record, homework `send_whatsapp` flag. They only create "Queued" records.

### Phase 4 — Payments
1. Per-school Razorpay (or similar) keys; **webhook** with signature check as the source of truth; idempotent payment recording; automatic matching to the student; refunds; receipt PDF and receipt message.
2. Payment links in fee reminders (needs step 1 first).
3. Tally export and advanced reports (Premium ★).

### Phase 5 — Files, devices, branding
Private object storage with signed links (remove the public `/uploads` mount and hard-coded `http://localhost:8001` URLs); transport GPS and biometric device webhooks per school; school logo and letterhead on receipts and in the parent app (★).

### Phase 6 — Flutter apps
1. Freeze the API contract (FastAPI produces OpenAPI) and generate a Dart client.
2. Parent app: OTP login, children, attendance, homework, notices, fees and receipts, payments, leave, hall tickets, transport, Telugu/Hindi/English.
3. Teacher app: attendance, homework, marks, timetable and substitutions, leaves.
4. Director app: leadership dashboards across branches, approvals (fee-edit, student-deletion and promotion OTPs), collections and attendance.

### Phase 7 — Move browser-only and mock modules to the database
Library, hostel, certificates, ID cards, compliance, consents, events and surveys (`pages/modules/SchoolServices.jsx`, `useLocalRecords`) need collections and APIs. HR/biometric, comms, question bank and parts of exams and facilities still import `mock.js` / `mock2.js`.

### Phase 8 — Run it for many schools
Indexes per database, pagination (lists stop at 1000), daily backup per school with a tested restore, hosting in India, error tracking, rate limiting, security headers, health check that pings MongoDB, staging and production, CI, Docker, dependency audits, split `server.py` into modules, audit log for deletes and fee edits, DPDP privacy policy and data retention.

## 5. Platform admin (Orison owner "super admin") — features

A separate app/login for Orison staff, above every school. It is not the school's own Admin. Build it in Phase 0 (minimum: items 1–3, 6) and grow it alongside the other phases.

**Status: first version built** on branch `feature/platform-super-admin`.
- Backend: `backend/platform_admin.py` (routes under `/api/platform/*`), own accounts, own token and own database (`PLATFORM_DB_NAME`, default `<DB_NAME>_platform`). Create the first Owner with `python create_platform_owner.py` (asks for the password at the prompt).
- Frontend: `frontend/src/platform/*`, opened at `/platform/login`.
- Done: items 1–4 and 6 (school records, plan and per-school feature switches, pricing settings, invoices with GST and a printable copy, usage vs WhatsApp limit, team roles, mandatory authenticator-app 2FA, lockout, audit log), plus dashboard (7).
- **Not connected yet (needs the Phase 0 multi-school login):** a Suspended/Expired status does not yet block that school's staff; "View as school" is a disabled button; feature switches and limits are stored but not yet enforced by the school app; last-login and WhatsApp counts are entered by hand until the sending service and tenant login report them.
- **Per-school logins and access** (school's "Logins & access" tab): a school gets only the logins it asked for (within its plan). Every login starts with its **standard features** (`ROLE_DEFAULT_FEATURES` in `platform_admin.py`, copied from the existing role menus in `ROLE_CONFIG` / `roleAccess.js`: Admin = everything in the plan; Fee Manager = fees, fee control, collections, expenses, payroll, notices; Director = reports and oversight; and so on). A school can add or remove single features for a login; **only those differences are stored** (`role_overrides`, plus `enabled_logins`), so changing a role's standard later updates every school that has not customised it. The API returns `logins`, `role_defaults` (standard, per plan login), `role_features` (what each enabled login may actually use) and `role_overrides`. **The school app must enforce `role_features` on the server (403) and in the menus**, instead of the fixed role menus; today the `admin` role opens everything. Note the standard list is feature-level, while the school app's role menus are screen-level (for example the Director only gets report screens), so the developer should map each feature to its screens. Also decide who may create or change logins inside a school: if the school Admin can add a Fee Manager login for themselves, the separation is pointless, so login creation should be limited to the Director or to Orison for such schools.
- **Usage and activity** (school's "Status & history" tab): sign-ins (who, when, web or which app), feature use per day, and app activations, with a date range and filters for app and login type. The school server reports to the platform through three small hooks in `server.py` (the `usage_tracking` middleware and `track_login` calls in the staff login and the parent OTP verify), implemented in `platform_admin.py` (`track_login`, `track_request`; API `GET /api/platform/schools/{id}/activity` and `/logins`). Data is stored in the platform database (`platform_logins`, `platform_usage_daily` counted per day, role, app and feature, `platform_app_users`). It records no student data and no phone numbers, and a tracking failure can never break a school request. **It is off until `PLATFORM_SCHOOL_CODE=<school code>` is set** on the school server (one deployment serves one school today). With the multi-school login (Phase 0) replace that setting with the school id from the token. Each Flutter app must send the header `X-Client: parent-app | teacher-app | director-app` on login and on every call; without it the activity is counted as "Web". Staff sign-ins are shown by role because staff have no individual accounts yet (Phase 1 adds names). **App Store and Google Play download counts cannot be read by the server**; "activated" (signed in at least once) is what is measured. Feature use is mapped from API path prefixes (`_FEATURE_PATHS`); add a line there whenever a new feature or route is added. Old rows are never deleted yet; add a retention rule (for example 2 years).
- **Help desk and the Developer login**: every login (the 7 school logins on the web, the teacher and director apps, and parents in the parent app), in **every plan**, can ask Orison for help or report an error. School web: **Help Desk** in the menu (`frontend/src/pages/SupportDesk.jsx`, designed like the parent app's help desk in `Mobile-App/lib/parent/help_desk`). Backend: `support_router` in `platform_admin.py` (`/api/support/*`, see `docs/API.md`). Tickets live in the platform database (`platform_tickets`) with school, reporter (staff login type, or parent name, student's class and a **masked** mobile number), feature, error text, screen and app version. Orison handles them under **Support tickets** in the platform admin: filters, status, priority, assign, reply to the school, and internal notes the school never sees. The new platform role **Developer** can open only Support tickets: no schools, prices, billing, team or audit (enforced on the server with `tickets:read` / `tickets:write`). **The Flutter teacher and director apps still need a help desk screen** that calls the staff endpoints above (copy the parent app's screen; send `X-Client`); the parent app needs no change. Tickets belong to the school named by `PLATFORM_SCHOOL_CODE` (without it they show as "Unlinked school"); with the multi-school login use the school id from the token. Attachments (screenshots) are not supported yet; add them with private storage, not the public uploads folder.
- Fixed on the way: submitting a parent help request saved it but returned a server error to the app (the database id could not be returned); it now returns the request normally.
- **Platform roles are now Owner, Developer and Sales** (the Support role was removed). **Sales** (`leads:own`, `pricing:read`) works only on their own leads and can read the price list; they cannot see schools, billing, usage, tickets or the team. **Sales pipeline** (`platform_admin.py`, `/api/platform/leads*`; screens `PlatformSales.jsx`): for each school visited, the salesperson records the people met (name, role, phone, who decides), each visit, call or demo (who, what was said, result), **every product pitched, each with its own price** (a list of lines on the lead: an ERP plan priced per student per year, or Robotics, VR, IFB, Kreedo or Custom priced as quantity × price each, each with a discount and a note; the lead's quote is the sum, shown before and with GST, and every price change is kept in the history), the next follow-up date and what to do, the stage (New lead, Visited, Demo done, Proposal sent, Negotiation, Won, Lost with a reason), and how interested they are. The Owner sees every salesperson's leads, a team table (schools, open, visits, proposals, won, pipeline value), and can reassign. When a school signs, the Owner clicks **Create school from this**: it creates the school with the contact, plan, student count and the negotiated price carried into the school's discount (taken from the ERP line of the pitch; if no ERP plan was pitched the Owner picks the plan, and the Robotics, VR, IFB, Kreedo or Custom lines stay on the lead and do not touch billing). The Sales screens are a **board** (drag a school between stages) and a list, with a "Follow up today" panel (call and WhatsApp buttons), a product mix chart and a feed of the latest visits; the Owner also gets a card per salesperson. Follow-up "today" uses Indian time. No reminders are sent yet (email or WhatsApp to the salesperson when a follow-up is due is a good next step).
- **Sales: school location, photos and distance between schools** (`platform_admin.py`: `location_fields`, `build_routes`, photo endpoints; screens `PlatformRoutes.jsx` and the "Where the school is" and "Photos from the school" cards on the lead page). A lead can hold a Google Maps link or plain coordinates (a short `maps.app.goo.gl` link is saved but has no position, so the app asks for the full link or "Use my current location"). Photos are uploaded from the phone camera or gallery, resized, stripped of EXIF but with the GPS position kept as numbers, and stored **privately** in `backend/private_uploads/leads/` (git-ignored); they are never public URLs, the browser fetches each one with the login token (`AuthImage`). **Developer to-do: that folder is local disk. Before running several servers or deploying, back it up or move it to object storage (S3/GCS) behind the same endpoints.** Each Visit, Meeting or Demo can carry a typed distance in km; where none is typed, the distance from the previous school visited that day is estimated as a straight line (haversine) between the map pins and shown as "straight line" (real road distance is longer; a typed value always wins; the first stop of a day needs a typed distance from where the day started). The **Routes** view (Board / List / Routes toggle) lists each day as school 1, 2, 3 with the km between them, total km, missing distances, and an "Open route in Maps" link; the Owner can filter by salesperson, and each team card shows km in the last 30 days. If you want road distances, call a routing API (Google Distance Matrix, OSRM) inside `build_routes`.
- **School logins** (Owner only, school's Overview tab; `/api/platform/schools/{id}/accounts*`, permission `credentials:manage`): a username (default `<school code>.<login type>`, editable) and a password for each login the school has. A password is made by the server, shown **once** and stored only as a salted PBKDF2 hash (never logged); nobody, including the Owner, can read it again, only set a new one. **These are not enforced yet**: the school app still signs in by login type without a password (see `HANDOFF_REVIEW.md`). The developer should make the school login check the username and password against `school_accounts` (with lockout and rate limiting) as part of Phase 1, and change the login screen's "email" box to "username".
- Not built: items 8–12 (usage health beyond the table, onboarding tracker, announcements, backups, support tickets).
- Set `PLATFORM_JWT_SECRET` (32+ characters) and `APP_ENV=production` on the server. Starting prices (200 / 350 / 500) are only seed values and are edited in Plans & pricing.

**Must have at launch**
1. **School management** — create a school (name, code, address, contact person, academic year, board); status Active / Trial / Suspended / Expired (suspended = cannot log in, data kept); list of all schools with plan, student count, contract end date and status.
2. **Plan and feature control** — assign Essential / Pro / Premium; switch single features on or off for one school (special agreements); upgrade or downgrade instantly with no data loss; set limits (students, branches, logins).
3. **Billing and contracts** — editable rate per student per year per plan, minimum yearly fee, setup fee (waivable), discounts; student-count snapshot at the start of the academic year; invoice generation with GST; contract start/end, renewal dates, paid/unpaid status, alert before renewal; invoice download.
4. **WhatsApp and SMS usage** — messages used vs the monthly limit per school, 80% and 100% alerts, overage rate or SMS fallback, template approval status, delivery failures, sender number per school.
5. **Support access** — "view as school Admin" for help, with every session logged; reset a school Admin's password; unlock accounts.
6. **Security of this login** — mandatory 2FA; separate from school staff logins; full audit log of everything done here; several platform users with roles (Owner, Support, Sales) so there is no single shared login.

**Recommended**
7. Dashboard: total schools and students, monthly recurring revenue, renewals due in 30 days, schools at risk (inactive 7 days or unpaid), new schools per month.
8. Usage and health per school: last login, daily active users, modules used, storage, error counts.
9. Onboarding tracker for the 30-day go-live (kick-off, data import, training, parents live, review) with an owner and checklist per step.
10. Announcements to all school admins (maintenance, new features).
11. Backups: last backup time per school and a restore action.
12. Support tickets: simple inbox for school admins.

**Later**
Online payment and auto-renewal from schools; partner/sales-agent logins with commission; per-school branding settings (logo, letterhead, app name); data export and deletion at contract end (DPDP); platform-wide reports and Tally export of Orison's own invoices.

**Rule:** the platform admin sees settings, usage and billing. It must **not** see student, fee or marks records by default. Opening a school's data requires an explicit, logged "view as school" action.

## 6. Promises in the sales material vs the code today

| Promise | Today |
|---|---|
| WhatsApp alerts, receipts, reminders, results | Records are queued; nothing is sent |
| Reminders with a pay link | Razorpay order/verify exist; no webhook, no link |
| Data in India, daily backups | Not set up |
| Role-based logins, email/password or OTP, fingerprint | Role picker only; no passwords; OTP is faked in the browser |
| Live in 30 days, we import data and dues | Bulk CSV exists for students, staff, teachers; fee-dues import needs checking |
| Telugu, Hindi, English | Menus and dialogs only; page content is English |
| Plans switch features on and off | No plans or feature flags exist |
| Per-school billing and WhatsApp counters | Not started |

## 7. Definition of done for each integration
Per-school config, secrets in environment or a secret store (never in git), retries and logging, a test against a **test database** (never the live one), and a line in the docs.
