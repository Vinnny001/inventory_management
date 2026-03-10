// borrowHelper.js (transactional)
const db = require("../../../config/db");

// ---------------------------
// BORROW ITEM
// ---------------------------
const borrowItem = (req, res) => {
  const { user_id, item_id } = req.body;
  if (!user_id || !item_id)
    return res.status(400).json({ message: "user_id and item_id required" });

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ error: err });

    const updateSql = `
      UPDATE items
      SET available = available - 1
      WHERE item_id = ? AND available > 0 AND is_borrowable = 1
    `;

    db.query(updateSql, [item_id], (err1, result) => {
      if (err1) return db.rollback(() => res.status(500).json({ error: err1 }));

      if (result.affectedRows === 0) {
        // Determine why no update occurred
        return db.rollback(() => {
          db.query("SELECT * FROM items WHERE item_id = ?", [item_id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2 });
            if (rows.length === 0) {
              db.query("SELECT * FROM holy_items WHERE holy_item_id = ?", [item_id], (err3, holyRows) => {
                if (err3) return res.status(500).json({ error: err3 });
                if (holyRows.length > 0)
                  return res.status(403).json({ message: "This is a holy item and cannot be borrowed!" });
                return res.status(404).json({ message: "Item does not exist!" });
              });
            } else {
              return res.status(400).json({ message: "Item not available or cannot be borrowed!" });
            }
          });
        });
      }

      // Insert borrow record
      const insertSql = "INSERT INTO borrows (user_id, item_id) VALUES (?, ?)";
      db.query(insertSql, [user_id, item_id], (err4) => {
        if (err4) return db.rollback(() => res.status(500).json({ error: err4 }));

        db.commit(commitErr => {
          if (commitErr)
            return db.rollback(() => res.status(500).json({ error: commitErr }));
          return res.json({ message: "Item borrowed successfully!" });
        });
      });
    });
  });
};

// ---------------------------
// GET BORROWED ITEMS
// ---------------------------
const getBorrowedItems = (req, res) => {
  const userId = req.session?.user?.user_id;
  const accessLevel = req.session?.user?.access_level;

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const sql = `
    SELECT 
      b.borrow_id,
      b.item_id,
      i.name,
      b.borrow_date,
      b.return_date,
      b.status
    FROM borrows b
    JOIN items i ON b.item_id = i.item_id
    ${accessLevel === "admin" ? "" : "WHERE b.user_id = ?"}
    ORDER BY b.borrow_date DESC
  `;

  const params = accessLevel === "admin" ? [] : [userId];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Error fetching borrowed items:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
};

module.exports = { borrowItem, getBorrowedItems };
