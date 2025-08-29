const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();
const router = require("../src/api/routes/routers"); // Import routes

const app = express();
const PORT = 3000;



// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../src/views/public/frontend"))); // Serve HTML/CSS/JS

// Use API routes
app.use("/api", router);

// Default route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../src/views/public/frontend", "index.html"));
});

// ---------------- SERVER ----------------

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
