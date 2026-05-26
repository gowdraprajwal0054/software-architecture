const express = require("express");
const bcrypt = require("bcryptjs");

const Student = require("../models/student");
const { verifyRole, restrictStudentToOwnData } = require("./auth/util");
const { ROLES } = require("../../consts");
const { studentServiceLogger: logger } = require("../../logging");
const { getCorrelationId } = require("../../correlationId");

const router = express.Router();

// Add student
router.post(
  "/",
  verifyRole([ROLES.PROFESSOR, ROLES.ADMIN]),
  async (req, res) => {
    const { name, email, password } = req.body;
    logger.info(`Student creation attempt received for email: ${email} by user: ${req.user.id}`);

    if (!name || !email || !password) {
      logger.warn("Student creation failed: Missing name, email, or password");
      return res
        .status(400)
        .json({ message: "Please provide name, email and password" });
    }
    try {
      // Try to find if the email exists
      const existingStudent = await Student.findOne({ email });
      if (existingStudent) {
        logger.warn(`Student creation failed: Email already exists: ${email}`);
        return res
          .status(400)
          .json({ message: "Student with this email exists" });
      }
      const newStudent = new Student({ name, email, password });
      const savedStudent = await newStudent.save();

      logger.info(`Student created successfully with ID: ${savedStudent._id}, email: ${email}`);
      res.status(201).json(savedStudent);
    } catch (error) {
      logger.error(`Error in student creation for email: ${email}: ${error.message}`);
      res.status(500).json({
        message: "Unable to create student",
        error: error.message,
      });
    }
  }
);

// Get users
router.get(
  "/",
  verifyRole([
    ROLES.PROFESSOR,
    ROLES.ADMIN,
    ROLES.AUTH_SERVICE,
    ROLES.ENROLLMENT_SERVICE,
    ROLES.GRADE_SERVICE,
  ]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch all students by user: ${req.user.id}, role: ${req.user.roles}`);
      const students = await Student.find();
      logger.info(`Successfully fetched ${students.length} students`);
      return res.json(students);
    } catch (error) {
      logger.error(`Error fetching students: ${error.message}`);
      res.status(500).json({
        message: "Server Error: Unable to fetch students",
        correlationId: getCorrelationId(),
      });
    }
  }
);

// Get a specific student by ID
router.get(
  "/:id",
  verifyRole([ROLES.PROFESSOR, ROLES.ADMIN, ROLES.STUDENT, ROLES.GRADE_SERVICE]),
  restrictStudentToOwnData,
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch student ID: ${req.params.id} by user: ${req.user.id}`);
      const student = await Student.findById(req.params.id).select("-password");

      if (!student) {
        logger.warn(`Student profile lookup failed: ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Student not found" });
      }

      logger.info(`Student profile successfully retrieved: ID ${req.params.id}`);
      res.status(200).json(student);
    } catch (error) {
      logger.error(`Error retrieving student ID ${req.params.id}: ${error.message}`);
      if (error.kind === "ObjectId") {
        return res.status(400).json({ message: "Invalid student ID format" });
      }
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// Update a student
router.put(
  "/:id",
  verifyRole([ROLES.STUDENT, ROLES.ADMIN]),
  restrictStudentToOwnData,
  async (req, res) => {
    try {
      logger.info(`Incoming request to update student ID: ${req.params.id} by user: ${req.user.id}`);
      const { name, email, password } = req.body;

      const updatedData = { name, email };
      if (password) {
        const salt = await bcrypt.genSalt(10);
        updatedData.password = await bcrypt.hash(password, salt);
      }

      const student = await Student.findByIdAndUpdate(
        req.params.id,
        updatedData,
        {
          new: true,
        }
      );

      if (!student) {
        logger.warn(`Student update failed: Student ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Student not found" });
      }

      logger.info(`Student ID ${req.params.id} updated successfully`);
      res
        .status(200)
        .json({ message: "Student updated successfully", student });
    } catch (error) {
      logger.error(`Error updating student ID ${req.params.id}: ${error.message}`);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// Delete a student
router.delete(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to delete student ID: ${req.params.id} by user: ${req.user.id}`);
      const student = await Student.findByIdAndDelete(req.params.id);

      if (!student) {
        logger.warn(`Student deletion failed: Student ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Student not found" });
      }

      logger.info(`Student ID ${req.params.id} deleted successfully`);
      res
        .status(200)
        .json({ message: "Student deleted successfully", student });
    } catch (error) {
      logger.error(`Error deleting student ID ${req.params.id}: ${error.message}`);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

module.exports = router;