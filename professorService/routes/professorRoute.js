const express = require("express");
const Professor = require("../models/professor");
const bcrypt = require("bcryptjs");
const { professorServiceLogger: logger } = require("../../logging");
const { verifyRole, restrictProfessorToOwnData } = require("./auth/util");
const { ROLES } = require("../../consts");

const router = express.Router();

// Create a new professor
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    logger.info(`Professor registration attempt received for email: ${email}`);

    // Ensure all fields are provided
    if (!name || !email || !phone || !password) {
      logger.warn("Professor registration failed: Missing required fields");
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check for duplicate email or phone
    const existingProfessor = await Professor.findOne({
      $or: [{ email }, { phone }],
    });
    if (existingProfessor) {
      logger.warn(`Professor registration conflict: Email or phone already exists: ${email} / ${phone}`);
      return res.status(409).json({ message: "Email or phone already exists" });
    }

    // Create and save the professor
    const professor = new Professor({ name, email, phone, password });
    await professor.save();

    logger.info(`Professor created successfully with ID: ${professor._id}, email: ${email}`);
    res
      .status(201)
      .json({ message: "Professor created successfully", professor });
  } catch (error) {
    logger.error(`Error in professor registration for email: ${req.body.email}: ${error.message}`);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Get all professors
router.get(
  "/",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR, ROLES.AUTH_SERVICE]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch all professors by user ID: ${req.user.id}, role: ${req.user.roles}`);
      const query = Professor.find();
      if (!req.user.roles.includes(ROLES.AUTH_SERVICE)) {
        query.select("-password"); // Exclude password for normal users
      }
      const professors = await query;
      logger.info(`Successfully fetched ${professors.length} professors`);
      return res.status(200).json(professors);
    } catch (error) {
      logger.error(`Error fetching professors: ${error.message}`);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// Get a specific professor by ID
router.get(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  restrictProfessorToOwnData,
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch professor ID: ${req.params.id} by user: ${req.user.id}`);
      const professor = await Professor.findById(req.params.id).select(
        "-password"
      );

      if (!professor) {
        logger.warn(`Professor profile lookup failed: ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Professor not found" });
      }

      logger.info(`Professor profile successfully retrieved: ID ${req.params.id}`);
      res.status(200).json(professor);
    } catch (error) {
      logger.error(`Error retrieving professor ID ${req.params.id}: ${error.message}`);
      if (error.kind === "ObjectId") {
        return res.status(400).json({ message: "Invalid professor ID format" });
      }
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// Update a professor
router.put(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  restrictProfessorToOwnData,
  async (req, res) => {
    try {
      logger.info(`Incoming request to update professor ID: ${req.params.id} by user: ${req.user.id}`);
      const { name, email, phone, password } = req.body;

      const updatedData = { name, email, phone };
      if (password) {
        const salt = await bcrypt.genSalt(10);
        updatedData.password = await bcrypt.hash(password, salt);
      }

      const professor = await Professor.findByIdAndUpdate(
        req.params.id,
        updatedData,
        {
          new: true,
        }
      );

      if (!professor) {
        logger.warn(`Professor update failed: Professor ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Professor not found" });
      }

      logger.info(`Professor ID ${req.params.id} updated successfully`);
      res
        .status(200)
        .json({ message: "Professor updated successfully", professor });
    } catch (error) {
      logger.error(`Error updating professor ID ${req.params.id}: ${error.message}`);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// Delete a professor
router.delete("/:id", verifyRole([ROLES.ADMIN]), async (req, res) => {
  try {
    logger.info(`Incoming request to delete professor ID: ${req.params.id} by Admin user: ${req.user.id}`);
    const professor = await Professor.findByIdAndDelete(req.params.id);

    if (!professor) {
      logger.warn(`Professor deletion failed: Professor ID ${req.params.id} not found`);
      return res.status(404).json({ message: "Professor not found" });
    }

    logger.info(`Professor ID ${req.params.id} deleted successfully`);
    res
      .status(200)
      .json({ message: "Professor deleted successfully", professor });
  } catch (error) {
    logger.error(`Error deleting professor ID ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;
