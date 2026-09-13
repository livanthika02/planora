// ============================================================
// Planora backend — Express (API) + SQLite (database) + Socket.io (real-time)
// ============================================================

const express = require("express");
const path = require("path");
const http = require("http");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In a real production app, keep this in an environment variable, not in code.
const JWT_SECRET = "planora-dev-secret-change-me";

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ---------------- Database setup ----------------
const dbPath = path.join(__dirname, "planora.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'todo',
    due TEXT,
    updated_at INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// ---------------- Auth middleware ----------------
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing token" });
  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------------- Auth routes ----------------
app.post("/api/auth/signup", (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  const displayName = (name && name.trim()) || email.split("@")[0];
  const hash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
    [displayName, email.toLowerCase().trim(), hash],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({ error: "An account with that email already exists." });
        }
        return res.status(500).json({ error: "Server error." });
      }
      const token = jwt.sign({ userId: this.lastID }, JWT_SECRET, { expiresIn: "30d" });
      res.json({ token, userId: this.lastID, name: displayName });
    }
  );
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  db.get(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase().trim()], (err, row) => {
    if (err) return res.status(500).json({ error: "Server error." });
    if (!row) return res.status(404).json({ error: "No account found with that email." });
    if (!bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: "Incorrect password." });
    }
    const token = jwt.sign({ userId: row.id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, userId: row.id, name: row.name });
  });
});

// ---------------- Task routes (all require a valid token) ----------------
app.get("/api/tasks", authMiddleware, (req, res) => {
  db.all(
    `SELECT * FROM tasks WHERE user_id = ? ORDER BY updated_at DESC`,
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Server error." });
      res.json(rows);
    }
  );
});

app.post("/api/tasks", authMiddleware, (req, res) => {
  const { title, category, priority, status, due } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required." });
  const now = Date.now();

  db.run(
    `INSERT INTO tasks (user_id, title, category, priority, status, due, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, title.trim(), category || "general", priority || "medium", status || "todo", due || "", now],
    function (err) {
      if (err) return res.status(500).json({ error: "Server error." });
      const task = {
        id: this.lastID,
        user_id: req.userId,
        title: title.trim(),
        category: category || "general",
        priority: priority || "medium",
        status: status || "todo",
        due: due || "",
        updated_at: now
      };
      io.to("user:" + req.userId).emit("task:created", task);
      res.json(task);
    }
  );
});

app.put("/api/tasks/:id", authMiddleware, (req, res) => {
  const { title, category, priority, status, due } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required." });
  const now = Date.now();

  db.run(
    `UPDATE tasks SET title=?, category=?, priority=?, status=?, due=?, updated_at=?
     WHERE id=? AND user_id=?`,
    [title.trim(), category, priority, status, due || "", now, req.params.id, req.userId],
    function (err) {
      if (err) return res.status(500).json({ error: "Server error." });
      if (this.changes === 0) return res.status(404).json({ error: "Task not found." });
      const task = {
        id: Number(req.params.id),
        user_id: req.userId,
        title: title.trim(),
        category,
        priority,
        status,
        due: due || "",
        updated_at: now
      };
      io.to("user:" + req.userId).emit("task:updated", task);
      res.json(task);
    }
  );
});

app.delete("/api/tasks/:id", authMiddleware, (req, res) => {
  db.run(`DELETE FROM tasks WHERE id=? AND user_id=?`, [req.params.id, req.userId], function (err) {
    if (err) return res.status(500).json({ error: "Server error." });
    if (this.changes === 0) return res.status(404).json({ error: "Task not found." });
    io.to("user:" + req.userId).emit("task:deleted", { id: Number(req.params.id) });
    res.json({ success: true });
  });
});

// ---------------- Real-time (Socket.io) ----------------
io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    socket.join("user:" + userId);
  });
});

// ---------------- Start server ----------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Planora server running at http://localhost:" + PORT);
});
