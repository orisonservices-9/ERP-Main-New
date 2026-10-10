# Deployment Notes — Orison School Management

## Architecture at runtime

```
Browser ──> Frontend (static React build, served by any static host / CDN)
                 │  (calls REACT_APP_BACKEND_URL/api/...)
                 ▼
           Backend (FastAPI + Uvicorn)  ──>  MongoDB
```

- The frontend is a **single-page app**. Any host serving it MUST fall back to
  `index.html` for unknown paths (client-side routing) or deep links / refreshes on
  routes like `/students/view` will 404.
- The backend exposes everything under the `/api` prefix. Route your ingress so
  `/api/*` → backend, everything else → frontend static bundle.

## Required configuration

Set env vars from the `.env.example` templates (never commit real values):

- Backend: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`
- Frontend (build-time): `REACT_APP_BACKEND_URL` — must be the public backend origin
  **without** a trailing `/api`. CRA inlines `REACT_APP_*` at build time, so rebuild the
  frontend whenever this value changes.

## Build & run

```bash
# Frontend
cd frontend
yarn install
REACT_APP_BACKEND_URL=https://api.example.com yarn build   # -> frontend/build/

# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
# For production, run behind a process manager / multiple workers, e.g.:
# uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

Serve `frontend/build/` from Nginx, a CDN, or any static host, with the SPA fallback:

```nginx
location /api/ { proxy_pass http://backend:8001; }
location /     { try_files $uri /index.html; }
```

## Production checklist / hardening

- [ ] Set a strong, unique `JWT_SECRET` (do not use a dev default).
- [ ] Restrict `CORS_ORIGINS` to your real frontend origin(s) — the app currently
      allows `*` with credentials, which browsers ignore; tighten this.
- [ ] Add the MongoDB unique index on `admission_no` (see `docs/DATABASE.md`) to
      prevent duplicate students under concurrency.
- [ ] Decide on demo seeding: a fresh DB auto-seeds demo rows on first boot. Disable
      `seed()` if you don't want demo data in production.
- [ ] The current demo auth is **role-only (no password)**. Replace with real
      authentication before going live (see KNOWN_ISSUES.md).
- [ ] Add per-endpoint role authorization on the backend if you need true RBAC
      (today the backend authenticates the token but does not restrict data endpoints
      by role — the restriction is enforced only in the frontend).
- [ ] Serve over HTTPS; set secure headers.

## Notes on the managed (Emergent) environment
This project was developed on Emergent, where services are managed by supervisor and the
public backend URL is injected via `REACT_APP_BACKEND_URL`. For your own hosting you can
ignore Emergent specifics; only the env vars above matter.
