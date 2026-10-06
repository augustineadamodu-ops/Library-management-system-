const express = require("express");
const db = require("../config/database");
const { requireLogin, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const LOAN_PERIOD_DAYS = parseInt(process.env.LOAN_PERIOD_DAYS, 10) || 14;
const FINE_PER_DAY = parseInt(process.env.FINE_PER_DAY, 10) || 50;

// Calculates overdue fine in whole currency units (e.g. Naira) for a loan
function calculateFine(dueAt, returnedAt) {
  const due = new Date(dueAt);
  const endPoint = returnedAt ? new Date(returnedAt) : new Date();
  const msLate = endPoint - due;
  if (msLate <= 0) return 0;
  const daysLate = Math.ceil(msLate / (1000 * 60 * 60 * 24));
  return daysLate * FINE_PER_DAY;
}

// ---------- Borrow a book (member) ----------
router.post("/borrow/:bookId", requireLogin, (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.bookId);
  if (!book) return res.status(404).render("error", { title: "Not Found", message: "Book not found." });

  if (book.available_copies < 1) {
    return res.status(400).render("error", { title: "Unavailable", message: "No copies of this book are currently available." });
  }

  const alreadyBorrowed = db
    .prepare("SELECT id FROM loans WHERE book_id = ? AND user_id = ? AND status = 'borrowed'")
    .get(book.id, req.session.user.id);
  if (alreadyBorrowed) {
    return res.status(400).render("error", { title: "Already Borrowed", message: "You already have this book on loan." });
  }

  const borrowedAt = new Date();
  const dueAt = new Date(borrowedAt.getTime() + LOAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const insertLoan = db.transaction(() => {
    db.prepare("INSERT INTO loans (book_id, user_id, borrowed_at, due_at) VALUES (?, ?, ?, ?)").run(
      book.id,
      req.session.user.id,
      borrowedAt.toISOString(),
      dueAt.toISOString()
    );
    db.prepare("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?").run(book.id);
  });
  insertLoan();

  res.redirect("/loans/my-loans");
});

// ---------- Member's own loan history ----------
router.get("/my-loans", requireLogin, (req, res) => {
  const loans = db
    .prepare(
      `SELECT loans.*, books.title AS book_title, books.author AS book_author
       FROM loans JOIN books ON books.id = loans.book_id
       WHERE loans.user_id = ?
       ORDER BY loans.borrowed_at DESC`
    )
    .all(req.session.user.id);

  const loansWithFines = loans.map((loan) => ({
    ...loan,
    currentFine: loan.status === "borrowed" ? calculateFine(loan.due_at, null) : loan.fine_amount,
    isOverdue: loan.status === "borrowed" && new Date(loan.due_at) < new Date(),
  }));

  res.render("loans/my-loans", { title: "My Loans", loans: loansWithFines });
});

// ---------- All active + recent loans (admin) ----------
router.get("/", requireAdmin, (req, res) => {
  const loans = db
    .prepare(
      `SELECT loans.*, books.title AS book_title, users.name AS member_name, users.email AS member_email
       FROM loans
       JOIN books ON books.id = loans.book_id
       JOIN users ON users.id = loans.user_id
       ORDER BY loans.status ASC, loans.due_at ASC`
    )
    .all();

  const loansWithFines = loans.map((loan) => ({
    ...loan,
    currentFine: loan.status === "borrowed" ? calculateFine(loan.due_at, null) : loan.fine_amount,
    isOverdue: loan.status === "borrowed" && new Date(loan.due_at) < new Date(),
  }));

  res.render("loans/list", { title: "All Loans", loans: loansWithFines });
});

// ---------- Mark a loan as returned (admin) ----------
router.post("/:id/return", requireAdmin, (req, res) => {
  const loan = db.prepare("SELECT * FROM loans WHERE id = ?").get(req.params.id);
  if (!loan) return res.status(404).render("error", { title: "Not Found", message: "Loan not found." });
  if (loan.status === "returned") return res.redirect("/loans");

  const returnedAt = new Date().toISOString();
  const fine = calculateFine(loan.due_at, returnedAt);

  const processReturn = db.transaction(() => {
    db.prepare("UPDATE loans SET status = 'returned', returned_at = ?, fine_amount = ? WHERE id = ?").run(
      returnedAt,
      fine,
      loan.id
    );
    db.prepare("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?").run(loan.book_id);
  });
  processReturn();

  res.redirect("/loans");
});

module.exports = router;
