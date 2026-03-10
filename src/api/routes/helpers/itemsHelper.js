const db = require("../../../config/db");

// Get all normal items (for borrow page)
const getItems = (req, res) => {
  db.query("SELECT * FROM items WHERE `condition` = 'good' AND item_type = 'borrowable'", (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results);
  });
};

// Add new item (normal, holy, or preserved)
const addItem = (req, res) => {
  const { name, description, quantity, condition, reason, type } = req.body;
  console.log("Add Item Request Body:", req.body);

  // Basic validation
  if (!name || !description || !quantity || !type) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // ✅ Default values
  const itemCondition = condition || "good";

  // ✅ Handle based on type
  if (type === "normal") {
    // ---- Normal items (in `items` table)
    db.query(
      "SELECT * FROM items WHERE name = ? AND description = ?",
      [name, description, condition],
      (err, results) => {
        if (err) {
          console.error("❌ DB Select Error:", err);
          return res.status(500).json({ error: "Database error" });
        }

        // ⚠️ Allow if same name & description but *different condition*
        const sameCondition = results.find(
          (r) => r.condition?.toLowerCase() === itemCondition.toLowerCase()
        );

        if (sameCondition) {
          return res.status(400).json({
            error: "A normal item with the same name, description, and condition already exists.",
          });
        }

        db.query(
          "INSERT INTO items (name, description, quantity, `condition`, available, item_type) VALUES (?, ?, ?, ?, ?, 'borrowable')",
          [name, description, quantity, itemCondition, quantity],
          (err2) => {
            if (err2) {
              console.error("❌ DB Insert Error:", err2);
              return res.status(500).json({ error: "Failed to add normal item" });
            }
            res.json({ message: "✅ Normal item added successfully!" });
          }
        );
      }
    );
  } 
  
  else if (type === "holy") {
    // ---- Holy items (in `holy_items` table)
    db.query(
      "SELECT * FROM holy_items WHERE name = ? AND description = ?",
      [name, description, condition],
      (err, results) => {
        if (err) {
          console.error("❌ DB Select Error:", err);
          return res.status(500).json({ error: "Database error" });
        }

        // ⚠️ Allow if same name & description but *different condition*
        const sameCondition = results.find(
          (r) => r.condition?.toLowerCase() === itemCondition.toLowerCase()
        );

        if (sameCondition) {
          return res.status(400).json({
            error: "A holy item with the same name, description, and condition already exists.",
          });
        }

    

        db.query(
          "INSERT INTO holy_items (name, description, quantity) VALUES (?, ?, ?)",
          [name, description, quantity],
          (err2) => {
            if (err2) {
              console.error("❌ DB Insert Error:", err2);
              return res.status(500).json({ error: "Failed to add holy item" });
            }
            res.json({ message: "✅ Holy item added successfully!" });
          }
        );
      }
    );
  } 
  
  else if (type === "preserved") {
    // ---- Preserved items (in `preserved_items` table)
    const reasonText = reason || "Not specified";

    db.query(
      "SELECT * FROM preserved_items WHERE name = ? AND description = ?",
      [name, description, condition],
      (err, results) => {
        if (err) {
          console.error("❌ DB Select Error:", err);
          return res.status(500).json({ error: "Database error" });
        }

        // ⚠️ Allow entry even if same name & description but different reason
        const sameReason = results.find(
          (r) => r.reason?.toLowerCase() === reasonText.toLowerCase()
        );

        if (sameReason) {
          return res.status(400).json({
            error: "A preserved item with the same name, description, and reason already exists.",
          });
        }

        db.query(
          "INSERT INTO preserved_items (name, description, quantity, reason, created_at) VALUES (?, ?, ?, ?, NOW())",
          [name, description, quantity, reasonText],
          (err2) => {
            if (err2) {
              console.error("❌ DB Insert Error:", err2);
              return res.status(500).json({ error: "Failed to add preserved item" });
            }
            res.json({ message: "✅ Preserved item added successfully!" });
          }
        );
      }
    );
  } 
  
  else {
    res.status(400).json({ error: "Invalid item type" });
  }
};

module.exports = { getItems, addItem };
