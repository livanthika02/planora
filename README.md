# Planora — Full-Stack Version

This is the real version: a Node.js + Express backend, a SQLite database,
and Socket.io for live updates. The frontend is the same Planora board you
already had, now talking to a real server instead of just the browser.

## What's inside

```
planora-fullstack/
├── package.json          → lists what the server needs (Express, SQLite, etc.)
├── server/
│   └── server.js         → the backend: API routes + database + real-time
└── public/
    └── index.html         → the frontend (what you see in the browser)
```

When you run the server, `planora.db` (the actual database file) will be
created automatically inside the `server/` folder the first time you sign up.

## One-time setup (you only need to do this once)

**Step 1 — Install Node.js** (skip if you already have it)
Download and install from https://nodejs.org (choose the "LTS" version).

**Step 2 — Open this folder in a terminal**
- In VS Code: open this folder (`File → Open Folder`), then open a terminal
  with `Terminal → New Terminal`.

**Step 3 — Install the dependencies**
In that terminal, type:
```
npm install
```
This downloads the packages listed in `package.json` into a `node_modules`
folder. You'll see it appear after a few seconds — that's normal.

## Running the app

Every time you want to run Planora:
```
npm start
```
You'll see:
```
Planora server running at http://localhost:3000
```
Open that link in your browser (Chrome, Edge, etc.) — that's the app,
now backed by a real server and database.

To stop the server, click into the terminal and press `Ctrl + C`.

## How it works

- **Frontend** (`public/index.html`) — the board, forms, and styling. When you
  sign in or add a task, it sends a request to the backend instead of saving
  things itself.
- **Backend** (`server/server.js`) — an Express server with routes like
  `/api/auth/login` and `/api/tasks`. It checks passwords, reads/writes the
  database, and tells connected browsers about changes in real time.
- **Database** — SQLite, stored in a single file (`server/planora.db`). Every
  user and task lives there permanently, even if you restart the server.
- **Real-time** — Socket.io. If you open the app in two browser tabs (or two
  devices) signed in as the same user, adding or moving a task in one tab
  updates the other instantly.

## Notes

- Passwords are hashed before being stored (never saved as plain text).
- The `JWT_SECRET` in `server.js` is fine for learning/local use — for a real
  deployed app, that value should come from an environment variable instead
  of being written in the code.
- This runs on your own computer only (`localhost`). To let others use it
  over the internet, you'd need to deploy it somewhere (e.g. Render, Railway,
  or a VPS) — happy to walk through that separately if you want it.
