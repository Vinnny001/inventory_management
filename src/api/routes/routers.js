const express = require("express");
const router = express.Router();
const db = require("../../config/db");
const bcrypt = require("bcrypt");

// ---------------- ROUTES ----------------

// Test route
router.get("/test", (req, res) => {
    res.json({ message: "Server is running with MySQL!" });
});

// ---------------- USERS ----------------
router.post("/register", async (req, res) => {
    const { username, email, phone_number, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
  "INSERT INTO users (username, email, phone_number, password) VALUES (?, ?, ?, ?)",
  [username, email, phone_number, hashedPassword],
  (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ 
          error: "Email or phone number already exists" 
        });
      }
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ 
      message: "User registered successfully!", 
      user_id: result.insertId 
    });
  }
);

    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.json({ message: "Login successful", user });
    });
});


// ---------------- ITEMS ----------------
router.get("/items", (req, res) => {
    db.query("SELECT * FROM items", (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

router.post("/items", (req, res) => {
    const { name, description, quantity } = req.body;
    db.query(
        "INSERT INTO items (name, description, quantity, available) VALUES (?, ?, ?, ?)",
        [name, description, quantity, quantity],
        (err, result) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ message: "Item added successfully!" });
        }
    );
});

// ---------------- BORROW ----------------
router.post("/borrow", (req, res) => {
    const { user_id, item_id } = req.body;

    db.query("SELECT available FROM items WHERE item_id = ?", [item_id], (err, results) => {
        if (err) return res.status(500).json({ error: err });

        if (results.length > 0 && results[0].available > 0) {
            db.query("INSERT INTO borrows (user_id, item_id) VALUES (?, ?)", [user_id, item_id]);
            db.query("UPDATE items SET available = available - 1 WHERE item_id = ?", [item_id]);
            res.json({ message: "Item borrowed successfully!" });
        } else {
            res.status(400).json({ message: "Item not available!" });
        }
    });
});

// ---------------- RETURN ----------------
router.post("/return", (req, res) => {
    const { borrow_id, item_id } = req.body;

    db.query(
        "UPDATE borrows SET status='returned', return_date=NOW() WHERE borrow_id = ?",
        [borrow_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err });

            db.query("UPDATE items SET available = available + 1 WHERE item_id = ?", [item_id]);
            res.json({ message: "Item returned successfully!" });
        }
    );
});

module.exports = router;
