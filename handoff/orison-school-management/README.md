# Orison School Management

A full-stack school-management dashboard: React frontend, FastAPI backend, and MongoDB.
Role-based login (Admin / Principal / Fee Manager), 24 sidebar modules, student profiles
(fees, marks, attendance), global search, partial fee collection, CSV import/export, and
live analytics dashboards.

> This project was built on Emergent but runs anywhere. It has **no Emergent-only runtime
> dependency** — the backend uses only public-PyPI packages.

---

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19, React Router 7, Tailwind CSS 3, Recharts 3, Axios, shadcn/ui (Radix) |
| Backend  | FastAPI, Motor (async MongoDB driver), Pydantic v2, PyJWT |
| Database | MongoDB |
| Tooling  | CRACO + yarn (frontend), Uvicorn + pip (backend) |

---

## Prerequisites

- **Node.js 18+** and **yarn** (v1)
- **Python 3.11+**
- **MongoDB 5.0+** running locally, or a connection string to a hosted instance
  (e.g. MongoDB Atlas)

Start a local MongoDB quickly with Docker:
```bash
docker run -d --name mongo -p 27017:27017 mongo:6
```

---

## Local Setup

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set:
#   MONGO_URL=mongodb://localhost:27017
#   DB_NAME=orison
#   JWT_SECRET=<any-long-random-string>
#   CORS_ORIGINS=*

# Run the API (dev)
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

- All routes are served under the `/api` prefix, e.g. `http://localhost:8001/api/`.
- On first startup the backend **auto-seeds demo data** (students, fees, exams, leaves,
  teachers, one marks set, events) into empty collections. See `docs/DATABASE.md`.

Smoke-test it:
```bash
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"role":"admin"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s http://localhost:8001/api/students -H "Authorization: Bearer $TOKEN"
```

### 2) Frontend

```bash
cd frontend
yarn install

cp .env.example .env
# Ensure REACT_APP_BACKEND_URL=http://localhost:8001  (no trailing /api)

yarn start                         # http://localhost:3000
```

### 3) Log in
Login is **role-based via buttons** on the landing page (demo has no password):
**Login as Admin** (all modules), **Login as principal**, **Login as Fee Manager**.
Each calls `POST /api/auth/login` with `{ "role": "<role>" }` and stores the JWT in
`localStorage`.

---

## Dependencies

**Backend** (`backend/requirements.txt`) — all from public PyPI:
`fastapi`, `uvicorn`, `motor`, `pymongo`, `pydantic`, `python-dotenv`, `pyjwt`,
`python-multipart`, plus `pytest`, `pytest-xdist`, `requests` for tests.

> Note: an earlier version listed `emergentintegrations`, an Emergent-private package that
> is not on public PyPI and is **not used** by this app. It (and other unused packages)
> have been removed so `pip install -r requirements.txt` works on any machine.

**Frontend** — see `frontend/package.json` (+ `yarn.lock` for exact versions).

---

## Build for Production

```bash
cd frontend
REACT_APP_BACKEND_URL=https://api.your-domain.com yarn build   # -> frontend/build/

cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```
Serve `frontend/build/` from any static host with an SPA fallback to `index.html`, and
proxy `/api/*` to the backend. Full details in `docs/DEPLOYMENT.md`.

---

## Tests

```bash
cd backend
pytest        # config in pytest.ini (uses pytest-xdist)
```

---

## Documentation

- **API reference:** `docs/API.md`
- **Database schema, indexes & seeding:** `docs/DATABASE.md`
- **Deployment / production notes:** `docs/DEPLOYMENT.md`
- **Known issues:** `KNOWN_ISSUES.md`
