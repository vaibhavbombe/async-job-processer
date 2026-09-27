# Async Job Processor

A background job queue system built to decouple slow, unreliable work from
user-facing requests — with automatic retries, permanent job history, and a
live real-time dashboard.

**Live demo:** _add URL once deployed_
**Dashboard repo:** this repo (`/client` folder)

---

## The problem this solves

Most simple web apps do work synchronously: a request comes in, the server
does the work right then, and sends back a response. That falls apart when
the work is slow (generating a report, processing a file) or unreliable
(calling a flaky third-party API) — the request hangs, the server's
resources are tied up, and a single failure means the work is just lost.

This project solves that by decoupling **accepting** work from **doing**
work:

1. A client submits a job → the API responds instantly with a job ID
2. A **separate worker process** picks up the job and does the actual work,
   independently, on its own schedule
3. If the work fails, it **automatically retries with exponential backoff**
   rather than immediately hammering the failing service again
4. Every outcome — success or permanent failure — is **permanently logged**,
   so there's a real audit trail

This is the same underlying pattern behind order-confirmation emails, bulk
report generation, webhook delivery, and most "processing..." states in
real products.

---

## Architecture

```
Client (React dashboard)
      |
      | REST (submit job, fetch stats/history)
      v
Express API  <-------- Socket.io -------->  Dashboard (live updates)
      |                     ^
      | adds job            | relays job-event
      v                     |
   Redis (BullMQ queue)     |
      ^                     |
      | picks up job        |
      |                     |
   Worker process ----------+
      |
      | logs final outcome
      v
   MongoDB (permanent job history)
```

**Why two different data stores, not just one:**
- **Redis** holds live, ephemeral queue state — which jobs are waiting,
  active, or recently finished. It's fast and built for this, but not meant
  as permanent storage; BullMQ cleans up old job data to keep it lean.
- **MongoDB** holds permanent, queryable history — every job's final
  outcome, kept indefinitely, independent of whatever Redis is currently
  doing. Using each store for what it's actually good at, rather than
  forcing one tool to do both jobs, was a deliberate design decision.

**Why the worker is a separate process, not a function the API calls
directly:** this is the actual point of a job queue. The API stays fast and
responsive regardless of how long the real work takes, because it never
waits for it — it just adds the job to Redis and returns. The worker (in a
real production deployment, potentially running on entirely separate
hardware) processes jobs on its own time.

---

## Tech stack

- **Node.js + Express** — API server
- **BullMQ + Redis** — the actual job queue: adding jobs, tracking state,
  retry/backoff scheduling
- **MongoDB (Mongoose)** — permanent job history
- **Socket.io** — real-time updates from worker → server → dashboard
- **React + Chart.js + Axios** — the live dashboard
- **Bull Board** — a pre-built admin UI (`/admin/queues`) for inspecting
  the queue directly, used during development/debugging

---

## Features

- Instant job submission — API responds in milliseconds regardless of how
  long the actual work takes
- Automatic retries with exponential backoff (up to 4 attempts, delay
  roughly doubling each time) on simulated realistic failure
- Permanent job history in MongoDB, with correct handling of the
  "failed-then-retried-then-succeeded" case (only the final outcome is
  logged, not every individual retry attempt)
- Live dashboard: real-time stat cards (waiting/active/completed/failed),
  a live throughput chart seeded from real history on load, and a
  scrollable recent-jobs log — all updating via Socket.io, no polling or
  manual refresh needed for job events (stats also poll every 2s as a
  safety net for the in-between "active" window)
- Bull Board integration for direct queue inspection during development

---

## Honest limitations (things I'd address before real production use)

Being specific about known gaps here on purpose — understanding the edges
of what you built matters as much as the parts that work.

- **No idempotency guard.** If a job completes but the "mark as done" step
  fails before BullMQ registers it, a retry could re-run already-completed
  work. A production system would need an idempotency key checked before
  execution.
- **Worker crash recovery is untested.** BullMQ has stalled-job detection
  built in, but I haven't specifically verified recovery behavior if the
  worker process dies mid-job.
- **Bull Board has no authentication.** Fine for local development; a
  public deployment would need basic auth in front of `/admin/queues`.
- **Single worker instance.** BullMQ supports running multiple workers
  against the same queue with no code changes (they coordinate through
  Redis automatically) — this project runs one, since concurrency wasn't
  the focus, but scaling horizontally would just mean starting more
  `worker.js` processes.
- **Redis Cloud free tier note:** the eviction policy had to be manually
  changed from the default `volatile-lru` to `noeviction` — BullMQ
  explicitly requires this, since job data should never be silently
  evicted under memory pressure the way a pure cache's data safely can be.

---

## Running locally

You need **three processes running at once**, each in its own terminal.

**1. API server**
```bash
npm install
npm run server
```
Runs on `http://localhost:4000`.

**2. Worker**
```bash
npm run worker
```

**3. Dashboard**
```bash
cd client
npm install
npm run dev
```
Runs on `http://localhost:5174`.

### Environment variables

Create `.env` in the project root:
```
REDIS_URL=your-redis-connection-string
MONGODB_URI=your-mongodb-connection-string
PORT=4000
```

---

## Trying it out

Once all three are running, open the dashboard and submit a job by name
directly from the form — no Postman needed. Watch the stat cards move
from waiting → active → completed (or occasionally failed, then retried)
in real time, and check `http://localhost:4000/admin/queues` for the
full Bull Board view of the same data.
