const db = require("../../../config/db");
const dbPromise = db.promise();  // 🔹 create promise wrapper

// Get all users
async function getAllUsers() {
  const [rows] = await dbPromise.query("SELECT user_id, username, email, phone_number, access_level FROM users");
  console.log(rows);
  return rows;
  
}

// Get user by ID
async function getUserById(id) {
  const [rows] = await dbPromise.query(
    "SELECT user_id,username, email, access_level FROM users WHERE user_id = ?",
    [id]
  );
  return rows[0];
}

// Create new user
async function createUser({ name, email, password, phone, access_level }) {
  // NOTE: hash password in real apps
  const [result] = await dbPromise.query(
    "INSERT INTO users (username, email, password, phone_number, access_level) VALUES (?, ?, ?, ?, ?)",
    [name, email, password, phone, access_level]
  );
  return { id: result.insertId, name, email, access_level };
}

// Update user role
async function updateUserRole(id, access_level) {
  await dbPromise.query("UPDATE users SET access_level = ? WHERE user_id = ?", [access_level, id]);
  return { id, access_level };
}

// Delete user
async function deleteUser(id) {
  await dbPromise.query("DELETE FROM users WHERE user_id = ?", [id]);
  return { id };
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUserRole,
  deleteUser
};
