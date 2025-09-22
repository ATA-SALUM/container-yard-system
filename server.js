const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const session = require("express-session");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Ensure data folder exists
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

// Database
const dbPath = path.join(__dirname, "data", "containers.db");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Database error:", err);
    else console.log("Connected to SQLite database");
});

// Create tables
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  origin TEXT,
  destination TEXT,
  rowPos INTEGER,
  colPos INTEGER,
  owner TEXT
)
`);

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));

// Session
app.use(session({
    secret: "container_secret_key",
    resave: false,
    saveUninitialized: true
}));

// Auth middleware
function isAuthenticated(req, res, next) {
    if (req.session.user) next();
    else res.redirect("/login");
}

// Routes
app.get("/", (req, res) => res.render("index"));

// REGISTER
app.get("/register", (req, res) => res.render("register"));
app.post("/register", (req, res) => {
    const username = req.body.username.trim().toLowerCase();
    const password = req.body.password.trim();
    if (!username || !password) return res.send("Invalid input");

    db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], (err) => {
        if (err) {
            console.error(err);
            return res.send("Username already exists");
        }
        req.session.user = username; // auto-login
        res.redirect("/dashboard");
    });
});

// LOGIN
app.get("/login", (req, res) => res.render("login"));
app.post("/login", (req, res) => {
    const username = req.body.username.trim().toLowerCase();
    const password = req.body.password.trim();

    db.get("SELECT * FROM users WHERE username=? AND password=?", [username, password], (err, row) => {
        if (err) console.error(err);
        if (row) {
            req.session.user = row.username;
            res.redirect("/dashboard");
        } else {
            res.send("Invalid username or password");
        }
    });
});

// LOGOUT
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// DASHBOARD
app.get("/dashboard", isAuthenticated, (req, res) => {
    db.all("SELECT * FROM containers", (err, rows) => {
        if (err) throw err;
        res.render("dashboard", { containers: rows, user: req.session.user });
    });
});

// ADD CONTAINER
app.get("/add", isAuthenticated, (req, res) => {
    const rows = 5;
    const cols = 5;
    res.render("addContainer", { rows, cols });
});
app.post("/add", isAuthenticated, (req, res) => {
    const { number, origin, destination, rowPos, colPos, owner } = req.body;
    db.run(
        `INSERT INTO containers (number, origin, destination, rowPos, colPos, owner)
     VALUES (?, ?, ?, ?, ?, ?)`, [number, origin, destination, rowPos, colPos, owner],
        (err) => {
            if (err) console.error(err);
            res.redirect("/dashboard");
        }
    );
});

// SEARCH CONTAINER
app.get("/search", isAuthenticated, (req, res) => res.render("search", { result: null }));
app.post("/search", isAuthenticated, (req, res) => {
    const number = req.body.number.trim();
    db.get("SELECT * FROM containers WHERE number=?", [number], (err, row) => {
        if (err) console.error(err);
        res.render("search", { result: row || false });
    });
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));