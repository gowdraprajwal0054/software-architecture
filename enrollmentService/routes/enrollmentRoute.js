const express = require("express");

const Enrollment = require("../models/enrollment");

const router = express.Router();

const {
  verifyRole,
  restrictStudentToOwnData,
  fetchStudents,
  fetchCourses,
} = require("./auth/util");
const { ROLES } = require("../../consts");
const { getCorrelationId } = require("../../correlationId");
const { enrollementServiceLogger: logger } = require("../../logging");

router.post(
  "/",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      const { student, course } = req.body;
      logger.info(`Enrollment request received: Student ${student} -> Course ${course} by user: ${req.user.id}`);

      // Ensure both student and course IDs are provided
      if (!student || !course) {
        logger.warn("Enrollment failed: Student and Course IDs are required");
        return res
          .status(400)
          .json({ message: "Student and Course are required" });
      }

      const students = await fetchStudents();
      const existingStudent = students.find((s) => s._id === student);
      if (!existingStudent) {
        logger.warn(`Enrollment failed: Student ID ${student} not found`);
        return res.status(404).json({ message: "Student not found" });
      }

      const courses = await fetchCourses();
      const existingCourse = courses.find((c) => c._id === course);
      if (!existingCourse) {
        logger.warn(`Enrollment failed: Course ID ${course} not found`);
        return res.status(404).json({ message: "Course not found" });
      }

      // Attempt to create the Enrollment
      const enrollment = new Enrollment({ student, course });
      await enrollment.save();

      logger.info(`Enrollment created successfully with ID: ${enrollment._id}`);
      res.status(201).json(enrollment);
    } catch (error) {
      // Handle duplicate enrollment error
      if (error.code === 11000) {
        logger.warn(`Enrollment conflict: Student ${req.body.student} is already enrolled in Course ${req.body.course}`);
        return res.status(409).json({
          message:
            "Duplicate enrollment: Student is already enrolled in this course.",
        });
      }

      logger.error(`Error in enrollment creation: ${error.message}`);
      res.status(error.status || 500).json({
        message: error.message || "Unable to create enrollement",
        correlationId: getCorrelationId(),
      });
    }
  },
);

// Get all enrollments
router.get(
  "/",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch all enrollments by user: ${req.user.id}`);
      const enrollments = await Enrollment.find();
      logger.info(`Successfully fetched ${enrollments.length} enrollments`);
      res.status(200).json(enrollments);
    } catch (error) {
      logger.error(`Error fetching enrollments: ${error.message}`);
      res.status(500).json({
        message: "Server Error: Unable to fetch enrollments",
      });
    }
  },
);

// Get a specific enrollment by ID with expanded student and course object (no populate or Student model)
router.get(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch enrollment ID: ${req.params.id} by user: ${req.user.id}`);
      const enrollment = await Enrollment.findById(req.params.id);

      if (!enrollment) {
        logger.warn(`Enrollment lookup failed: ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Enrollment not found" });
      }

      const enrollmentObj = enrollment.toObject();

      // Fetch all students and find the matching one
      const students = await fetchStudents();
      const student = students.find(
        (s) => s._id.toString() === enrollmentObj.student.toString(),
      );
      if (student) {
        enrollmentObj.student = student;
      }

      // Fetch all courses and find the matching one
      const courses = await fetchCourses();
      const course = courses.find(
        (c) => c._id.toString() === enrollmentObj.course.toString(),
      );
      if (course) {
        enrollmentObj.course = course;
      }

      logger.info(`Enrollment ID ${req.params.id} successfully retrieved with rich details`);
      res.status(200).json(enrollmentObj);
    } catch (error) {
      logger.error(`Error fetching enrollment ID ${req.params.id}: ${error.message}`);
      if (error.kind === "ObjectId") {
        return res
          .status(400)
          .json({ message: "Invalid enrollment ID format" });
      }
      res.status(500).json({
        message: "Server Error: Unable to fetch enrollment",
      });
    }
  },
);

// Get enrollment by student ID
router.get(
  "/student/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR, ROLES.STUDENT, ROLES.GRADE_SERVICE]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch enrollments for student ID: ${req.params.id} by user: ${req.user.id}`);
      let enrollments = await Enrollment.find({
        student: req.params.id,
      });

      if (!enrollments.length) {
        logger.warn(`No enrollments found for student ID: ${req.params.id}`);
        return res
          .status(404)
          .json({ message: "No enrollments found for this student" });
      }

      const courses = await fetchCourses();
      enrollments = enrollments.map((enrollment) => {
        const enrollmentObj = enrollment.toObject(); // Convert to plain object if it's a Mongoose document
        const course = courses.find(
          (course) => course._id.toString() === enrollmentObj.course.toString(),
        );
        if (course) {
          enrollmentObj.course = course; // Replace course ID with the full course object
        }
        return enrollmentObj;
      });

      logger.info(`Successfully retrieved ${enrollments.length} rich enrollments for student ID: ${req.params.id}`);
      res.status(200).json(enrollments);
    } catch (error) {
      logger.error(`Error fetching enrollments for student ID ${req.params.id}: ${error.message}`);
      res.status(500).json({
        message: "Server Error: Unable to fetch enrollments for student",
      });
    }
  },
);

// Delete an enrollment by ID
router.delete(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to delete enrollment ID: ${req.params.id} by user: ${req.user.id}`);
      const enrollment = await Enrollment.findByIdAndDelete(req.params.id);

      if (!enrollment) {
        logger.warn(`Enrollment deletion failed: ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Enrollment not found" });
      }

      logger.info(`Enrollment ID ${req.params.id} deleted successfully`);
      res
        .status(200)
        .json({ message: "Enrollment deleted successfully", enrollment });
    } catch (error) {
      logger.error(`Error deleting enrollment ID ${req.params.id}: ${error.message}`);
      if (error.kind === "ObjectId") {
        return res
          .status(400)
          .json({ message: "Invalid enrollment ID format" });
      }
      res.status(500).json({
        message: "Server Error: Unable to delete enrollment",
      });
    }
  },
);

module.exports = router;
