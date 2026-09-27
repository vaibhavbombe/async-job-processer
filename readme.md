# Vaibhav Bombe — Portfolio

A full-stack portfolio site built as a live learning project — shipping real
features (not tutorials-only) across the MERN stack, React Three Fiber,
Socket.io, Redis, and (upcoming) an AI chat feature with RAG.

**Live site:** https://vaibhav-bombe-portfolio.vercel.app
**Backend API:** https://vaibhav-portfolio-api.onrender.com

---

## What's in here

- **Home** — dark hero section with an interactive 3D "tech globe" (React
  Three Fiber), draggable and auto-rotating, showing the stack below as
  compartments on its surface. Includes a "currently learning" section and
  live GitHub/LeetCode links.
- **About** — experience, a horizontally auto-scrolling tech-stack marquee,
  and **live** GitHub + LeetCode stats pulled through the backend (cached
  via Redis, not re-fetched on every page load).
- **Projects** — biCanvas and AGROFAM, with tech tags.
- **Hire Me** — a real contact form: submissions are saved to MongoDB *and*
  emailed via Gmail/Nodemailer, with live validation and error states.
- **Dark/light theme toggle** — persisted in `localStorage`, respects system
  preference on first visit.
- **Live visitor counter** — real-time, via Socket.io, shown in the footer.
- **Real-time contact notifications** — when someone submits the Hire Me
  form, a toast appears instantly for the site owner (via a Socket.io
  "admin room"), without polling or refreshing.

---

## Tech stack

**Frontend** (`/client`)
- React 18 + Vite
- Tailwind CSS (custom design tokens, dark mode via CSS variables)
- React Router
- React Three Fiber + drei (3D globe)
- Socket.io Client
- react-icons

**Backend** (`/server`)
- Node.js + Express
- MongoDB (via Mongoose) — contact form persistence
- Redis — caching external API responses (GitHub, LeetCode) with a 1-hour TTL
- Socket.io — live visitor count, real-time contact notifications (with
  room-based targeting)
- Nodemailer — sends contact form submissions to Gmail via an app password
- GitHub REST API (token-authenticated) + LeetCode's GraphQL endpoint, both
  proxied and cached server-side

**Coming next**
- AI chat feature: Python + FastAPI service using retrieval-augmented
  generation (RAG) over resume/project data
- Docker + CI/CD (GitHub Actions) for both services
- Automated tests (frontend + backend)

---

## Project structure

```
portfolio/
  client/                 React + Vite frontend
    src/
      components/         Navbar, Footer, Hero3D, TechMarquee, etc.
      pages/               Home, About, Projects, HireMe
      context/             ThemeContext (dark/light mode)
      data/                 Shared tech-stack data (used by globe + marquee)
      socket.js             Shared Socket.io client connection
      config.js              API_URL, environment-aware
    vercel.json              SPA rewrite rules (fixes refresh 404s)
  server/                  Express backend
    server.js                All routes + Socket.io + Mongo/Redis connections
    .env                     Local secrets (not committed)
```

---

## Running locally

You'll need two terminals running at the same time — one for the frontend,
one for the backend.

**Frontend**
```bash
cd client
npm install
npm run dev
```
Runs at `http://localhost:5173`.

**Backend**
```bash
cd server
npm install
npm run dev
```
Runs at `http://localhost:5000`.

### Environment variables

Neither `.env` file is committed (both are gitignored). You'll need to
create them yourself:

**`server/.env`**
```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
MONGODB_URI=your-mongodb-atlas-connection-string
REDIS_URL=your-redis-cloud-connection-string
GITHUB_TOKEN=your-github-personal-access-token
ADMIN_SOCKET_KEY=any-shared-secret-string
PORT=5000
```

**`client/.env`**
```
VITE_API_URL=http://localhost:5000
VITE_ADMIN_SOCKET_KEY=same-value-as-server's-ADMIN_SOCKET_KEY
```

---

## Deployment

- **Frontend** deploys automatically to **Vercel** on every push to
  `master` (Root Directory: `client`)
- **Backend** deploys automatically to **Render** on every push to
  `master` (Root Directory: `server`)
- Both services read their environment variables from their respective
  hosting dashboards in production — not from any committed file.

---

## Status

Actively being built, feature by feature, as a learning project. See the
"currently learning" section on the live site's Home page for an
up-to-date, specific account of what's been shipped and what's next.