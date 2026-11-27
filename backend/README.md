# OverThink Backend API

Production-ready Node.js, Express, and MongoDB (Mongoose) backend for **OverThink** — where users submit a thought, business challenge, career question, or personal problem and receive meaningful guidance from a human consultant or AI within 24 hours.

---

## Project Structure

```text
THINK_BACKEND/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # MongoDB connection
│   │   ├── models/
│   │   │   ├── User.js               # Users, clients, consultants & admins (bcrypt hashed)
│   │   │   ├── Thought.js            # Submitted thoughts/questions
│   │   │   ├── Reply.js              # Consultant / AI solutions
│   │   │   └── Newsletter.js         # Newsletter subscribers
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── thoughtController.js
│   │   │   ├── replyController.js
│   │   │   └── newsletterController.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── thoughtRoutes.js
│   │   │   ├── replyRoutes.js
│   │   │   └── newsletterRoutes.js
│   │   ├── middleware/
│   │   │   ├── auth.js               # protect, optionalProtect, restrictTo
│   │   │   ├── errorHandler.js       # Centralized { success, message, data } errors
│   │   │   ├── rateLimiters.js       # Global + stricter auth/submission limiters
│   │   │   └── validate.js           # express-validator rules & sanitizers
│   │   ├── utils/
│   │   │   ├── response.js           # Standardized JSON response helper
│   │   │   └── sendEmail.js          # Optional Nodemailer notification
│   │   ├── app.js                    # Express setup, Helmet, CORS, Morgan, routes
│   │   └── server.js                 # Bootstraps DB and HTTP server
│   ├── .env                          # Local secrets (never commit)
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── README.md
└── frontend/
    ├── css/styles.css
    ├── js/
    │   ├── api.js                    # Single API_BASE_URL + fetch helpers + JWT handling
    │   ├── app.js                    # Landing/thought/auth/tracking/newsletter wiring
    │   └── admin.js                  # Consultant/Admin queue & reply wiring
    ├── index.html
    └── admin.html
```

---

## Environment Variables

Copy `.env.example` to `.env` inside `backend/` (already configured for local MongoDB at `mongodb://127.0.0.1:27017/overthink`):

| Variable | Description | Example |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment (`development` \| `production`) | `development` |
| `PORT` | Port the Express server listens on | `5000` |
| `MONGO_URI` | Local MongoDB or MongoDB Atlas connection URI | `mongodb://127.0.0.1:27017/overthink` |
| `JWT_SECRET` | Secret key used to sign/verify JWT tokens | `long_random_64_char_string` |
| `JWT_EXPIRES_IN` | Token expiration window | `7d` |
| `CLIENT_URL` | Comma-separated allowed CORS origins | `https://thinkhere.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5500,http://127.0.0.1:5500` |
| `EMAIL_HOST` | SMTP host for reply notifications (optional) | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_SECURE` | `true` for port 465, otherwise `false` | `false` |
| `EMAIL_USER` | SMTP username (optional; skipped safely if blank) | `you@gmail.com` |
| `EMAIL_PASS` | SMTP password / app password | `app_password` |
| `EMAIL_FROM` | Sender display name and address | `OverThink <no-reply@overthink.app>` |

---

## Setup & Run Locally

### 1. Start the Backend

> Note: On Windows PowerShell where execution policy blocks `npm.ps1`, use `npm.cmd`.

```bash
cd backend
npm.cmd install
npm.cmd run dev
```

The API will connect to MongoDB (`MONGO_URI`) and start at `http://localhost:5000`.

### 2. Serve the Frontend

Open `frontend/` using any static server on port `5500` (matches the allowed `CLIENT_URL` CORS origins), for example VS Code **Live Server** (`http://127.0.0.1:5500/frontend/index.html`) or:

```bash
# From c:\THINK_BACKEND\frontend
npx.cmd serve -l 5500
```

Then visit:
- User site: `http://localhost:5500/index.html`
- Consultant / Admin workspace: `http://localhost:5500/admin.html`

---

## API Reference (Base Prefix: `/api`)

All responses share a consistent JSON shape:

```json
{
  "success": true,
  "message": "Human-readable status message",
  "data": {}
}
```

### Health

- **`GET /api/health`** — Public health & MongoDB status check.

```json
{
  "success": true,
  "message": "OverThink API is running.",
  "data": {
    "status": "ok",
    "database": "connected",
    "uptimeSeconds": 12,
    "timestamp": "2026-11-27T10:00:00.000Z"
  }
}
```

### Authentication

- **`POST /api/auth/register`** — Register a `user`, `client`, or `consultant` account (rate limited, bcrypt 12 rounds).

Request:
```json
{
  "name": "Alex Rivera",
  "email": "alex@example.com",
  "password": "Password123",
  "role": "consultant"
}
```

Response (`201 Created`):
```json
{
  "success": true,
  "message": "Account registered successfully.",
  "data": {
    "token": "<jwt_token>",
    "user": {
      "_id": "67...",
      "name": "Alex Rivera",
      "email": "alex@example.com",
      "role": "consultant"
    }
  }
}
```

- **`POST /api/auth/login`** — Authenticate with `email` or `mobile`/`identifier` + `password` and receive a JWT token (`200 OK`).
- **`GET /api/auth/me`** — Protected (`Authorization: Bearer <token>`), returns current user (`200 OK`).
- **`PATCH /api/auth/me`** — Protected, updates profile & consultant qualification fields (`name`, `mobile`, `avatar`, `headline`, `bio`, `hourlyRate`, `skills`, `services`, `assessmentPassed`, `assessmentScore`, `isVerified`).
- **`GET /api/auth/consultants`** — Public consultant directory profiles.

### Thoughts

- **`POST /api/thoughts`** — Public (rate limited; links `user` automatically if Bearer token is sent). Accepts `name`, `email`, `category` (`business` | `career` | `personal` | `other`), `message` (max 3000 chars), `solverType` (`human` | `ai`), plus optional `title`, `description`, `urgency`, `attachments`. Creates a consultant notification automatically.

Request:
```json
{
  "name": "Jordan Lee",
  "email": "jordan@example.com",
  "category": "business",
  "solverType": "human",
  "message": "Should we bootstrap our B2B SaaS or raise pre-seed capital first?"
}
```

- **`GET /api/thoughts/my`** — Protected, lists thoughts belonging to the signed-in user along with replies.
- **`GET /api/thoughts`** — Consultant/Admin only (`restrictTo('consultant', 'admin')`). Supports `?page=1&limit=10&status=pending&category=business&solverType=human&q=keyword`.
- **`GET /api/thoughts/:id`** — Returns a single thought with its replies (masks submitter email for unauthenticated callers).
- **`POST /api/thoughts/:id/accept`** — Consultant/Admin only. Claims a pending thought (`status: "accepted"`), opens a 1-on-1 `Conversation` with the initial problem message, and notifies the client.
- **`PATCH /api/thoughts/:id/status`** — Consultant/Admin only. Updates status (`pending`, `pending_human`, `accepted`, `in_progress`, `answered`, `resolved`, `ai_fallback`, `closed`) plus optional `solution`, `aiResponse`, `aiDiagnosticPlan`, and syncs linked conversation status.

### Conversations & Notifications (React Frontend Support)

- **`GET /api/conversations`** — Protected, returns 1-on-1 consultation rooms for the signed-in client or consultant.
- **`POST /api/conversations/:id/messages`** — Protected, appends a message and notifies the other participant.
- **`PATCH /api/conversations/:id/read`** — Protected, marks incoming messages as read.
- **`DELETE /api/conversations/:id/messages/:messageId`** — Protected, deletes a user-authored chat message.
- **`GET /api/notifications`** — Protected, fetches notifications for the signed-in user and role.
- **`PATCH /api/notifications/:id/read`** / **`PATCH /api/notifications/read-all`** — Protected, marks notification(s) as read.

> See `backend/docs/react-api-adapter.js` for a drop-in ES module client (`overthinkApi`) ready for your Vite React app (`http://localhost:5173`).

### Replies

- **`POST /api/replies`** — Consultant/Admin only. Saves a reply (`responderType`: `consultant` | `admin` | `AI`), sets the thought's status to `answered`, and triggers an email notification if SMTP is configured.

Request:
```json
{
  "thought": "67...",
  "responderType": "consultant",
  "message": "Validate willingness-to-pay with 5 pilot customers before raising dilution capital."
}
```

- **`GET /api/replies/:thoughtId`** — Returns replies for a thought.

### Newsletter

- **`POST /api/newsletter`** — Public (rate limited). Subscribes `{ "email": "you@example.com" }`.

---

## Deploying to Render or Railway

1. Create a **MongoDB Atlas** cluster, copy the connection string (`mongodb+srv://...`), and whitelist network access as required.
2. Deploy `backend/` as a Web Service on **Render** or **Railway**:
   - Build command: `npm install`
   - Start command: `npm start`
3. Configure environment variables in the hosting dashboard:
   - `NODE_ENV=production`
   - `MONGO_URI=<your_mongodb_atlas_uri>`
   - `JWT_SECRET=<strong_random_secret>`
   - `JWT_EXPIRES_IN=7d`
   - `CLIENT_URL=https://thinkhere.vercel.app,http://localhost:5500,http://127.0.0.1:5500`
   - Optional SMTP keys (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`)
4. Update `API_BASE_URL` in `frontend/js/api.js` (or your Vercel React app's API config) to point to your live Render/Railway URL (`https://<your-service>.onrender.com/api`).
