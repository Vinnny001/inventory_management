const express = require("express");
const router = express.Router();
const db = require("../../config/db");
const bcrypt = require("bcrypt");
const path = require("path");

const jwt = require("jsonwebtoken");
const SECRET_KEY = "your_secret_key";

const { authMiddleware } = require("../../../src/api/middlewares/auth");
const { updateItemsBatch } = require("../../controllers/inventoryController");


const crypto = require("crypto");


// ---------------- ROUTES ----------------
const { getItems, addItem } = require("./helpers/itemsHelper.js");
const { getHolyItems, addHolyItem } = require("./helpers/holyItemsHelper.js");
const { getBorrowHistory } = require("./helpers/borrowedItems.js");
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUserRole,
  deleteUser
} = require("./helpers/users");

const {
  sendSingleApprovalEmails,
  sendBatchApprovalEmails,
  sendCheckoutConfirmationEmail,
  sendCheckoutSuccessEmail,
  sendReturnRequestEmailToAdmins,
} = require("./helpers/emails.js");



function requireAdmin(req, res, next) {
  if (req.user.access_level !== "admin") {
    return res.redirect("/api/dashboard.html");
  }
  next();
}


// Test route
router.get("/test", (req, res) => {
    res.json({ message: "Server is running with MySQL!" });
});

router.get("/borrow-list_cart.html", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/private", "borrow-list_cart.html"));
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

router.post("/login", async (req, res) => {
    console.log("Login called");
    for (let i = 0; i < 3; i++) {
  console.log("Login attempt:", i);
  await new Promise(r => setTimeout(r, 1000));

}

    
    const { email, password } = req.body;
    let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    let place= "Unknown location";

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          console.log("Password mismatch for user:", email,"\n \t LOGIN LOCATION DETAILS:\n \t IP ADRESS:", ip, "\n \t USER AGENT:", req.headers["user-agent"], "\n \t TIME:", new Date().toISOString(), "\n \t ADRESS:", place, "\n \t -----------------------------------");
            return res.status(401).json({ message: "Invalid credentials" });
        }

        console.log("Successful user login:", email, "\n \t LOGIN LOCATION DETAILS:\n \t IP ADRESS:", ip, "\n \t USER AGENT:", req.headers["user-agent"], "\n \t TIME:", new Date().toISOString(), "\n \t ADRESS:", place, "\n \t -----------------------------------");

        // ✅ Generate token
        const token = jwt.sign(
            { id: user.user_id, email: user.email, access_level: user.access_level }, 
            SECRET_KEY, 
            { expiresIn: "1h" }
        );

        // ✅ Store token in HttpOnly cookie (frontend JS cannot access it)
        res.cookie("authToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 3600000 // 1h
        });
        

        // ✅ Redirect handled by server
        res.redirect("/api/dashboard.html");
    });
});

router.get("/dashboard.html", authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, "../../views/private", "dashboard.html"));
    console.log("User info from token:", req.user);
});

router.get("/borrow.html", authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, "../../views/private", "borrow.html"));
    console.log("User info from token:", req.user);
});

// routes/routers.js
router.get("/me", authMiddleware, (req, res) => {
    console.log("me route called");
  res.json({
    id: req.user.id,
    email: req.user.email,
    access_level: req.user.access_level
  });
});



// ---------------- ADMIN: USERS ----------------
// ---------------- ADMIN: USERS ----------------
router.get("/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);   // ✅ send users to frontend
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.put("/users/:id/role", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const updated = await updateUserRole(req.params.id, req.body.access_level);
    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating user role:", err);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

router.delete("/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteUser(req.params.id);
    res.json(deleted);
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});


router.get("/users.html", authMiddleware, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/private", "users.html"));
});


router.get("/my_items.html", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/private", "my_items.html"));
});




// ---------------- ITEMS ----------------
router.get("/add-item.html", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/private", "add-item.html"));
});

router.get("/items", getItems);
//add category route
router.get("/add-category.html", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/private", "add-category.html"));
});


//add new item
router.post("/items", addItem);


// Fetch item names for autocomplete
router.get("/items-list", authMiddleware, requireAdmin, (req, res) => {
  const { type } = req.query;
  let table;

  if (type === "holy") table = "holy_items";
  else if (type === "preserved") table = "preserved_items";
  else table = "items";

  db.query(`SELECT name FROM ${table}`, (err, results) => {
    if (err) {
      console.error("❌ Error fetching items list:", err);
      return res.status(500).json({ error: "Failed to fetch items" });
    }
    res.json(results);
  });
});


// Update item quantity
router.post("/update-item", authMiddleware, requireAdmin, (req, res) => {
  const { type, name, quantity, action } = req.body;

  let table;
  if (type === "holy") table = "holy_items";
  else if (type === "preserved") table = "preserved_items";
  else table = "items";

  db.query(`SELECT quantity${table === "items" ? ", available" : ""} FROM ${table} WHERE name = ?`, [name], (err, results) => {
    if (err) {
      console.error("❌ Error selecting item:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    let newQty = results[0].quantity;
    if (action === "add") newQty += quantity;
    else if (action === "subtract") newQty -= quantity;
    else if (action === "replace") newQty = quantity;

    if (newQty < 0) newQty = 0;

    // If it's a normal item → update both quantity and available
    if (table === "items") {
      let newAvailable = newQty; // ✅ sync available with quantity
      db.query(`UPDATE ${table} SET quantity = ?, available = ? WHERE name = ?`, [newQty, newAvailable, name], (err2) => {
        if (err2) {
          console.error("❌ Error updating item:", err2);
          return res.status(500).json({ error: "Failed to update item" });
        }
        res.json({ message: `✅ Item updated. New quantity: ${newQty}, Available: ${newAvailable}` });
      });
    } else {
      // holy_items or preserved_items → only update quantity
      db.query(`UPDATE ${table} SET quantity = ? WHERE name = ?`, [newQty, name], (err2) => {
        if (err2) {
          console.error("❌ Error updating item:", err2);
          return res.status(500).json({ error: "Failed to update item" });
        }
        res.json({ message: `✅ Item updated. New quantity: ${newQty}` });
      });
    }
  });
});




router.post("/update-items-batch", authMiddleware, requireAdmin, updateItemsBatch);






router.get("/holy-items", getHolyItems);
//add new holy item
router.post("/holy-items", addHolyItem);





// ===================== BORROWED ITEMS (admin View) =====================
//Load borrowed-all.html
router.get("/borrowed-all.html", authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, "../../views/private", "borrowed-all.html"));
    
});





// ✅ Get borrowed items (Admin Only)
router.get("/borrowed/all", authMiddleware, requireAdmin, (req, res) => {
  console.log("Fetching all borrowed items for admin");

  const sql = `
    SELECT 
      b.borrow_id,
      u.username AS user_name,
      u.email,
      u.phone_number,
      i.name AS item_name,
      b.borrow_date,
      b.return_date,
      b.status
    FROM borrows b
    JOIN users u ON b.user_id = u.user_id
    JOIN items i ON b.item_id = i.item_id
    ORDER BY b.borrow_date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching borrowed items:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});





// ===================== BORROWED ITEMS (User View) =====================

router.get("/my_items_history", authMiddleware, getBorrowHistory);


//track_requests
router.get("/track_requests.html", authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, "../../views/private", "track_requests.html"));
    
});


//pending and active requests
/// Get pending requests
router.get("/my_pending_requests", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT r.*, i.name 
    FROM request_status r
    JOIN items i ON r.item_id = i.item_id
    WHERE r.user_id = ? AND r.status = 'pending'
    ORDER BY r.request_date DESC
  `;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(results);
  });
});

// Get active borrows (approved or due)
router.get("/my_active_borrows", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT b.*, i.name 
    FROM borrows b
    JOIN items i ON b.item_id = i.item_id
    WHERE b.user_id = ? AND b.status IN ('approved','due')
    ORDER BY b.borrow_date DESC
  `;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(results);
  });
});

// Cancel pending request
router.post("/cancel_request/:id", authMiddleware, (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM request_status WHERE request_id = ? AND status='pending'", [id], err => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ success: true });
  });
});

// Mark as returned
router.post("/request-return/:borrow_id", authMiddleware, async (req, res) => {
  const borrow_id = req.params.borrow_id;
  const user_id = req.user.id;

  try {
    // Fetch borrow + item + approval code
    const [[borrow]] = await db.promise().query(
      `
      SELECT 
        b.borrow_id,
        b.quantity,
        b.item_id,
        rs.approval_code,
        i.name AS item_name,
        u.username,
        u.email,
        u.phone_number
      FROM borrows b
      JOIN request_status rs ON rs.user_id = b.user_id AND rs.item_id = b.item_id
      JOIN items i ON i.item_id = b.item_id
      JOIN users u ON u.user_id = b.user_id
      WHERE b.borrow_id = ? AND b.user_id = ?
      `,
      [borrow_id, user_id]
    );

    if (!borrow) {
      return res.status(404).json({ error: "Borrow record not found" });
    }

    // 📧 SEND EMAIL TO ADMINS ONLY
    await sendReturnRequestEmailToAdmins(borrow, req.user.email);

    res.json({
      success: true,
      message: "Return request sent to admins. Please wait for confirmation."
    });

  } catch (err) {
    console.error("❌ Return request failed:", err);
    res.status(500).json({ error: "Failed to send return request" });
  }
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

router.post("/logout", (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });
  res.json({ message: "Logged out successfully" });
});


// ---------------- CART ----------------
router.post("/cart", authMiddleware, (req, res) => {
  const user_id = req.user.id; // ✅ FROM TOKEN
  const { item_id, quantity } = req.body;

  console.log("Add to cart:", { user_id, item_id, quantity });

  if (!item_id) {
    return res.status(400).json({ error: "Missing item_id" });
  }

  const sql = `
    INSERT INTO borrow_cart (user_id, item_id, quantity, added_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
  `;

  db.query(sql, [user_id, item_id, quantity || 1], (err) => {
    if (err) {
      console.error("❌ Error inserting cart item:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Item added to cart" });
  });
});






// ---------------- BORROW LIST (User's cart items) ----------------
router.get("/borrow-list_cart", authMiddleware, (req, res) => {
  const user_id = req.user.id; // from JWT token

  const sql = `
    SELECT 
      bc.cart_id,
      i.item_id,
      i.name AS item_name,
      i.description,
      i.available,
      i.max_period,        
      bc.quantity,
      bc.added_at
    FROM borrow_cart bc
    JOIN items i ON bc.item_id = i.item_id
    WHERE bc.user_id = ?
    ORDER BY bc.added_at DESC
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("❌ Error loading borrow list:", err);
      return res.status(500).json({ error: "Error loading borrow list" });
    }

    res.json(results);
  });
});



// ---------------- REMOVE FROM CART ----------------
router.delete("/remove-from-cart", authMiddleware, (req, res) => {
  const { cart_ids } = req.body;
  const user_id = req.user.id;

  if (!cart_ids || !Array.isArray(cart_ids) || !cart_ids.length) {
    return res.status(400).json({ error: "No items selected" });
  }

  const sql = `
    DELETE FROM borrow_cart
    WHERE user_id = ? AND cart_id IN (${cart_ids.map(() => "?").join(",")})
  `;

  db.query(sql, [user_id, ...cart_ids], (err, result) => {
    if (err) {
      console.error("❌ Error removing items from cart:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Items removed successfully" });
  });
});




// Count items in cart (for badge)
router.get("/cart/count", authMiddleware, (req, res) => {
  const user_id = req.user.id;

  db.query(
    "SELECT COALESCE(SUM(quantity), 0) AS count FROM borrow_cart WHERE user_id = ?",
    [user_id],
    (err, results) => {
      if (err) {
        console.error("❌ Error fetching cart count:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ count: results[0].count });
    }
  );
});




// ---------------- CONFIRM CHECKOUT (from email link) ----------------

router.get("/confirm_checkout", async (req, res) => {
  const { token } = req.query;


  const conn = await db.promise().getConnection();



  if (!token) return res.status(400).send("Invalid link.");

  try {
    await conn.beginTransaction();

const [rows] = await conn.query(
  "SELECT * FROM checkout_confirmations WHERE token = ? FOR UPDATE",
  [token]
);



if (!rows.length) {
  // Check invalid_requests table
  const [[invalid]] = await conn.query(
    `SELECT invalid_reason FROM invalid_requests WHERE token = ? LIMIT 1`,
    [token]
  );

  if (invalid) {
    if (invalid.invalid_reason === "used") {
      return res.status(400).send("❌ This link has already been used.");
    }

    if (invalid.invalid_reason === "expired") {
      return res.status(400).send("⏰ This link has expired.");
    }
  }

  // Not found anywhere
  return res.status(400).send("❌ Invalid confirmation link.");
}



    const confirmation = rows[0];
    

    const items =
  typeof confirmation.items === "string"
    ? JSON.parse(confirmation.items)
    : confirmation.items;


    for (const item of items) {
  if (!item.name) {
    const [[row]] = await conn.query(
      "SELECT name FROM items WHERE item_id = ?",
      [item.item_id]
    );
    item.name = row?.name || "Unknown item";
  }
}



    // Insert into request_status table
    for (const item of items) {
  const approvalCode = Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase();

  const today = new Date();
  const period = Number(item.borrow_days);

if (!Number.isInteger(period) || period < 1) {
  throw new Error("Invalid borrow period");
}

  await conn.query(
    `INSERT INTO request_status 
      (batch_code, user_id, item_id, quantity, request_date, period, status, approval_code)
     VALUES (?, ?, ?, ?, NOW(), ?, 'pending', ?)`,
    [
      confirmation.batch_code,
      confirmation.user_id,
      item.item_id,
      item.quantity,
      period,
      approvalCode
    ]
  );

  //attach approval code for email use
  item.approval_code = approvalCode;
}

    // Mark confirmation as used
    

// Fetch user details to include in email

    const [[user]] = await conn.query(
  "SELECT email, username, access_level FROM users WHERE user_id = ?",
  [confirmation.user_id]
);


if (!user) {
  throw new Error("User not found for confirmation email");
}








// 🔁 MOVE token to invalid_requests (USED)
await conn.query(
  `INSERT INTO invalid_requests
   (original_id, user_id, batch_code, items, token, expires_at, invalid_reason)
   VALUES (?, ?, ?, ?, ?, ?, 'used')`,
  [
    confirmation.id,
    confirmation.user_id,
    confirmation.batch_code,
    JSON.stringify(items), // ✅ STRINGIFY
    confirmation.token,
    confirmation.expires_at
  ]
);


// DELETE from active table
await conn.query(
  "DELETE FROM checkout_confirmations WHERE id = ?",
  [confirmation.id]
);









// Send success email

await sendCheckoutSuccessEmail({
  user,
  confirmation,
  items,
});




await conn.commit();



    res.send("✅ Checkout confirmed successfully!");
  } catch (err) {
  await conn.rollback();
  console.error("❌ Confirm checkout failed:", err);
  res.status(500).send("Checkout confirmation failed.");
} finally {
  conn.release();
}
});







router.post("/checkout", authMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { items } = req.body;

  // 1️⃣ Basic payload validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      code: "NO_ITEMS",
      message: "No items selected for checkout"
    });
  }

  try {
    // 2️ Validate & enrich user input FIRST
    for (const item of items) {
      if (!item.item_id || !item.quantity || !item.borrow_days || !item.cart_id) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ITEM_DATA",
          message: "Invalid item data provided"
        });
      }

      if (item.quantity < 1) {
        return res.status(400).json({
          success: false,
          code: "INVALID_QUANTITY",
          message: "Item quantity must be at least 1"
        });
      }

      if (!Number.isInteger(item.borrow_days) || item.borrow_days < 1) {
        return res.status(400).json({
          success: false,
          code: "INVALID_BORROW_DAYS",
          message: "Borrow days must be a valid number"
        });
      }

      const [[dbItem]] = await db.promise().query(
        "SELECT name, max_period FROM items WHERE item_id = ?",
        [item.item_id]
      );

      if (!dbItem) {
        return res.status(400).json({
          success: false,
          code: "ITEM_NOT_FOUND",
          message: "Item not found"
        });
      }

      if (item.borrow_days > dbItem.max_period) {
        return res.status(400).json({
          success: false,
          code: "BORROW_DAYS_EXCEEDED",
          message: `Maximum allowed borrow period is ${dbItem.max_period} days for ${dbItem.name}.`
        });
      }

      // enrich item for email
      item.name = dbItem.name;
    }

    // 3️⃣ NOW enforce pending request limit (after validation)
    const MAX_PENDING = 12;

    const [[pendingRow]] = await db.promise().query(
      `SELECT COUNT(*) AS pendingCount
       FROM request_status
       WHERE user_id = ? AND status = 'pending'`,
      [user_id]
    );

    if (pendingRow.pendingCount >= MAX_PENDING) {
      return res.status(400).json({
        success: false,
        code: "PENDING_LIMIT_REACHED",
        message:
          "You already have too many pending requests. Please wait for approval or cancel existing requests."
      });
    }

    // 4️⃣ Generate batch + token
    const batchCode = `BATCH-${Math.floor(1000 + Math.random() * 9000)}`;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 5️⃣ Save confirmation
    await db.promise().query(
      `INSERT INTO checkout_confirmations
       (user_id, batch_code, items, token, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, batchCode, JSON.stringify(items), token, expiresAt]
    );

    // 6️⃣ Remove from cart
    const cartIds = items.map(i => i.cart_id);

    await db.promise().query(
      `DELETE FROM borrow_cart
       WHERE user_id = ?
       AND cart_id IN (${cartIds.map(() => "?").join(",")})`,
      [user_id, ...cartIds]
    );

    // 7️⃣ Send confirmation email  refreshenv
    // Check is it is production or development
    const APP_URL =
      process.env.NODE_ENV === "production"
        ? process.env.APP_URL_PUBLIC
        : process.env.APP_URL_LOCAL;

    const confirmationLink = `${APP_URL}/api/confirm_checkout?token=${token}`;

    await sendCheckoutConfirmationEmail({
      userEmail: req.user.email,
      confirmationLink,
      items
    });

    // 8️⃣ Final response
    res.json({
      success: true,
      message: "Checkout initiated! Please check your email to confirm.",
      batch_code: batchCode
    });

  } catch (err) {
    console.error("❌ Checkout failed:", err);
    res.status(500).json({
      success: false,
      message: "Checkout failed"
    });
  }
});






// ---------------- REQUEST STATUS (user view) ----------------
router.get("/admin/request-status", authMiddleware, (req, res) => {
  const user_id = req.user.id;
  const isAdmin = req.user.access_level === "admin";


  const sql = `
    SELECT 
      rs.request_id,
      rs.batch_code,
      rs.quantity,
      rs.request_date,
      rs.status,
      rs.approval_code,
      i.name AS item_name,
      i.description
    FROM request_status rs
    JOIN items i ON rs.item_id = i.item_id
    ${isAdmin ? "" : "WHERE rs.user_id = ?"}
    ORDER BY rs.request_date DESC
  `;

  const params = isAdmin ? [] : [user_id];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ Error fetching request status:", err);
      return res.status(500).json({ error: "Failed to load requests" });
    }
    res.json({ isAdmin, requests: results });
  });
});



// ===================== ADMIN REQUEST ACTIONS =====================
router.post("/admin/approve-request", authMiddleware, requireAdmin, async (req, res) => {
  const { code } = req.body;

  if (!code) return res.status(400).json({ error: "Missing approval or batch code" });

  try {
    // 🔹 Check if code refers to a batch
    const [batchCheck] = await db.promise().query(
      `SELECT DISTINCT batch_code FROM request_status WHERE batch_code = ?`,
      [code]
    );

    // ✅ SINGLE ITEM (approval code)
    if (batchCheck.length === 0) {
      const [rows] = await db.promise().query(
        `SELECT * FROM request_status WHERE approval_code = ? AND status = 'pending'`,
        [code]
      );

      if (rows.length === 0)
        return res.status(404).json({ error: "No pending request found for this code" });

      const request = rows[0];
      await db.promise().query(
        `UPDATE request_status SET status = 'approved' WHERE request_id = ?`,
        [request.request_id]
      );

      const borrowDate = new Date();
      const returnDate = new Date(borrowDate);
      returnDate.setDate(returnDate.getDate() + request.period);

      // Reduce available items
await db.promise().query(
  `UPDATE items 
   SET available = available - ? 
   WHERE item_id = ? AND available >= ?`,
  [request.quantity, request.item_id, request.quantity]
);

// Insert borrow record WITH quantity
await db.promise().query(
  `INSERT INTO borrows 
   (user_id, item_id, quantity, borrow_date, return_date, status)
   VALUES (?, ?, ?, ?, ?, 'approved')`,
  [
    request.user_id,
    request.item_id,
    request.quantity,
    borrowDate,
    returnDate
  ]
);




      // Send approval email for single request
      await sendSingleApprovalEmails({
  request,
  returnDate,
});





      return res.json({ message: "✅ Request approved successfully" });
    }

    // ✅ BATCH OPERATION
    const batchCode = code;

    const [batchRequests] = await db.promise().query(
      `SELECT * FROM request_status WHERE batch_code = ?`,
      [batchCode]
    );

    if (!batchRequests.length)
      return res.status(404).json({ error: "Batch not found" });

    const pendingCount = batchRequests.filter(r => r.status === "pending").length;

    if (pendingCount === 0)
      return res.status(400).json({ error: "Cannot approve: no pending item in this batch." });

    if (pendingCount !== batchRequests.length)
      return res.status(400).json({ error: "Cannot approve: not all items in this batch are pending." });

    // ✅ All pending — approve them all
    await db.promise().query(
      `UPDATE request_status SET status = 'approved' WHERE batch_code = ?`,
      [batchCode]
    );

    const borrowDate = new Date();
    for (const request of batchRequests) {
  const returnDate = new Date(borrowDate);
  returnDate.setDate(returnDate.getDate() + request.period);

  // 🔻 Reduce available stock
  const [updateResult] = await db.promise().query(
    `UPDATE items
     SET available = available - ?
     WHERE item_id = ? AND available >= ?`,
    [request.quantity, request.item_id, request.quantity]
  );

  if (updateResult.affectedRows === 0) {
    throw new Error(`Insufficient stock for item_id ${request.item_id}`);
  }

  // 📦 Save borrow WITH quantity
  await db.promise().query(
    `INSERT INTO borrows
     (user_id, item_id, quantity, borrow_date, return_date, status)
     VALUES (?, ?, ?, ?, ?, 'approved')`,
    [
      request.user_id,
      request.item_id,
      request.quantity,
      borrowDate,
      returnDate
    ]
  );



}


// SEND ONE EMAIL FOR THE WHOLE BATCH
const maxPeriod = Math.max(...batchRequests.map(r => r.period));
const batchReturnDate = new Date(borrowDate);
batchReturnDate.setDate(batchReturnDate.getDate() + maxPeriod);

await sendBatchApprovalEmails({
  requests: batchRequests,
  returnDate: batchReturnDate,
});





    res.json({ message: `✅ Batch ${batchCode} approved successfully` });
  } catch (err) {
    console.error("❌ Approve request failed:", err);
    res.status(500).json({ error: "Server error approving request" });
  }
});


// ===================== REJECT REQUEST =====================
router.post("/admin/reject-request", authMiddleware, requireAdmin, async (req, res) => {
  const { code, reason } = req.body;

  if (!code) return res.status(400).json({ error: "Missing approval or batch code" });
  if (!reason) return res.status(400).json({ error: "Rejection reason is required" });

  try {
    // 🔹 Check for batch
    const [batchCheck] = await db.promise().query(
      `SELECT DISTINCT batch_code FROM request_status WHERE batch_code = ?`,
      [code]
    );

    // ✅ SINGLE ITEM
    if (batchCheck.length === 0) {
      const [rows] = await db.promise().query(
        `SELECT * FROM request_status WHERE approval_code = ? AND status = 'pending'`,
        [code]
      );
      if (rows.length === 0)
        return res.status(404).json({ error: "No pending request found for this code" });

      const request = rows[0];
      await db.promise().query(
        `INSERT INTO rejected (user_id, item_id, rejected_date, reason)
         VALUES (?, ?, NOW(), ?)`,
        [request.user_id, request.item_id, reason]
      );
      await db.promise().query(`DELETE FROM request_status WHERE request_id = ?`, [request.request_id]);
      return res.json({ message: "❌ Request rejected successfully" });
    }

    // ✅ BATCH OPERATION
    const batchCode = code;
    const [batchRequests] = await db.promise().query(
      `SELECT * FROM request_status WHERE batch_code = ?`,
      [batchCode]
    );

    if (!batchRequests.length)
      return res.status(404).json({ error: "Batch not found" });

    const pendingCount = batchRequests.filter(r => r.status === "pending").length;

    if (pendingCount === 0)
      return res.status(400).json({ error: "Cannot reject: no pending item in this batch." });

    if (pendingCount !== batchRequests.length)
      return res.status(400).json({ error: "Cannot reject: not all items in this batch are pending." });

    for (const request of batchRequests) {
      await db.promise().query(
        `INSERT INTO rejected (user_id, item_id, rejected_date, reason)
         VALUES (?, ?, NOW(), ?)`,
        [request.user_id, request.item_id, reason]
      );
    }

    await db.promise().query(`DELETE FROM request_status WHERE batch_code = ?`, [batchCode]);
    res.json({ message: `❌ Batch ${batchCode} rejected successfully` });
  } catch (err) {
    console.error("❌ Reject request failed:", err);
    res.status(500).json({ error: "Server error rejecting request" });
  }
});


// ===================== MARK RETURNED =====================
router.post("/admin/mark-returned", authMiddleware, requireAdmin, async (req, res) => {
  const { code } = req.body;

  if (!code) return res.status(400).json({ error: "Missing approval or batch code" });

  try {
    // 🔹 Check for batch
    const [batchCheck] = await db.promise().query(
      `SELECT DISTINCT batch_code FROM request_status WHERE batch_code = ?`,
      [code]
    );

    // ✅ SINGLE ITEM
    if (batchCheck.length === 0) {
      const [rows] = await db.promise().query(
        `SELECT * FROM request_status WHERE approval_code = ? AND status = 'approved'`,
        [code]
      );

      if (rows.length === 0)
        return res.status(404).json({ error: "No approved request found for this code" });

      const request = rows[0];
      await db.promise().query(
        `UPDATE borrows SET status = 'returned', return_date = NOW()
         WHERE user_id = ? AND item_id = ? AND status = 'approved'`,
        [request.user_id, request.item_id]
      );
      await db.promise().query(`DELETE FROM request_status WHERE request_id = ?`, [request.request_id]);
      return res.json({ message: "📦 Item marked as returned successfully" });
    }

    // ✅ BATCH OPERATION
    const batchCode = code;
    const [batchRequests] = await db.promise().query(
      `SELECT * FROM request_status WHERE batch_code = ?`,
      [batchCode]
    );

    if (!batchRequests.length)
      return res.status(404).json({ error: "Batch not found" });

    const approvedCount = batchRequests.filter(r => r.status === "approved").length;

    if (approvedCount === 0)
      return res.status(400).json({ error: "Cannot mark returned: no approved item in this batch." });

    if (approvedCount !== batchRequests.length)
      return res.status(400).json({ error: "Cannot mark returned: not all items in this batch are approved." });

    for (const request of batchRequests) {
      await db.promise().query(
        `UPDATE borrows SET status = 'returned', return_date = NOW()
         WHERE user_id = ? AND item_id = ? AND status = 'approved'`,
        [request.user_id, request.item_id]
      );
    }

    await db.promise().query(`DELETE FROM request_status WHERE batch_code = ?`, [batchCode]);
    res.json({ message: `📦 Batch ${batchCode} marked as returned successfully` });
  } catch (err) {
    console.error("❌ Mark returned failed:", err);
    res.status(500).json({ error: "Server error marking return" });
  }
});






// 🔹 NORMAL USER REQUEST STATUS
router.get("/user/request-status", authMiddleware, (req, res) => {
  const user_id = req.user.id;

  const sql = `
    SELECT 
      rs.request_id,
      rs.batch_code,
      rs.quantity,
      rs.request_date,
      rs.status,
      i.name AS item_name,
      i.description
    FROM request_status rs
    JOIN items i ON rs.item_id = i.item_id
    WHERE rs.user_id = ?
    ORDER BY rs.request_date DESC
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("❌ Error fetching user requests:", err);
      return res.status(500).json({ error: "Failed to load user requests" });
    }
    res.json(results);
  });
});





// 🔹 Normal user Pending Requests
router.get("/pending-requests.html", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/private", "pending-requests.html"));
});


// ---------------- CANCEL REQUEST ----------------
// 🔹 DELETE PENDING REQUEST (User only)
router.delete("/user/cancel-request/:id", authMiddleware, async (req, res) => {
  const request_id = req.params.id;
  const user_id = req.user.id;

  if (!request_id) {
    return res.status(400).json({ error: "Missing request ID" });
  }

  try {
    const [result] = await db.promise().query(
      `DELETE FROM request_status 
       WHERE request_id = ? AND user_id = ? AND status = 'pending'`,
      [request_id, user_id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Request not found or already approved/deleted" });
    }

    res.json({ message: "Request deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting request:", err);
    res.status(500).json({ error: "Failed to delete request" });
  }
});






// 🔹 Admin-only Pending Requests
router.get("/admin-pending-requests.html", authMiddleware, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/private", "admin-pending-requests.html"));
});


// INVENTORY
router.get("/inventory.html", authMiddleware, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/private", "inventory.html"));
});

// ADMIN INVENTORY OVERVIEW
// INVENTORY OVERVIEW ROUTES
router.get("/inventory/holy", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT holy_item_id AS item_id, name, description, `condition`, quantity, 'holy' AS category FROM holy_items");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching holy items:", err);
    res.status(500).json({ error: "Failed to load holy items" });
  }
});

router.get("/inventory/items", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT item_id, name, description, `condition`, quantity, item_type AS category FROM items");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching general items:", err);
    res.status(500).json({ error: "Failed to load general items" });
  }
});

router.get("/inventory/preserved", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT preserved_id AS item_id, name, description, `condition`, quantity, reason AS category FROM preserved_items");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching preserved items:", err);
    res.status(500).json({ error: "Failed to load preserved items" });
  }
});




module.exports = router;
