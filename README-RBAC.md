# Host-Age Backend — RBAC + Port 5200

This build includes:

- Express backend on port **5200**
- JWT authentication
- RBAC with the `ADMIN` role
- Two ready-to-seed admin accounts
- Admin-only routes under `/api/admin`
- Existing customer `USER` registration remains protected from self-assigning ADMIN
- PostgreSQL/Sequelize integration

## Run

From this folder (the folder containing `package.json` and `server.js`):

```powershell
npm install
npm run seed:admins
npm start
```

Backend:
`http://localhost:5200`

Health check:
`GET http://localhost:5200/`

## Admin accounts

The seed script uses these defaults unless overridden in `.env`:

- `admin1@host-age.in` / `HostAge@Admin123!`
- `admin2@host-age.in` / `HostAge@Admin456!`

Change these passwords after first login. Prefer overriding the credentials in `.env` before running the seed script.

## RBAC endpoints

All endpoints below require:

`Authorization: Bearer <JWT>`

and `role === ADMIN`.

- `GET /api/admin/me`
- `GET /api/admin/users`
- `GET /api/admin/stats`
- `PATCH /api/admin/users/:id/status`

Example:

```http
GET http://localhost:5200/api/admin/users
Authorization: Bearer <JWT>
```

A normal `USER` receives HTTP `403` when calling `/api/admin/*`.

## Frontend

Update the React frontend `.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:5200
REACT_APP_API_URL=http://localhost:5200
```

Then restart the React dev server.
