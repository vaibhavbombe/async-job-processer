# Async Job Processor

A background job queue system built to decouple slow, unreliable work from
user-facing requests — with automatic retries, permanent job history, and a
live real-time dashboard.

**Live demo:** https://async-job-processer.vercel.app/
**Dashboard repo:** this repo (`/client` folder)
<img width="1905" height="901" alt="image" src="https://github.com/user-attachments/assets/0d674e5b-976a-40f6-980d-2ec5e497c3c4" />

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
2. A **worker** picks up the job and does the actual work independently
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
      | REST (submit job, fetch stats/history)  +  Socket.io (live updates)
      v
+-------------------------------------------+
|  Node process (server.js)                 |
|                                            |
|   Express API  <---- io ---->  Worker     |
|        |                          |       |
|        | adds job                 | processes job
|        v                          v       |
+-------------------------------------------+
        |                          |
        v                          v
     Redis (BullMQ queue)    MongoDB (permanent job history)
```

**Why two different data stores, not just one:**
- **Redis** holds live, ephemeral queue state — which jobs are waiting,
  active, or recently finished. It's fast and built for this, but not meant
  as permanent storage; BullMQ cleans up old job data to keep it lean.
- **MongoDB** holds permanent, queryable history — every job's final
  outcome, kept indefinitely, independent of whatever Redis is currently
  doing. Using each store for what it's actually good at, rather than
  forcing one tool to do both jobs, was a deliberate design decision.

**On the API and worker running in one process — a deliberate,
stated tradeoff, not the ideal architecture:**

The API and the worker are logically separate concerns (this is exactly why
the queue exists — to decouple them), and they were originally built and
run as two fully separate processes locally, communicating only through
Redis and a Socket.io connection. For deployment, they were merged into a
single Node process (`server.js` internally starts the worker) specifically
because Render's free tier only covers its "Web Service" type — the
"Background Worker" service type required to run `worker.js` as a truly
separate deployment is paid-only, with no free tier at all.

In a real production system with real traffic, I'd deploy these as genuinely
separate services — so a spike in job-processing load can't slow down or
crash API response times, and so each can be scaled independently. Running
them combined here is a pragmatic, cost-driven choice for a free-tier
portfolio deployment, not a claim that this is the correct architecture at
scale. Locally, the code can still be run as two separate processes
(`node server.js` and `node worker.js` independently) if you want to see
the fully decoupled version — `worker.js` degrades gracefully and simply
skips real-time broadcasts if it isn't handed a live Socket.io instance.

---

## Tech stack

- **Node.js + Express** — API server
- **BullMQ + Redis** — the actual job queue: adding jobs, tracking state,
  retry/backoff scheduling
- **MongoDB (Mongoose)** — permanent job history
- **Socket.io** — real-time updates from worker → dashboard
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
  scrollable recent-jobs log — updating via Socket.io on every job
  completion, with a lightweight polling fallback on the stats endpoint so
  in-between states (a job sitting "active") stay current too
- Bull Board integration for direct queue inspection during development

---

## Honest limitations (things I'd address before real production use)

Being specific about known gaps here on purpose — understanding the edges
of what you built matters as much as the parts that work.

- **API and worker run in one process in this deployment**, for the
  free-tier cost reason explained above — not how I'd architect this for
  real scale.
- **No idempotency guard.** If a job completes but the "mark as done" step
  fails before BullMQ registers it, a retry could re-run already-completed
  work. A production system would need an idempotency key checked before
  execution.
- **Worker crash recovery is untested.** BullMQ has stalled-job detection
  built in, but I haven't specifically verified recovery behavior if the
  process dies mid-job.
- **Bull Board has no authentication.** Fine for local development; a
  public deployment would need basic auth in front of `/admin/queues`.
- **Single worker instance.** BullMQ supports running multiple workers
  against the same queue with no code changes (they coordinate through
  Redis automatically) — this project runs one, since concurrency wasn't
  the focus.
- **Redis Cloud free tier note:** the eviction policy had to be manually
  changed from the default `volatile-lru` to `noeviction` — BullMQ
  explicitly requires this, since job data should never be silently
  evicted under memory pressure the way a pure cache's data safely can be.

---

## Running locally

**Combined (matches the deployed setup):**
```bash
npm install
npm run server
```
This starts the API and the worker together in one process, on
`http://localhost:4000`.

**Or, fully decoupled (two processes, matches the "real" architecture):**
```bash
npm run server   # in one terminal
npm run worker   # in another
```

**Dashboard, either way:**
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

Submit a job by name directly from the dashboard's form — no Postman
needed. Watch the stat cards move from waiting → active → completed (or
occasionally failed, then retried) in real time, and check
`http://localhost:4000/admin/queues` for the full Bull Board view of the
same data.
