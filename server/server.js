const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const router = require("../src/api/routes/routers"); // Import routes

const app = express();
const PORT = 3005;


//const { authMiddleware } = require("../src/api/middlewares/auth");



// Middleware
app.use(cookieParser());
app.use(cors());
app.use(bodyParser.json());

// Default route
app.get("/", (req, res) => {
    console.log("Root route accessed. There's a visitor...");
    res.sendFile(path.join(__dirname, "../src/views/public/frontend", "index.html"));
});


app.use(express.static(path.join(__dirname, "../src/views/public/frontend"))); // Serve HTML/CSS/JS

// Use API routes
app.use("/api", router);


// --------------- - SERVER ----------------

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}\n \n..............................`);
});
