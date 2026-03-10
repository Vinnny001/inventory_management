// controllers/inventoryController.js
const db = require("../config/db");

exports.updateItemsBatch = async (req, res) => {
console.log("🔵 Received /update-items-batch request");
console.log("Body:", req.body);


  const { updates, type } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: "No updates provided" });
  }

  // Table and PK mapping (explicit)
  let table, idColumn;
  if (type === "holy") {
    table = "holy_items";
    idColumn = "holy_item_id";
  } else if (type === "preserved") {
    table = "preserved_items";
    idColumn = "preserved_id";
  } else {
    table = "items";
    idColumn = "item_id";
  }

  console.log("🟡 Incoming updates:", updates);

  try {
    for (const item of updates) {
      // Accept partial objects
      const {
        id,
        name = null,
        description = null,
        condition = null,
        quantity = null,
        reason = null,   // for preserved_items if needed
        _action = "update" // default to update if omitted
      } = item;

      // Parse quantity only if provided
      const hasQuantity = quantity !== null && quantity !== undefined && quantity !== "";
      const safeQty = hasQuantity ? parseInt(quantity, 10) || 0 : null;

      // ---------- ADD ----------
      if (_action === "add") {
        // For preserved_items include reason column if present
        if (table === "preserved_items") {
          await db.promise().query(
            `INSERT INTO ${table} (name, description, \`condition\`, quantity, reason, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
            [name, description, condition, safeQty || 0, reason || null]
          );
        } else if (table === "items") {
          await db.promise().query(
            `INSERT INTO ${table} (name, description, \`condition\`, quantity, available, item_type) VALUES (?, ?, ?, ?, ?, 'borrowable')`,
            [name, description, condition, safeQty || 0, safeQty || 0]
          );
        } else {
          // holy_items
          await db.promise().query(
            `INSERT INTO ${table} (name, description, \`condition\`, quantity) VALUES (?, ?, ?, ?)`,
            [name, description, condition, safeQty || 0]
          );
        }
        continue;
      }

      // ---------- DELETE ----------
      if (_action === "delete" && id) {
        const [delRes] = await db.promise().query(
          `DELETE FROM ${table} WHERE ${idColumn} = ?`,
          [id]
        );
        console.log(`Deleted ${delRes.affectedRows} row(s) from ${table} id=${id}`);
        continue;
      }

      // ---------- UPDATE ----------
      if ((_action === "update" || !_action) && id) {
        // Build dynamic update: only include provided columns
        const setParts = [];
        const params = [];

        if (name !== null) {
          setParts.push("name = ?");
          params.push(name);
        }
        if (description !== null) {
          setParts.push("description = ?");
          params.push(description);
        }
        if (condition !== null) {
          setParts.push("`condition` = ?");
          params.push(condition);
        }
        if (hasQuantity) {
          setParts.push("quantity = ?");
          params.push(safeQty);
          // For items table also sync available if you want to keep them equal
          if (table === "items") {
            setParts.push("available = ?");
            params.push(safeQty);
          }
        }

        if (setParts.length === 0) {
          // Nothing to update for this row
          console.log(`No update fields for id=${id}, skipping`);
          continue;
        }

        // finalize query
        const sql = `UPDATE ${table} SET ${setParts.join(", ")} WHERE ${idColumn} = ?`;
        params.push(id);

        const [result] = await db.promise().query(sql, params);
        console.log(`Updated ${result.affectedRows} row(s) in ${table} for id=${id}`);
      }
    } // for loop

    return res.json({ message: "✅ Items successfully synchronized with the database" });
  } catch (err) {
    console.error("❌ Batch update error:", err);
    return res.status(500).json({ error: "Failed to update items" });
  }
};
