const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

// Make sure the data folder exists before SQLite tries to create the file there
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "library.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------- Schema ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    genre TEXT,
    isbn TEXT,
    total_copies INTEGER NOT NULL DEFAULT 1,
    available_copies INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    borrowed_at TEXT NOT NULL DEFAULT (datetime('now')),
    due_at TEXT NOT NULL,
    returned_at TEXT,
    fine_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned'))
  );

  CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
  CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
  CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
`);

// ---------- Seed a default admin account on first run ----------
function seedAdmin() {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existingAdmin) return;

  const name = process.env.ADMIN_NAME || "Library Admin";
  const email = process.env.ADMIN_EMAIL || "admin@library.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')"
  ).run(name, email, passwordHash);

  console.log(`Seeded default admin account -> ${email} / ${password}`);
  console.log("Change this password after your first login.");
}

// ---------- Seed a handful of sample books so the catalog isn't empty ----------
function seedBooks() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM books").get().c;
  if (count > 0) return;

  const sampleBooks = [
    ["Things Fall Apart", "Chinua Achebe", "Classic Fiction", "9780385474542", 3],
    ["Half of a Yellow Sun", "Chimamanda Ngozi Adichie", "Historical Fiction", "9780007200283", 2],
    ["Clean Code", "Robert C. Martin", "Technology", "9780132350884", 2],
    ["Atomic Habits", "James Clear", "Self-Help", "9780735211292", 3],
    ["The Pragmatic Programmer", "Andrew Hunt", "Technology", "9780201616224", 2],
  ];

  const insert = db.prepare(
    "INSERT INTO books (title, author, genre, isbn, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const [title, author, genre, isbn, copies] of sampleBooks) {
    insert.run(title, author, genre, isbn, copies, copies);
  }
}

seedAdmin();
seedBooks();

module.exports = db;
