function requireAdmin(req, res, next) {
  if (req.user.access_level !== "admin") {
    return res.redirect("/api/dashboard.html");
  }
  next();
}
