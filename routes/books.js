const express = require("express");
const db = require("../config/database");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// ---------- List + search catalog ----------
router.get("/", (req, res) => {
  const q = (req.query.q || "").trim();
  let books;

  if (q) {
    const like = `%${q}%`;
    books = db
      .prepare(
        `SELECT * FROM books
         WHERE title LIKE ? OR author LIKE ? OR genre LIKE ?
         ORDER BY title ASC`
      )
      .all(like, like, like);
  } else {
    books = db.prepare("SELECT * FROM books ORDER BY title ASC").all();
  }

  // If the member is logged in, flag which books they already currently have on loan
  let activeLoanBookIds = new Set();
  if (req.session.user && req.session.user.role === "member") {
    const rows = db
      .prepare("SELECT book_id FROM loans WHERE user_id = ? AND status = 'borrowed'")
      .all(req.session.user.id);
    activeLoanBookIds = new Set(rows.map((r) => r.book_id));
  }

  res.render("books/list", {
    title: "Book Catalog",
    books,
    q,
    activeLoanBookIds,
  });
});

// ---------- Show add-book form (admin) ----------
router.get("/new", requireAdmin, (req, res) => {
  res.render("books/form", { title: "Add Book", book: null, error: null });
});

// ---------- Create book (admin) ----------
router.post("/", requireAdmin, (req, res) => {
  const { title, author, genre, isbn, total_copies } = req.body;
  const copies = Math.max(1, parseInt(total_copies, 10) || 1);

  if (!title || !author) {
    return res.render("books/form", { title: "Add Book", book: req.body, error: "Title and author are required." });
  }

  db.prepare(
    "INSERT INTO books (title, author, genre, isbn, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(title.trim(), author.trim(), (genre || "").trim(), (isbn || "").trim(), copies, copies);

  res.redirect("/books");
});

// ---------- Show edit-book form (admin) ----------
router.get("/:id/edit", requireAdmin, (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).render("error", { title: "Not Found", message: "Book not found." });
  res.render("books/form", { title: "Edit Book", book, error: null });
});

// ---------- Update book (admin) ----------
router.put("/:id", requireAdmin, (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).render("error", { title: "Not Found", message: "Book not found." });

  const { title, author, genre, isbn, total_copies } = req.body;
  const newTotal = Math.max(1, parseInt(total_copies, 10) || 1);

  // Keep available_copies consistent when the librarian changes total stock
  const borrowedOut = book.total_copies - book.available_copies;
  const newAvailable = Math.max(0, newTotal - borrowedOut);

  db.prepare(
    "UPDATE books SET title = ?, author = ?, genre = ?, isbn = ?, total_copies = ?, available_copies = ? WHERE id = ?"
  ).run(title.trim(), author.trim(), (genre || "").trim(), (isbn || "").trim(), newTotal, newAvailable, req.params.id);

  res.redirect("/books");
});

// ---------- Delete book (admin) ----------
router.delete("/:id", requireAdmin, (req, res) => {
  const activeLoans = db
    .prepare("SELECT COUNT(*) AS c FROM loans WHERE book_id = ? AND status = 'borrowed'")
    .get(req.params.id).c;

  if (activeLoans > 0) {
    return res.status(400).render("error", {
      title: "Cannot Delete",
      message: "This book has active loans and cannot be deleted until all copies are returned.",
    });
  }

  db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  res.redirect("/books");
});

module.exports = router;
