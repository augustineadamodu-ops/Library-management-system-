const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/database");

const router = express.Router();

// ---------- Show register form ----------
router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("auth/register", { title: "Create Account", error: null });
});

// ---------- Handle registration ----------
router.post("/register", (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password) {
    return res.render("auth/register", { title: "Create Account", error: "All fields are required." });
  }
  if (password !== confirmPassword) {
    return res.render("auth/register", { title: "Create Account", error: "Passwords do not match." });
  }
  if (password.length < 6) {
    return res.render("auth/register", { title: "Create Account", error: "Password must be at least 6 characters." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (existing) {
    return res.render("auth/register", { title: "Create Account", error: "An account with that email already exists." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'member')")
    .run(name.trim(), email.toLowerCase().trim(), passwordHash);

  req.session.user = { id: result.lastInsertRowid, name: name.trim(), email, role: "member" };
  res.redirect("/");
});

// ---------- Show login form ----------
router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("auth/login", { title: "Login", error: null });
});

// ---------- Handle login ----------
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.render("auth/login", { title: "Login", error: "Invalid email or password." });
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  const redirectTo = req.session.returnTo || "/";
  delete req.session.returnTo;
  res.redirect(redirectTo);
});

// ---------- Logout ----------
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

module.exports = router;
