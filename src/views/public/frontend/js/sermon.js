const express = require("express");
const router = express.Router();
const Sermon = require("../models/Sermon");

// Get all sermons
router.get("/", async (req, res) => {
    try {
        const sermons = await Sermon.find().sort({ date: -1 });
        res.json(sermons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new sermon
router.post("/", async (req, res) => {
    const { title, preacher, url } = req.body;
    if (!title || !preacher || !url) return res.status(400).json({ error: "All fields are required" });

    try {
        const newSermon = new Sermon({ title, preacher, url });
        await newSermon.save();
        res.json(newSermon);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
