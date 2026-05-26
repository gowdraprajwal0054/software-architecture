const express = require("express");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

const {
  generateJWTWithPrivateKey,
  fetchStudents,
  fetchProfessors,
} = require("./util");
const { ROLES } = require("../../../consts");
const { authServiceLogger: logger } = require("../../../logging");

const router = express.Router();

dotenv.config();

// Student Login
router.post("/student", async (req, res) => {
  const { email, password } = req.body;
  logger.info(`Student login attempt received for email: ${email}`);

  try {
    if (!email || !password) {
      logger.warn("Student login attempt failed: Email and password are required");
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }
    //Fetch the list of students
    const students = await fetchStudents();
    const student = students.find((s) => s.email === email);
    
    //Verify if the student exists
    if (!student) {
      logger.warn(`Student login attempt failed: Student not found for email: ${email}`);
      return res.status(404).json({ message: "Student not found" });
    }
    
    //Also check if the password does not match bcrypt.compare
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      logger.warn(`Student login attempt failed: Invalid credentials for email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateJWTWithPrivateKey({
      id: student._id,
      roles: [ROLES.STUDENT]
    });
    logger.info(`Student login successful for email: ${email}. JWT issued.`);
    res.status(200).json({access_token: token});
  } catch (error) {
    logger.error(`Student login server error for email: ${email}: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Professor Login
router.post("/professor", async (req, res) => {
  const { email, password } = req.body;
  logger.info(`Professor login attempt received for email: ${email}`);

  try {
    if (!email || !password) {
      logger.warn("Professor login attempt failed: Email and password are required");
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }
    //Fetch the list of professors
    const professors = await fetchProfessors();
    const professor = professors.find((p) => p.email === email);
    
    //Verify if the professor exists
    if (!professor) {
      logger.warn(`Professor login attempt failed: Professor not found for email: ${email}`);
      return res.status(404).json({ message: "Professor not found" });
    }
    
    //Also check if the password does not match bcrypt.compare
    const isMatch = await bcrypt.compare(password, professor.password);
    if (!isMatch) {
      logger.warn(`Professor login attempt failed: Invalid credentials for email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateJWTWithPrivateKey({
      id: professor._id,
      roles: [ROLES.PROFESSOR]
    });
    logger.info(`Professor login successful for email: ${email}. JWT issued.`);
    res.status(200).json({access_token: token});
  } catch (error) {
    logger.error(`Professor login server error for email: ${email}: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;


