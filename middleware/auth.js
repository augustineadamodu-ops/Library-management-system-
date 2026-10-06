// Makes the logged-in user (if any) available to every view as `currentUser`
function attachUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

// Blocks access unless the user is logged in
function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect("/auth/login");
  }
  next();
}

// Blocks access unless the logged-in user is an admin/librarian
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).render("error", {
      title: "Access Denied",
      message: "You need librarian/admin access to view this page.",
    });
  }
  next();
}

module.exports = { attachUser, requireLogin, requireAdmin };
