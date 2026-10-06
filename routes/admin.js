const express = require("express");
const db = require("../config/database");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", requireAdmin, (req, res) => {
  const totalBooks = db.prepare("SELECT COALESCE(SUM(total_copies), 0) AS n FROM books").get().n;
  const availableCopies = db.prepare("SELECT COALESCE(SUM(available_copies), 0) AS n FROM books").get().n;
  const totalTitles = db.prepare("SELECT COUNT(*) AS n FROM books").get().n;
  const activeMembers = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'member'").get().n;

  const activeLoans = db.prepare("SELECT COUNT(*) AS n FROM loans WHERE status = 'borrowed'").get().n;

  const overdueLoans = db
    .prepare("SELECT COUNT(*) AS n FROM loans WHERE status = 'borrowed' AND due_at < datetime('now')")
    .get().n;

  const finesCollected = db
    .prepare("SELECT COALESCE(SUM(fine_amount), 0) AS n FROM loans WHERE status = 'returned'")
    .get().n;

  const mostBorrowed = db
    .prepare(
      `SELECT books.title, books.author, COUNT(loans.id) AS times_borrowed
       FROM loans JOIN books ON books.id = loans.book_id
       GROUP BY loans.book_id
       ORDER BY times_borrowed DESC
       LIMIT 5`
    )
    .all();

  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    stats: {
      totalTitles,
      totalBooks,
      availableCopies,
      activeMembers,
      activeLoans,
      overdueLoans,
      finesCollected,
    },
    mostBorrowed,
  });
});

module.exports = router;
