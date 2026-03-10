const db = require("../../../config/db");

// ---------------------------
// GET BORROW HISTORY
// (borrowed/returned + rejected)
// ---------------------------
const getBorrowHistory = (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const sql = `
      SELECT *
      FROM (
        SELECT 
          b.borrow_id AS id,
          b.item_id,
          i.name,
          b.borrow_date,
          b.return_date,
          b.status,
          b.borrow_date AS activity_date
        FROM borrows b
        JOIN items i ON b.item_id = i.item_id
        WHERE b.user_id = ? AND b.status != 'due'  -- exclude items not yet returned or approved

        UNION ALL

        SELECT 
          r.reject_id AS id,
          r.item_id,
          i.name,
          NULL AS borrow_date,
          NULL AS return_date,
          'rejected' AS status,
          r.rejected_date AS activity_date
        FROM rejected r
        JOIN items i ON r.item_id = i.item_id
        WHERE r.user_id = ?
      ) AS history
      ORDER BY activity_date DESC
    `;

    db.query(sql, [userId, userId], (err, results) => {
      if (err) {
        console.error("Error fetching borrow history:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(results);
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Unexpected server error" });
  }
};

module.exports = { getBorrowHistory };
