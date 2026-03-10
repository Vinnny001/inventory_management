const db = require("../../../config/db");

// Get holy items
const getHolyItems = (req, res) => {
    db.query("SELECT * FROM holy_items", (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
};

// Add new holy item
const addHolyItem = (req, res) => {
    const { name, description, quantity } = req.body;

    db.query(
        "INSERT INTO holy_items (name, description, quantity, available) VALUES (?, ?, ?, ?)",
        [name, description, quantity, quantity],
        (err, result) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ message: "Holy item added successfully!" });
        }
    );
};

module.exports = { getHolyItems, addHolyItem };
