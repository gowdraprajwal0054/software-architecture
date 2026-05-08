const express = require("express");

const Student = require("../models/student");

const router = express.Router();

router.post("/", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
    }

    try {
        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        const existingStudent = await Student.findOne({ email: normalizedEmail });
        if (existingStudent) {
            return res.status(409).json({ error: "Email already exists" });
        }

        const student = await Student.create({
            name: normalizedName,
            email: normalizedEmail,
            password,
        });

        return res.status(201).json({
            id: student._id,
            name: student.name,
            email: student.email,
            createdAt: student.createdAt,
            updatedAt: student.updatedAt,
        });
    } catch (error) {
        if (error && error.code === 11000) {
            return res.status(409).json({ error: "Email already exists" });
        }
        return res.status(400).json({ error: error.message });
    }
});

module.exports = router;
