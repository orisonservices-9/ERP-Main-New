# Database — Orison School Management

**Engine:** MongoDB (accessed via the async Motor driver).
Database name comes from the `DB_NAME` env var; connection from `MONGO_URL`.

There is **no ORM and no migration framework** — collections are schema-less and are
created lazily on first insert. Document shapes are enforced at the app layer via
Pydantic models in `backend/server.py`.

---

## Collections & Shapes

### `students`
| Field | Type | Notes |
|-------|------|-------|
| id | string | App-generated, e.g. `EP-XXXXXXXX` (primary key used in queries) |
| name | string | required on create |
| admission_no | string | required, **unique** (enforced in create/bulk) |
| class_name, section, academic_year | string | required on create |
| roll, status, gender, dob, blood_group, aadhar | string | |
| father_name, mother_name, guardian_name, guardian | string | `father_name` required on create |
| mobile, mobile_alt, emergency_contact, phone, parent_phone | string | `mobile` required on create |
| caste, subcaste, parent_id, parent_name, address, password | string | mostly used by bulk import |
| balance | number | synced from the student's fee `due` |
| avatar | string (URL) | |

### `fees`
| Field | Type | Notes |
|-------|------|-------|
| id | string | e.g. `FEE-XXXXXXXX` |
| student_id | string | FK → `students.id` |
| name | string | denormalized student name |
| total, paid, due | number | |
| status | string | `Paid` / `Partial` / `Overdue` |
| method | string | last payment method |
| avatar | string (URL) | |

### `exams`
`{ id, title, class_name, section, subject, date, room, start_time, end_time, max_marks, passing_marks, status }`
status ∈ `Draft` / `Scheduled` / `Completed`.

### `marks_sets`
`{ id, exam_title, class_name, section, subject, max_written, max_practical, total_max, created, rows: [{ roll, name, written, practical, total }] }`

### `leaves`
`{ id, name, leave_type, from_date, to_date, days, reason, status, avatar }`
status ∈ `Pending` / `Approved` / `Rejected`.

### `teachers`
`{ id, name, subject, classes, phone, status, avatar }`

### `events` (notifications feed)
`{ id, type, title, body, unread, created (ISO string) }`
type ∈ `info` / `success` / `warning`.

---

## Indexes / Constraints

None are declared programmatically. **Recommended for production:**
```js
db.students.createIndex({ admission_no: 1 }, { unique: true })
db.students.createIndex({ id: 1 }, { unique: true })
db.fees.createIndex({ student_id: 1 })
db.marks_sets.createIndex({ created: -1 })
db.events.createIndex({ created: -1 })
```
> The uniqueness of `admission_no` is currently enforced only in application code
> (a race condition could allow duplicates without the DB unique index above).

---

## Seed Data

Seeding runs automatically on backend startup (`@app.on_event("startup") -> seed()`).
For each collection it inserts demo rows **only if the collection is empty**, so it is
safe to restart and it will not overwrite edited data.

Seeded content:
- 5 students, 5 fee records, 4 exams, 6 leaves, 6 teachers
- 1 marks set (`Mid-Term 2025`, Grade 10-A Mathematics, 5 students)
- 3 notification events

### Re-seed from scratch (dev)
Drop the collections (or the whole DB) and restart the backend:
```bash
mongosh "$MONGO_URL/$DB_NAME" --eval 'db.dropDatabase()'
# restart backend -> seed() repopulates
```

### Fresh production database
A brand-new production DB will be seeded with the same demo rows on first boot. If you
do **not** want demo data in production, either point `DB_NAME` at a pre-populated DB or
remove/guard the `seed()` call in `server.py`.

---

## Migrations

There are no migration files (schema-less MongoDB). If you introduce breaking field
changes, write a one-off script using `motor`/`pymongo` to backfill existing documents.
