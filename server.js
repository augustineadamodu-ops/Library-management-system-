require("dotenv").config();
const express = require("express");
const session = require("express-session");
const methodOverride = require("method-override");
const path = require("path");

require("./config/database"); // initializes DB + seeds default admin/books on first run
const { attachUser } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");
const loanRoutes = require("./routes/loans");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- View engine ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---------- Core middleware ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method")); // lets HTML forms send PUT/DELETE via ?_method=
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
  })
);

app.use(attachUser);

// ---------- Routes ----------
app.get("/", (req, res) => res.redirect("/books"));
app.use("/auth", authRoutes);
app.use("/books", bookRoutes);
app.use("/loans", loanRoutes);
app.use("/admin", adminRoutes);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render("error", { title: "Page Not Found", message: "That page doesn't exist." });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", { title: "Server Error", message: "Something went wrong. Please try again." });
});

app.listen(PORT, () => {
  console.log(`Library Management System running at http://localhost:${PORT}`);
});
