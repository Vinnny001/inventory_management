const cookieParser = require("cookie-parser");

const jwt = require("jsonwebtoken");
const SECRET_KEY = "your_secret_key";

function authMiddleware(req, res, next) {
    const token = req.cookies.authToken; // comes from HttpOnly cookie
    if (!token) return res.redirect("/login.html");;

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: "Invalid token" });
    }
}

module.exports = { authMiddleware };
